import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { subdomain, domain } = await req.json();
    if (!subdomain && !domain) {
      return json({ error: "subdomain_or_domain_required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const targetDomain = domain?.toLowerCase?.();

    const buildOrgQuery = () => admin
      .from("organizations")
      .select(`
        id,
        name,
        org_code,
        subdomain,
        custom_domain,
        status,
        timezone,
        max_seats,
        features,
        org_branding (
          primary_color,
          company_name,
          tagline,
          logo_url,
          favicon_url,
          custom_domain,
          footer_text
        ),
        subscriptions (
          plan,
          status,
          billing,
          current_period_end
        )
      `)
      .limit(1);

    let data = null;

    if (subdomain) {
      const result = await buildOrgQuery()
        .eq("subdomain", String(subdomain).toLowerCase())
        .maybeSingle();
      if (result.error) throw result.error;
      data = result.data;
    } else {
      const directResult = await buildOrgQuery()
        .eq("custom_domain", targetDomain)
        .maybeSingle();
      if (directResult.error) throw directResult.error;
      data = directResult.data;

      if (!data) {
        const brandingResult = await admin
          .from("org_branding")
          .select("org_id")
          .eq("custom_domain", targetDomain)
          .maybeSingle();

        if (brandingResult.error) throw brandingResult.error;
        if (brandingResult.data?.org_id) {
          const orgResult = await buildOrgQuery()
            .eq("id", brandingResult.data.org_id)
            .maybeSingle();
          if (orgResult.error) throw orgResult.error;
          data = orgResult.data;
        }
      }
    }
    if (!data) {
      return json({ error: "not_found" }, { status: 404 });
    }

    const activeSubscription = data.subscriptions?.[0] ?? {
      plan: "free",
      status: "trialing",
      billing: "monthly",
      current_period_end: null,
    };
    const brandingRow = data.org_branding?.[0] ?? {};

    return json({
      tenant: {
        org_id: data.id,
        org_name: data.name,
        org_code: data.org_code,
        subdomain: data.subdomain,
        domain: brandingRow.custom_domain ?? data.custom_domain,
        plan: activeSubscription.plan,
        status: activeSubscription.status ?? data.status,
        features: data.features ?? {},
        max_seats: data.max_seats ?? 3,
        timezone: data.timezone ?? "Asia/Bangkok",
        branding: {
          primaryColor: brandingRow.primary_color ?? "#1565C0",
          secondaryColor: brandingRow.primary_color ?? "#0284C7",
          companyDisplayName: brandingRow.company_name ?? data.name,
          logoUrl: brandingRow.logo_url ?? null,
          faviconUrl: brandingRow.favicon_url ?? null,
          loginBgColor: "#F0F6FF",
          sidebarBgColor: "#0D1B3E",
          footerText: brandingRow.footer_text ?? "",
          tagline: brandingRow.tagline ?? "",
        },
      },
    });
  } catch (error) {
    return json({ error: error.message ?? "resolve_tenant_failed" }, { status: 500 });
  }
});
