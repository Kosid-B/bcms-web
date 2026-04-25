import React, { useCallback, useEffect, useState } from "react";

import AuthModal from "./features/auth/AuthModal.jsx";
import PaymentModal from "./features/billing/PaymentModal.jsx";
import Dashboard from "./features/dashboard/Dashboard.jsx";
import WelcomePage from "./features/marketing/WelcomePage.jsx";
import { RealtimeUpgradeModal, SuccessModal } from "./features/shared/SuccessModal.jsx";
import { clearSession, supaLite } from "./lib/supa-lite.js";
import { FontLink } from "./ui/GlobalStyles.jsx";

export default function AppCore({ tenant }) {
  const [view, setView] = useState("welcome");
  const [authModal, setAuthModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [successModal, setSuccessModal] = useState(null);
  const [user, setUser] = useState(null);
  const [activePkg, setActivePkg] = useState("professional");
  const [payBilling, setPayBilling] = useState("monthly");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [rtUpgrade, setRtUpgrade] = useState(null);

  useEffect(() => {
    if (tenant?.type === "tenant") {
      // Tenant-specific boot path is preserved by the auth/dashboard flow.
    }
  }, [tenant]);

  const loadProfile = useCallback(async (userId, userEmail) => {
    const { data: profile } = await supaLite
      .from("profiles")
      .select("full_name, org_id, organizations(name), subscriptions(plan,status)")
      .eq("id", userId)
      .single();

    if (!profile) return null;

    const plan = profile?.subscriptions?.[0]?.plan ?? "free";
    return {
      id: userId,
      name: profile.full_name ?? userEmail?.split("@")[0] ?? "ผู้ใช้",
      email: userEmail,
      org: profile.organizations?.name ?? "—",
      plan,
      orgId: profile.org_id,
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (window.location.hash.includes("access_token")) {
        const result = await supaLite.auth.handleOAuthCallback();
        if (result?.user) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          const u = await loadProfile(result.user.id, result.user.email);
          if (u) {
            setUser(u);
            setActivePkg(u.plan !== "free" ? u.plan : "professional");
            setView("dashboard");
            setShowOnboarding(true);
          }
          return;
        }
      }

      const { data: { session } } = await supaLite.auth.getSession();
      if (!session?.user) return;

      const u = await loadProfile(session.user.id, session.user.email);
      if (u) {
        setUser(u);
        setActivePkg(u.plan !== "free" ? u.plan : "professional");
        setView("dashboard");
      }
    })();
  }, [loadProfile]);

  useEffect(() => {
    if (!user?.orgId) return;

    const orderCh = supaLite.channel("rt-orders-" + user.orgId)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "payment_orders",
        filter: `org_id=eq.${user.orgId}`,
      }, async (payload) => {
        const rec = payload.new ?? payload;
        if (rec.status === "confirmed") {
          const { data: sub } = await supaLite
            .from("subscriptions")
            .select("plan")
            .eq("org_id", user.orgId)
            .single();

          if (sub?.plan && sub.plan !== "free") {
            setActivePkg(sub.plan);
            setUser((current) => current ? { ...current, plan: sub.plan } : current);
            setRtUpgrade(sub.plan);
          }
        }
      })
      .subscribe();

    const subCh = supaLite.channel("rt-subs-" + user.orgId)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "subscriptions",
        filter: `org_id=eq.${user.orgId}`,
      }, (payload) => {
        const rec = payload.new ?? payload;
        if (rec.plan && rec.plan !== activePkg) {
          setActivePkg(rec.plan);
          setUser((current) => current ? { ...current, plan: rec.plan } : current);
        }
      })
      .subscribe();

    return () => {
      supaLite.removeChannel("rt-orders-" + user.orgId);
      supaLite.removeChannel("rt-subs-" + user.orgId);
      void orderCh;
      void subCh;
    };
  }, [activePkg, user?.orgId]);

  const handleSelectPkg = (pkgId, billing) => {
    setActivePkg(pkgId);
    setPayBilling(billing || "monthly");

    if (user) {
      setPayModal({ pkg: pkgId, billing: billing || "monthly" });
    } else {
      setAuthModal("register");
    }
  };

  const handleAuthSuccess = (u) => {
    setUser(u);
    setAuthModal(null);
    setView("dashboard");

    if (authModal === "register") {
      setShowOnboarding(true);
    }

    if (activePkg && activePkg !== "free" && authModal === "register") {
      setTimeout(() => setPayModal({ pkg: activePkg, billing: payBilling }), 400);
    }
  };

  const handlePaySuccess = (orderRef) => {
    setPayModal(null);
    setSuccessModal({ pkg: activePkg, orderRef: orderRef ?? null });
  };

  return (
    <>
      <FontLink />

      {view === "welcome" && (
        <WelcomePage
          onOpenAuth={(mode) => {
            if (user) {
              setView("dashboard");
              return;
            }
            setAuthModal(mode);
          }}
          onSelectPkg={handleSelectPkg}
        />
      )}

      {view === "dashboard" && user && (
        <Dashboard
          user={user}
          pkg={activePkg}
          onLogout={async () => {
            await supaLite.auth.signOut();
            clearSession();
            setUser(null);
            setView("welcome");
            setShowOnboarding(false);
          }}
          onUpgrade={() => setPayModal({ pkg: "professional", billing: "monthly" })}
          showOnboarding={showOnboarding}
          onOnboardingDone={() => setShowOnboarding(false)}
        />
      )}

      {authModal && (
        <AuthModal
          mode={authModal}
          selectedPkg={activePkg}
          onClose={() => setAuthModal(null)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {payModal && user && (
        <PaymentModal
          pkgId={payModal.pkg}
          billing={payModal.billing || "monthly"}
          user={user}
          onClose={() => setPayModal(null)}
          onSuccess={handlePaySuccess}
        />
      )}

      {successModal && (
        <SuccessModal
          pkg={successModal?.pkg ?? successModal}
          onContinue={() => {
            setSuccessModal(null);
            setView("dashboard");
          }}
        />
      )}

      {rtUpgrade && (
        <RealtimeUpgradeModal
          newPlan={rtUpgrade}
          onDismiss={() => {
            setRtUpgrade(null);
            setView("dashboard");
          }}
        />
      )}
    </>
  );
}
