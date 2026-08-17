# 📦 Secure File Transfer

A private, HTTPS-only website where **you log in and move files between your own computers**.
Corporate firewalls block FTP, but this is just a normal `https://` website, so it sails right through.

- ⬆️ Drag-and-drop upload from any computer
- ⬇️ Download your files anywhere
- 🗑️ Delete files you no longer need
- 🙈 Your files are **private to you** — no one else can see or reach them

The app supports **two backends** (pick one in `config.js` via `MODE`):

| Mode | Login with | Files stored in | Best for |
|------|-----------|-----------------|----------|
| **`github`** (default) | a GitHub access token | a **private GitHub repo** | quickest — no extra service |
| `supabase` | email + password | Supabase Storage | many files / large files / real accounts |

---

## ⚡ Quick start — GitHub mode (no Supabase needed)

This is how the app is set up right now.

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
