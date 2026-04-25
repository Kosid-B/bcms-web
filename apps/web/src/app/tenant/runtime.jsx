import React, { createContext, useContext, useEffect, useState } from "react";

import {
  BASE_DOMAIN,
  DEFAULT_BRANDING,
  RESERVED_SUBDOMAINS,
  SUPABASE_ANON,
  SUPABASE_URL,
} from "../config/platform";

const TenantContext = createContext(null);

export const useTenant = () => useContext(TenantContext);

export function TenantProvider({ value, children }) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantBootstrap() {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const hostname = window.location.hostname;
        const parts = hostname.split(".");
        const isDev = hostname === "localhost" || hostname.startsWith("127.");

        const isSubdomain = !isDev
          && parts.length >= 3
          && !RESERVED_SUBDOMAINS.has(parts[0])
          && hostname.endsWith(BASE_DOMAIN);

        const isCustomDomain = !isDev
          && !hostname.endsWith(BASE_DOMAIN)
          && parts.length >= 2;

        if (!isSubdomain && !isCustomDomain) {
          setTenant({ type: "main", branding: DEFAULT_BRANDING, features: {} });
          setLoading(false);
          return;
        }

        const body = isSubdomain ? { subdomain: parts[0] } : { domain: hostname };

        const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-tenant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        });

        if (res.status === 404) {
          setError("not_found");
          setLoading(false);
          setTimeout(() => {
            window.location.href = `https://bcms.${BASE_DOMAIN}`;
          }, 3000);
          return;
        }

        if (!res.ok) throw new Error(`resolve-tenant HTTP ${res.status}`);

        const { tenant: resolvedTenant } = await res.json();

        if (resolvedTenant?.branding) {
          const branding = { ...DEFAULT_BRANDING, ...resolvedTenant.branding };
          const root = document.documentElement;

          root.style.setProperty("--bcms-primary", branding.primaryColor);
          root.style.setProperty("--bcms-secondary", branding.secondaryColor);
          root.style.setProperty("--bcms-sidebar-bg", branding.sidebarBgColor);
          root.style.setProperty("--bcms-login-bg", branding.loginBgColor);

          if (branding.faviconUrl) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
              link = document.createElement("link");
              link.rel = "icon";
              document.head.appendChild(link);
            }
            link.href = branding.faviconUrl;
          }

          if (branding.companyDisplayName) {
            document.title = `${branding.companyDisplayName} · BCMS-Automate`;
          }
        }

        setTenant({
          type: "tenant",
          org_id: resolvedTenant.org_id,
          org_name: resolvedTenant.org_name,
          org_code: resolvedTenant.org_code,
          subdomain: resolvedTenant.subdomain,
          plan: resolvedTenant.plan,
          status: resolvedTenant.status,
          features: resolvedTenant.features ?? {},
          branding: { ...DEFAULT_BRANDING, ...(resolvedTenant.branding ?? {}) },
          max_seats: resolvedTenant.max_seats,
          timezone: resolvedTenant.timezone ?? "Asia/Bangkok",
        });
      } catch (error) {
        console.error("[TenantBootstrap]", error);
        setTenant({ type: "main", branding: DEFAULT_BRANDING, features: {} });
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  return { tenant, loading, error };
}

export function TenantLoadingScreen() {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const timer = setInterval(() => setDots((value) => (value.length >= 3 ? "." : `${value}.`)), 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0D1B3E 0%, #1565C0 100%)",
        fontFamily: "'Kanit', sans-serif",
        color: "#FFFFFF",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>BCMS-Automate</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 32 }}>
        กำลังโหลดระบบ{dots}
      </div>
      <div
        style={{
          width: 200,
          height: 3,
          borderRadius: 99,
          background: "rgba(255,255,255,0.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 99,
            background: "linear-gradient(90deg, #38BDF8, #1565C0)",
            animation: "bcmsLoad 1.8s ease-in-out infinite",
            width: "60%",
          }}
        />
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: [
            "@keyframes bcmsLoad {",
            "  0% { transform: translateX(-100%); }",
            "  50% { transform: translateX(0%); }",
            "  100% { transform: translateX(200%); }",
            "}",
          ].join("\n"),
        }}
      />
    </div>
  );
}

export function TenantNotFoundScreen() {
  const subdomain = window.location.hostname.split(".")[0];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#F0F6FF",
        fontFamily: "'Kanit', sans-serif",
      }}
    >
      <div style={{ fontSize: 48, fontWeight: 800, color: "#1565C0" }}>404</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0D1B3E", marginBottom: 8 }}>
        ไม่พบ Workspace นี้
      </div>
      <div style={{ fontSize: 14, color: "#64748B", marginBottom: 32, textAlign: "center" }}>
        <strong style={{ color: "#1565C0" }}>{subdomain}.{BASE_DOMAIN}</strong>
        <br />
        ไม่มีบัญชีที่ลงทะเบียนไว้ — กำลัง redirect ไปหน้าหลัก...
      </div>
      <a
        href={`https://bcms.${BASE_DOMAIN}`}
        style={{
          background: "#1565C0",
          color: "#FFFFFF",
          padding: "12px 28px",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        ไปหน้าหลัก
      </a>
    </div>
  );
}
