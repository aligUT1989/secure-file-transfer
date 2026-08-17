// ============================================================
//  CONFIG
//  This app can run in two modes. Right now it's set to "github"
//  so it works WITHOUT Supabase — your files are stored in a
//  private GitHub repo, and you "log in" with a GitHub token.
// ============================================================

window.APP_CONFIG = {
  // "github" -> store files in a private GitHub repo (100 MB/file cap)
  // "r2"     -> store files in Cloudflare R2 via a Worker (big files, 10 GB free)
  // "supabase" -> use Supabase auth + storage
  MODE: "r2",

  // ---- Cloudflare R2 mode ----
  // Paste the URL of your deployed Worker (looks like
  // https://secure-file-transfer.<your-subdomain>.workers.dev)
  WORKER_URL: "https://YOUR-WORKER.workers.dev",

  // ---- GitHub mode settings ----
  GITHUB_OWNER: "aligUT1989",                  // your GitHub username
  GITHUB_REPO: "secure-file-transfer-storage", // the PRIVATE repo that holds files
  GITHUB_BRANCH: "main",
  UPLOAD_DIR: "uploads",                        // folder inside the repo

  // ---- Supabase mode settings (only used if MODE = "supabase") ----
  SUPABASE_URL: "https://YOUR-PROJECT-ref.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",
  BUCKET: "files",
};
