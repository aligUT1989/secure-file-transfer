// ============================================================
//  CONFIG — paste your Supabase project values here.
//  These two values are SAFE to be public (that's how Supabase
//  frontends work). Real security comes from the Storage
//  policies you set up in supabase-setup.sql — a logged-in user
//  can only ever touch their OWN folder.
// ============================================================

window.APP_CONFIG = {
  // Supabase -> Project Settings -> API -> "Project URL"
  SUPABASE_URL: "https://YOUR-PROJECT-ref.supabase.co",

  // Supabase -> Project Settings -> API -> "anon public" key
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",

  // Name of the private Storage bucket (created in supabase-setup.sql)
  BUCKET: "files",
};
