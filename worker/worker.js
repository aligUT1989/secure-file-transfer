// ============================================================
//  Secure File Transfer — Cloudflare Worker (R2 backend)
//
//  This is your private API. It holds the R2 keys (as secrets),
//  checks your password, and hands the browser short-lived
//  presigned URLs so big files upload straight to R2.
//
//  Secrets it needs (set with: wrangler secret put <NAME>):
//    R2_ACCOUNT_ID         your Cloudflare account id
//    R2_ACCESS_KEY_ID      R2 API token access key id
//    R2_SECRET_ACCESS_KEY  R2 API token secret
//    R2_BUCKET             the R2 bucket name (e.g. my-files)
//    APP_PASSWORD          the password you'll type in the website
// ============================================================

import { AwsClient } from "aws4fetch";

const JSON_HEADERS = { "Content-Type": "application/json" };

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-app-key",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...JSON_HEADERS, ...cors(origin) },
  });
}

// constant-time-ish compare
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function endpoint(env) {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function client(env) {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
}

function encodeKey(name) {
  return name.split("/").map(encodeURIComponent).join("/");
}

// Parse the S3 ListObjectsV2 XML with regex (Workers have no DOMParser)
function parseList(xml) {
  const files = [];
  const re = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const key = (block.match(/<Key>([\s\S]*?)<\/Key>/) || [])[1];
    const size = (block.match(/<Size>(\d+)<\/Size>/) || [])[1];
    const mod = (block.match(/<LastModified>([\s\S]*?)<\/LastModified>/) || [])[1];
    if (key) {
      files.push({
        name: decodeXml(key),
        size: size ? parseInt(size, 10) : null,
        modified: mod || null,
      });
    }
  }
  return files;
}
function decodeXml(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== "POST") {
      return json({ error: "Use POST" }, 405, origin);
    }

    // ---- auth ----
    const key = request.headers.get("x-app-key") || "";
    if (!env.APP_PASSWORD || !safeEqual(key, env.APP_PASSWORD)) {
      return json({ error: "Unauthorized" }, 401, origin);
    }

    const url = new URL(request.url);
    let body = {};
    try { body = await request.json(); } catch (_) {}

    const aws = client(env);
    const base = endpoint(env);
    const bucket = env.R2_BUCKET;

    try {
      // ---------- LIST ----------
      if (url.pathname === "/list") {
        const u = new URL(`${base}/${bucket}`);
        u.searchParams.set("list-type", "2");
        u.searchParams.set("max-keys", "1000");
        const res = await aws.fetch(u.toString(), { method: "GET" });
        if (!res.ok) return json({ error: "List failed " + res.status }, 502, origin);
        const xml = await res.text();
        return json({ files: parseList(xml) }, 200, origin);
      }

      // ---------- PRESIGN PUT (upload) ----------
      if (url.pathname === "/presign-put") {
        const name = (body.name || "").trim();
        if (!name) return json({ error: "Missing name" }, 400, origin);
        const u = new URL(`${base}/${bucket}/${encodeKey(name)}`);
        u.searchParams.set("X-Amz-Expires", "3600");
        const signed = await aws.sign(u.toString(), {
          method: "PUT",
          aws: { signQuery: true },
        });
        return json({ url: signed.url }, 200, origin);
      }

      // ---------- PRESIGN GET (download) ----------
      if (url.pathname === "/presign-get") {
        const name = (body.name || "").trim();
        if (!name) return json({ error: "Missing name" }, 400, origin);
        const fn = name.split("/").pop();
        const u = new URL(`${base}/${bucket}/${encodeKey(name)}`);
        u.searchParams.set("X-Amz-Expires", "3600");
        u.searchParams.set("response-content-disposition", `attachment; filename="${fn}"`);
        const signed = await aws.sign(u.toString(), {
          method: "GET",
          aws: { signQuery: true },
        });
        return json({ url: signed.url }, 200, origin);
      }

      // ---------- DELETE ----------
      if (url.pathname === "/delete") {
        const name = (body.name || "").trim();
        if (!name) return json({ error: "Missing name" }, 400, origin);
        const u = new URL(`${base}/${bucket}/${encodeKey(name)}`);
        const res = await aws.fetch(u.toString(), { method: "DELETE" });
        if (!res.ok && res.status !== 204) return json({ error: "Delete failed " + res.status }, 502, origin);
        return json({ ok: true }, 200, origin);
      }

      return json({ error: "Not found" }, 404, origin);
    } catch (err) {
      return json({ error: String(err && err.message || err) }, 500, origin);
    }
  },
};
