import React, { useCallback, useEffect, useState } from "react";

import AuthModal from "./features/auth/AuthModal.jsx";
import PaymentModal from "./features/billing/PaymentModal.jsx";
import Dashboard from "./features/dashboard/Dashboard.jsx";
import ContinuityStrategyPage from "./features/organization/ContinuityStrategyPage.jsx";
import OrganizationFeaturePage from "./features/organization/OrganizationFeaturePage.jsx";
import PersonnelContinuityPage from "./features/personnel/PersonnelContinuityPage.jsx";
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
  const [mustChoosePlan, setMustChoosePlan] = useState(false);

  useEffect(() => {
    if (tenant?.type === "tenant") {
      // Tenant-specific boot path is preserved by the auth/dashboard flow.
    }
  }, [tenant]);

  const canAccessApp = useCallback((sub, orgId) => {
    // New signup race-condition: if subscription row is not ready yet, allow entry.
    if (!sub || (typeof sub === "object" && Object.keys(sub).length === 0)) return true;
    if (orgId === "00000000-0000-0000-0000-000000000000") return false;

    const status = String(sub.status || "").toLowerCase();
    const plan = String(sub.plan || "free").toLowerCase();
    const now = Date.now();
    const trialEndsAt = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : null;
    const periodEndsAt = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;

    if (status === "active") return true;

    if (plan === "free" && status === "trialing") {
      if (!trialEndsAt) return true;
      return trialEndsAt > now;
    }

    if (status === "past_due" && periodEndsAt && periodEndsAt > now) return true;
    return false;
  }, []);

  const loadProfile = useCallback(async (userId, userEmail) => {
    const { data: profile } = await supaLite
      .from("profiles")
      .select("full_name, role, access_level, department, org_id, organizations(name), subscriptions(plan,status,trial_ends_at,current_period_end)")
      .eq("id", userId)
      .single();

    if (!profile) return null;

    const sub = profile?.subscriptions?.[0] || null;
    const plan = sub.plan ?? "free";
    const status = sub.status ?? "trialing";
    const trialEndsAt = sub.trial_ends_at;

    const currentPeriodEnd = sub.current_period_end ?? null;
    const canAccess = canAccessApp(
      sub ?? { plan: "free", status: "trialing", trial_ends_at: null },
      profile.org_id,
    );

    return {
      id: userId,
      name: profile.full_name ?? userEmail?.split("@")[0] ?? "ผู้ใช้",
      email: userEmail,
      org: profile.organizations?.name ?? "—",
      plan,
      subscriptionStatus: status,
      trialEndsAt,
      currentPeriodEnd,
      canAccess,
      orgId: profile.org_id,
      role: profile.role ?? "member",
      accessLevel: profile.access_level ?? "org",
      department: profile.department ?? null,
    };
  }, [canAccessApp]);

  useEffect(() => {
    (async () => {
      // Restore existing session
      const { data: { session } } = await supaLite.auth.getSession();
      const currentSession = session;
      
      if (!currentSession?.user && !currentSession?.access_token) return;

      // Extract user ID from session if user object is missing (common in OAuth hash)
      let userId = currentSession.user?.id;
      let userEmail = currentSession.user?.email;

      if (!userId && currentSession.access_token) {
        // If we only have the token, we can get the user info from Supabase
        const { data: { user: authUser } } = await supaLite.auth.getUser();
        userId = authUser?.id;
        userEmail = authUser?.email;
      }

      if (!userId) return;

      const u = await loadProfile(userId, userEmail);
      if (u) {
        setUser(u);
        setActivePkg(u.plan !== "free" ? u.plan : "professional");
        
        const blocked = !u.canAccess;
        setMustChoosePlan(blocked);
        setView(blocked ? "plan_gate" : "dashboard");
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
          if (rec.plan !== "free") {
            setMustChoosePlan(false);
            setView("dashboard");
          }
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

    const fallbackAccess =
      u.subscriptionStatus === "active" ||
      (u.plan === "free" &&
        u.subscriptionStatus === "trialing" &&
        (!u.trialEndsAt || new Date(u.trialEndsAt) > new Date()));
    const blocked = !(u.canAccess ?? fallbackAccess);

    // New signup: go straight to dashboard in free-trial mode.
    if (authModal === "register") {
      setMustChoosePlan(false);
      setView("dashboard");
      setShowOnboarding(true);
      return;
    }

    // Existing login: apply subscription gate as normal.
    setMustChoosePlan(blocked);
    setView(blocked ? "plan_gate" : "dashboard");
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
          onStartFreeTrial={() => {
            if (user) {
              setMustChoosePlan(false);
              setView("dashboard");
              return;
            }
            setAuthModal("register");
          }}
          onSelectPkg={handleSelectPkg}
        />
      )}

      {user && !mustChoosePlan && (
        <>
          <div
            style={{
              position: "fixed",
              top: 84,
              right: 14,
              zIndex: 32,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: "rgba(255,255,255,0.95)",
              border: "1px solid #dbe5f5",
              borderRadius: 12,
              padding: 8,
              boxShadow: "0 8px 24px rgba(14,38,74,0.15)",
            }}
          >
            <button
              type="button"
              onClick={() => setView("dashboard")}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 10px",
                background: view === "dashboard" ? "#1565c0" : "#eef4ff",
                color: view === "dashboard" ? "#fff" : "#17335c",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setView("personnel_continuity")}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 10px",
                background: view === "personnel_continuity" ? "#1565c0" : "#eef4ff",
                color: view === "personnel_continuity" ? "#fff" : "#17335c",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Personnel
            </button>
            <button
              type="button"
              onClick={() => setView("organization_feature")}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 10px",
                background: view === "organization_feature" ? "#1565c0" : "#eef4ff",
                color: view === "organization_feature" ? "#fff" : "#17335c",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Organization
            </button>
            <button
              type="button"
              onClick={() => setView("continuity_strategy")}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 10px",
                background: view === "continuity_strategy" ? "#1565c0" : "#eef4ff",
                color: view === "continuity_strategy" ? "#fff" : "#17335c",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Strategy
            </button>
          </div>

          {view === "dashboard" && (
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
        </>
      )}

      {view === "personnel_continuity" && user && !mustChoosePlan && (
        <PersonnelContinuityPage
          user={user}
          onBack={() => setView("dashboard")}
        />
      )}

      {view === "organization_feature" && user && !mustChoosePlan && (
        <OrganizationFeaturePage
          user={user}
          onBack={() => setView("dashboard")}
        />
      )}

      {view === "continuity_strategy" && user && !mustChoosePlan && (
        <ContinuityStrategyPage
          user={user}
          onBack={() => setView("dashboard")}
        />
      )}

      {view === "plan_gate" && user && (
        <PlanGate
          user={user}
          selectedPkg={activePkg}
          billing={payBilling}
          onChangePkg={setActivePkg}
          onChangeBilling={setPayBilling}
          onContinue={() => setPayModal({ pkg: activePkg, billing: payBilling })}
          onStartFreeTrial={() => {
            setMustChoosePlan(false);
            setView("dashboard");
            setShowOnboarding(true);
          }}
          onLogout={async () => {
            await supaLite.auth.signOut();
            clearSession();
            setUser(null);
            setView("welcome");
            setMustChoosePlan(false);
          }}
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

function PlanGate({
  user,
  selectedPkg,
  billing,
  onChangePkg,
  onChangeBilling,
  onContinue,
  onStartFreeTrial,
  onLogout,
}) {
  const packages = [
    { id: "starter", name: "Starter", monthly: 2900, annual: 2320 },
    { id: "professional", name: "Professional", monthly: 7900, annual: 6320 },
    { id: "enterprise", name: "Enterprise", monthly: 19900, annual: 15920 },
  ];

  const nowTs = Date.now();
  const trialEndTs = user?.trialEndsAt ? new Date(user.trialEndsAt).getTime() : null;
  const trialDaysLeft = trialEndTs ? Math.max(0, Math.ceil((trialEndTs - nowTs) / (1000 * 60 * 60 * 24))) : 14;
  const trialLabel = trialDaysLeft > 0 ? `เหลือทดลองใช้ฟรีอีก ${trialDaysLeft} วัน` : "ทดลองใช้ฟรีหมดอายุแล้ว";

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f5f8ff" }}>
      <div style={{ width: "100%", maxWidth: 860, background: "#fff", border: "1px solid #dbe5f5", borderRadius: 16, padding: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24 }}>เลือกแพ็กเกจก่อนเริ่มใช้งาน</h2>
        <p style={{ marginTop: 8, color: "#4b5b78" }}>
          เริ่มใช้งานได้ทันทีด้วยแพ็กเกจฟรี 14 วัน หรือเลือกแพ็กเกจรายเดือน/รายปีเพื่อใช้งานต่อเนื่อง
        </p>

        <div style={{ marginTop: 12, marginBottom: 14, border: "1px solid #cde0ff", borderRadius: 12, background: "#eef5ff", padding: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, color: "#10294d", fontSize: 16 }}>ทดลองใช้ฟรี 14 วัน</div>
            <div style={{ color: "#35527a", marginTop: 4, fontSize: 13 }}>{trialLabel}</div>
          </div>
          <button
            type="button"
            onClick={onStartFreeTrial}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #1565c0", background: "#1565c0", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            เริ่มใช้ฟรี 14 วัน
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => onChangeBilling("monthly")}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #b8caeb", background: billing === "monthly" ? "#1565c0" : "#fff", color: billing === "monthly" ? "#fff" : "#17335c", cursor: "pointer" }}
          >
            รายเดือน
          </button>
          <button
            type="button"
            onClick={() => onChangeBilling("annual")}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #b8caeb", background: billing === "annual" ? "#1565c0" : "#fff", color: billing === "annual" ? "#fff" : "#17335c", cursor: "pointer" }}
          >
            รายปี
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {packages.map((pkg) => {
            const selected = selectedPkg === pkg.id;
            const price = billing === "annual" ? pkg.annual : pkg.monthly;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => onChangePkg(pkg.id)}
                style={{ textAlign: "left", padding: 14, borderRadius: 12, border: selected ? "2px solid #1565c0" : "1px solid #dbe5f5", background: selected ? "#eef5ff" : "#fff", cursor: "pointer" }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: "#10294d" }}>{pkg.name}</div>
                <div style={{ fontSize: 22, marginTop: 8, fontWeight: 800, color: "#1565c0" }}>
                  ฿{price.toLocaleString()}
                  <span style={{ fontSize: 12, color: "#4b5b78", marginLeft: 6 }}>{billing === "annual" ? "/เดือน (จ่ายรายปี)" : "/เดือน"}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button type="button" onClick={onLogout} style={{ background: "transparent", border: "none", color: "#52617c", cursor: "pointer" }}>
            ออกจากระบบ
          </button>
          <button
            type="button"
            onClick={onContinue}
            style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#1565c0", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            ดำเนินการชำระเงิน
          </button>
        </div>
      </div>
    </div>
  );
}
