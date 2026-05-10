export const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "app", "admin", "mail", "smtp", "ftp", "cdn",
  "bcms", "bcms-web", "auth", "dashboard", "blog", "docs", "help",
  "support", "status", "static", "assets", "img", "images",
]);

export const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || "theossphere.com";

export const DEFAULT_BRANDING = {
  primaryColor: "#1565C0",
  secondaryColor: "#0284C7",
  logoUrl: null,
  faviconUrl: null,
  companyDisplayName: null,
  loginBgColor: "#F0F6FF",
  sidebarBgColor: "#0D1B3E",
};

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || "";

export function hasSupabasePublicEnv() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON);
}
