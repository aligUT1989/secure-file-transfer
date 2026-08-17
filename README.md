# 📦 Secure File Transfer

A private, HTTPS-only website where **you log in and move files between your own computers**.
Corporate firewalls block FTP, but this is just a normal `https://` website, so it sails right through.

- ⬆️ Drag-and-drop upload from any computer
- ⬇️ Download your files anywhere
- 🗑️ Delete files you no longer need
- 🙈 Your files are **private to you** — no one else can see or reach them

The app supports **three backends** (pick one in `config.js` via `MODE`):

| Mode | Login with | Files stored in | Max file size | Best for |
|------|-----------|-----------------|:---:|----------|
| **`r2`** (default) | a password | **Cloudflare R2** (10 GB free) | ~5 GB | big files, best long-term |
| `github` | a GitHub token | a private GitHub repo | 100 MB | quick, no extra service |
| `supabase` | email + password | Supabase Storage | ~50 MB (free) | real email/password accounts |

---

## 🚀 Quick start — Cloudflare R2 mode (for big files, e.g. 1.7 GB)

The website is static (GitHub Pages). It talks to a tiny **Cloudflare Worker** that holds
your R2 keys and hands the browser short-lived upload/download links, so **big files upload
straight to R2** with a real progress bar. Nothing large ever passes through GitHub.

### 1. Make a free Cloudflare account + R2 bucket
1. Sign up at <https://dash.cloudflare.com> (free).
2. Left sidebar → **R2** → **Create bucket** (you may need to confirm billing info; R2 has a free tier, no charge). Name it e.g. `my-files`.

### 2. Create an R2 API token (the keys the Worker uses)
1. **R2 → Manage R2 API Tokens → Create API token**.
2. Permission: **Object Read & Write**. Scope it to your bucket. **Create**.
3. Copy the **Access Key ID**, **Secret Access Key**, and note your **Account ID**
   (shown on the R2 overview page).

### 3. Deploy the Worker
In a terminal:
```powershell
cd "worker"
npm install
npx wrangler login          # opens browser, authorize
npx wrangler deploy         # prints your Worker URL: https://secure-file-transfer.<sub>.workers.dev
```
Then set the secrets (each prompts you to paste the value — nothing is stored in the repo):
```powershell
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put R2_BUCKET          # the bucket name, e.g. my-files
npx wrangler secret put APP_PASSWORD       # the password you'll type on the website
```

### 4. Allow the website to upload to R2 (CORS)
In the Cloudflare dashboard: **R2 → your bucket → Settings → CORS Policy → Add**, and paste
the contents of [`worker/r2-cors.json`](worker/r2-cors.json). (It already lists your live site
`https://aligut1989.github.io`. Add other origins if you host it elsewhere.)

### 5. Point the site at your Worker
Put your Worker URL into [`config.js`](config.js):
```js
MODE: "r2",
WORKER_URL: "https://secure-file-transfer.<your-sub>.workers.dev",
```
Commit + push:
```powershell
cd ..
git commit -am "Point site at my R2 Worker"
git push
```

### Use it
Open the site → type your `APP_PASSWORD` → drag your 1.7 GB file in. Download it on any other computer the same way.

**Notes (R2 mode):**
- Free tier: 10 GB storage, and **zero download fees**.
- The `APP_PASSWORD` is the only thing you type; the R2 keys stay inside the Worker as secrets.
- Uploads go directly browser → R2 (the presigned URL). If an upload gives a "CORS error", re-check step 4.
- Single upload works up to ~5 GB. For bigger, ask for multipart upload.

---

## ⚡ GitHub mode (no extra service, files ≤ 100 MB)

To use this instead, set `MODE: "github"` in `config.js`.

1. **A private storage repo already exists:** `secure-file-transfer-storage`.
   (If you fork this, create your own private repo and put its name in `config.js`.)
2. **Create a fine-grained access token** (your "password"):
   - Open <https://github.com/settings/personal-access-tokens/new>
   - **Repository access → Only select repositories →** choose `secure-file-transfer-storage`
   - **Permissions → Repository permissions → Contents → Read and write**
   - **Generate token**, copy it.
3. **Open the site**, paste the token, click **Connect**. Done — upload/download from any computer.

**Good to know (GitHub mode):**
- The token acts as the password; it's stored only in your browser (uncheck "Stay signed in" to keep it in memory only).
- Best for files under ~25 MB each (GitHub API hard cap is 100 MB per file).
- Files live in your **private** repo, so they stay yours. Give the token an expiry for extra safety.
- `api.github.com` is normally allowed through corporate networks (it's plain HTTPS).

---

## Alternative: Supabase mode (email + password, bigger files)

Set `MODE: "supabase"` in `config.js`, then follow the steps below.

## 1. Create a free Supabase project (2 min)

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project** → pick a name + a database password → **Create**.
3. Wait ~1 minute for it to finish provisioning.

## 2. Run the setup SQL (30 sec)

1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open [`supabase-setup.sql`](supabase-setup.sql), copy everything, paste it in, click **Run**.
   - This creates a private `files` bucket and locks it down so each user
     can only touch their own files.

## 3. Paste your keys into `config.js` (30 sec)

1. In Supabase go to **Project Settings → API**.
2. Copy these two values into [`config.js`](config.js):
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`

> ✅ These two values are meant to be public — that's how Supabase web apps work.
> Security is enforced by the SQL policies from step 2, not by hiding the key.

## 4. Test it locally

Just double-click `index.html`, or serve the folder:

```powershell
# optional local server (Python)
python -m http.server 8080
# then open http://localhost:8080
```

Create an account, upload a file, done.

---

## 5. Put it online for free (so "another computer" can reach it)

Any of these host a static site over HTTPS for free. Pick one:

### Option A — Netlify (easiest, drag & drop)
1. Go to <https://app.netlify.com/drop>.
2. Drag this **whole folder** onto the page.
3. You instantly get a URL like `https://your-name.netlify.app` — open it from any computer.

### Option B — GitHub Pages (you mentioned GitHub)
1. Create a new **public** repo on GitHub, upload these files.
2. Repo **Settings → Pages → Source: `main` branch / root → Save**.
3. Your site appears at `https://yourname.github.io/your-repo/`.

### Option C — Vercel
1. <https://vercel.com> → **Add New → Project** → import the repo (or drag the folder).
2. Framework preset: **Other**. Deploy. You get an `https://...vercel.app` URL.

---

## How you'll use it day to day

1. On **Computer A**: open the site → sign in → drag a file in.
2. On **Computer B**: open the same site → sign in with the same email → download it.

That's it. Files stay in your Supabase storage until you delete them.

---

## Notes & limits

- **Free tier storage:** Supabase free = 1 GB storage + generous bandwidth. Plenty for docs, code, images. For huge video, delete after transfer.
- **Email confirmation:** By default Supabase may require email confirmation on sign-up. To skip it for a personal tool: **Authentication → Providers → Email → turn off "Confirm email"**.
- **Make it truly private (just you):** After you create your account, go to **Authentication → Providers → Email → turn off "Allow new users to sign up"** so no one else can register.
- **Security:** files are transferred over HTTPS and stored per-user. A logged-in user can only ever access their own `<user-id>/` folder (enforced by the SQL policies). Downloads use short-lived (60-second) signed URLs.

---

## Files in this project

| File | What it is |
|------|-----------|
| `index.html` | The entire app (login + file manager UI) |
| `config.js` | Your Supabase URL + anon key (you fill this in) |
| `supabase-setup.sql` | One-time database/storage setup — run in Supabase SQL Editor |
| `README.md` | This guide |
