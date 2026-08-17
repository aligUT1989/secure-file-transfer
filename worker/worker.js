// ============================================================
//  Secure File Transfer — Cloudflare Worker (R2 backend)
//  Dependency-free: you can paste this straight into the
//  Cloudflare dashboard Worker editor (no build step).
//
//  Set these as Worker "Variables and Secrets" (Settings tab):
//    R2_ACCOUNT_ID         your Cloudflare account id
//    R2_ACCESS_KEY_ID      R2 API token access key id
//    R2_SECRET_ACCESS_KEY  R2 API token secret
//    R2_BUCKET             the R2 bucket name (e.g. my-files)
//    APP_PASSWORD          the password you'll type in the website
// ============================================================

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
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ---------- AWS SigV4 presigning (Web Crypto) ----------
const enc = new TextEncoder();
function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(str) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(str)));
}
async function hmac(keyBuf, str) {
  const key = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(str));
}
function rfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
function encodePath(path) {
  return path.split("/").map(rfc3986).join("/");
}
async function signingKey(secret, dateStamp, region, service) {
  let k = enc.encode("AWS4" + secret);
  k = await hmac(k, dateStamp);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, "aws4_request");
  return k;
}
async function presign(opts) {
  const { method, accountId, accessKeyId, secretAccessKey, bucket, key = "", expires = 3600 } = opts;
  const extraQuery = opts.extraQuery || {};
  const region = "auto", service = "s3";
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = "/" + encodePath(bucket + (key ? "/" + key : ""));
  const q = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
    ...extraQuery,
  };
  const canonicalQuery = Object.keys(q).sort()
    .map((k) => rfc3986(k) + "=" + rfc3986(q[k])).join("&");
  const canonicalRequest = [
    method, canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest),
  ].join("\n");
  const kSign = await signingKey(secretAccessKey, dateStamp, region, service);
  const signature = hex(await hmac(kSign, stringToSign));
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function parseList(xml) {
  const files = [];
  const re = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const key = (block.match(/<Key>([\s\S]*?)<\/Key>/) || [])[1];
    const size = (block.match(/<Size>(\d+)<\/Size>/) || [])[1];
    if (key) files.push({ name: decodeXml(key), size: size ? parseInt(size, 10) : null });
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
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== "POST") return json({ error: "Use POST" }, 405, origin);

    const key = request.headers.get("x-app-key") || "";
    if (!env.APP_PASSWORD || !safeEqual(key, env.APP_PASSWORD)) return json({ error: "Unauthorized" }, 401, origin);

    const url = new URL(request.url);
    let body = {};
    try { body = await request.json(); } catch (_) {}

    const base = {
      method: "GET",
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    };

    try {
      if (url.pathname === "/list") {
        const signed = await presign({ ...base, method: "GET", key: "",
          extraQuery: { "list-type": "2", "max-keys": "1000" } });
        const res = await fetch(signed, { method: "GET" });
        if (!res.ok) return json({ error: "List failed " + res.status }, 502, origin);
        return json({ files: parseList(await res.text()) }, 200, origin);
      }

      if (url.pathname === "/presign-put") {
        const name = (body.name || "").trim();
        if (!name) return json({ error: "Missing name" }, 400, origin);
        return json({ url: await presign({ ...base, method: "PUT", key: name }) }, 200, origin);
      }

      if (url.pathname === "/presign-get") {
        const name = (body.name || "").trim();
        if (!name) return json({ error: "Missing name" }, 400, origin);
        const fn = name.split("/").pop();
        return json({ url: await presign({ ...base, method: "GET", key: name,
          extraQuery: { "response-content-disposition": `attachment; filename="${fn}"` } }) }, 200, origin);
      }

      if (url.pathname === "/delete") {
        const name = (body.name || "").trim();
        if (!name) return json({ error: "Missing name" }, 400, origin);
        const signed = await presign({ ...base, method: "DELETE", key: name });
        const res = await fetch(signed, { method: "DELETE" });
        if (!res.ok && res.status !== 204) return json({ error: "Delete failed " + res.status }, 502, origin);
        return json({ ok: true }, 200, origin);
      }

      return json({ error: "Not found" }, 404, origin);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500, origin);
    }
  },
};
