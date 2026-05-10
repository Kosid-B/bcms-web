import React, { useEffect, useMemo, useState } from "react";

import { supaLite } from "../../lib/supa-lite.js";

const card = {
  background: "#fff",
  border: "1px solid #dbe5f5",
  borderRadius: 14,
  padding: 16,
};

export default function OrganizationFeaturePage({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [org, setOrg] = useState(null);
  const [branding, setBranding] = useState(null);
  const [stats, setStats] = useState({ profiles: 0, units: 0, roles: 0 });
  const [departments, setDepartments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [deptForm, setDeptForm] = useState({ dept_code: "", dept_name: "" });

  const isOrgLevel = useMemo(
    () => (user?.accessLevel ?? "org") === "org" || ["owner", "admin"].includes((user?.role ?? "").toLowerCase()),
    [user?.accessLevel, user?.role]
  );

  const [form, setForm] = useState({
    name: "",
    timezone: "Asia/Bangkok",
    billing_email: "",
    primary_color: "#1565C0",
    company_name: "",
    tagline: "",
  });

  const load = async () => {
    if (!user?.orgId) return;
    setLoading(true);
    const [o, b, p, u, r, d, a] = await Promise.all([
      supaLite.from("organizations").select("id,name,timezone,billing_email,subdomain,custom_domain,plan,status").eq("id", user.orgId).maybeSingle(),
      supaLite.from("org_branding").select("org_id,primary_color,company_name,tagline").eq("org_id", user.orgId).maybeSingle(),
      supaLite.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", user.orgId),
      supaLite.from("org_units").select("id", { count: "exact", head: true }).eq("org_id", user.orgId),
      supaLite.from("personnel_roles").select("id", { count: "exact", head: true }).eq("org_id", user.orgId),
      supaLite.from("org_departments").select("id,dept_code,dept_name,is_active,created_at").eq("org_id", user.orgId).order("dept_code", { ascending: true }),
      supaLite.from("org_audit_logs").select("id,action,target_type,target_id,details,created_at").eq("org_id", user.orgId).order("created_at", { ascending: false }).limit(20),
    ]);

    setOrg(o?.data ?? null);
    setBranding(b?.data ?? null);
    setStats({
      profiles: p?.count ?? 0,
      units: u?.count ?? 0,
      roles: r?.count ?? 0,
    });
    setDepartments(d?.data ?? []);
    setAuditLogs(a?.data ?? []);

    const orgData = o?.data ?? {};
    const brandData = b?.data ?? {};
    setForm({
      name: orgData.name ?? "",
      timezone: orgData.timezone ?? "Asia/Bangkok",
      billing_email: orgData.billing_email ?? "",
      primary_color: brandData.primary_color ?? "#1565C0",
      company_name: brandData.company_name ?? "",
      tagline: brandData.tagline ?? "",
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.orgId]);

  const save = async () => {
    if (!isOrgLevel || !user?.orgId) return;
    setSaving(true);
    const [orgRes, brandRes] = await Promise.all([
      supaLite.from("organizations").update({
        name: form.name.trim(),
        timezone: form.timezone.trim() || "Asia/Bangkok",
        billing_email: form.billing_email.trim() || null,
      }).eq("id", user.orgId),
      supaLite.from("org_branding").upsert({
        org_id: user.orgId,
        primary_color: form.primary_color || "#1565C0",
        company_name: form.company_name.trim() || null,
        tagline: form.tagline.trim() || null,
      }, { onConflict: "org_id" }),
      supaLite.from("org_audit_logs").insert({
        org_id: user.orgId,
        actor_id: user.id,
        action: "organization_updated",
        target_type: "organization",
        target_id: user.orgId,
        details: { name: form.name, timezone: form.timezone, billing_email: form.billing_email || null },
      }),
    ]);
    setSaving(false);
    if (orgRes.error || brandRes.error) {
      alert(`บันทึกไม่สำเร็จ: ${orgRes.error?.message || brandRes.error?.message}`);
      return;
    }
    await load();
    alert("บันทึก Organization สำเร็จ");
  };

  const createDepartment = async () => {
    if (!isOrgLevel) return;
    if (!deptForm.dept_code.trim() || !deptForm.dept_name.trim()) return;
    setSaving(true);
    const code = deptForm.dept_code.trim().toUpperCase();
    const name = deptForm.dept_name.trim();
    const [dRes, lRes] = await Promise.all([
      supaLite.from("org_departments").upsert({
        org_id: user.orgId,
        dept_code: code,
        dept_name: name,
        is_active: true,
        created_by: user.id,
      }, { onConflict: "org_id,dept_code" }),
      supaLite.from("org_audit_logs").insert({
        org_id: user.orgId,
        actor_id: user.id,
        action: "department_upserted",
        target_type: "department",
        target_id: code,
        details: { dept_code: code, dept_name: name },
      }),
    ]);
    setSaving(false);
    if (dRes.error || lRes.error) {
      alert(`บันทึกแผนกไม่สำเร็จ: ${dRes.error?.message || lRes.error?.message}`);
      return;
    }
    setDeptForm({ dept_code: "", dept_name: "" });
    await load();
  };

  const toggleDepartment = async (dept) => {
    if (!isOrgLevel) return;
    setSaving(true);
    const [dRes, lRes] = await Promise.all([
      supaLite.from("org_departments").update({ is_active: !dept.is_active }).eq("id", dept.id),
      supaLite.from("org_audit_logs").insert({
        org_id: user.orgId,
        actor_id: user.id,
        action: dept.is_active ? "department_deactivated" : "department_activated",
        target_type: "department",
        target_id: dept.dept_code,
        details: { dept_code: dept.dept_code, dept_name: dept.dept_name, is_active: !dept.is_active },
      }),
    ]);
    setSaving(false);
    if (dRes.error || lRes.error) {
      alert(`อัปเดตแผนกไม่สำเร็จ: ${dRes.error?.message || lRes.error?.message}`);
      return;
    }
    await load();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f8ff", padding: 20 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, color: "#10294d" }}>Organization Feature</h2>
            <div style={{ fontSize: 13, color: "#4b5b78", marginTop: 4 }}>ศูนย์กลางข้อมูลองค์กรและขอบเขต RBAC</div>
          </div>
          <button type="button" onClick={onBack} style={{ border: "1px solid #c7d7f2", background: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
            กลับ Dashboard
          </button>
        </div>

        {loading ? (
          <div style={card}>กำลังโหลด...</div>
        ) : (
          <>
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                <Metric title="Plan" value={(org?.plan ?? "free").toUpperCase()} />
                <Metric title="Status" value={(org?.status ?? "trialing").toUpperCase()} />
                <Metric title="Users" value={String(stats.profiles)} />
                <Metric title="Units / Roles" value={`${stats.units} / ${stats.roles}`} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={card}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>Organization Profile</h3>
                <Field label="Organization Name">
                  <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                </Field>
                <Field label="Timezone">
                  <input value={form.timezone} onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                </Field>
                <Field label="Billing Email">
                  <input value={form.billing_email} onChange={(e) => setForm((s) => ({ ...s, billing_email: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                </Field>
                <Field label="Subdomain">
                  <input value={org?.subdomain ?? ""} disabled style={inputStyle()} />
                </Field>
                <Field label="Custom Domain">
                  <input value={org?.custom_domain ?? ""} disabled style={inputStyle()} />
                </Field>
              </div>

              <div style={card}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>Branding</h3>
                <Field label="Primary Color">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={form.primary_color} onChange={(e) => setForm((s) => ({ ...s, primary_color: e.target.value }))} disabled={!isOrgLevel} />
                    <input value={form.primary_color} onChange={(e) => setForm((s) => ({ ...s, primary_color: e.target.value }))} disabled={!isOrgLevel} style={{ ...inputStyle(), flex: 1 }} />
                  </div>
                </Field>
                <Field label="Company Name">
                  <input value={form.company_name} onChange={(e) => setForm((s) => ({ ...s, company_name: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                </Field>
                <Field label="Tagline">
                  <input value={form.tagline} onChange={(e) => setForm((s) => ({ ...s, tagline: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                </Field>

                <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid #e3ecfb", background: "#f5f9ff" }}>
                  <div style={{ fontSize: 12, color: "#5a7094", marginBottom: 6 }}>RBAC Scope</div>
                  <div style={{ fontSize: 13, color: "#15335c" }}>
                    Role: <strong>{(user?.role ?? "member").toUpperCase()}</strong> · Access: <strong>{(user?.accessLevel ?? "org").toUpperCase()}</strong> · Department: <strong>{user?.department || "ALL"}</strong>
                  </div>
                  {!isOrgLevel && (
                    <div style={{ fontSize: 12, color: "#9c5f00", marginTop: 6 }}>
                      สิทธิ์ระดับหน่วยงานดูได้อย่างเดียว (read-only)
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={save}
                  disabled={!isOrgLevel || saving}
                  style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, border: "none", background: "#1565c0", color: "#fff", cursor: isOrgLevel ? "pointer" : "not-allowed", opacity: isOrgLevel ? 1 : 0.6 }}
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก Organization"}
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div style={card}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>Department Taxonomy</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8, marginBottom: 10 }}>
                  <input placeholder="DEPT_CODE" value={deptForm.dept_code} onChange={(e) => setDeptForm((s) => ({ ...s, dept_code: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                  <input placeholder="Department Name" value={deptForm.dept_name} onChange={(e) => setDeptForm((s) => ({ ...s, dept_name: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                  <button type="button" onClick={createDepartment} disabled={!isOrgLevel || saving} style={{ border: "none", borderRadius: 8, background: "#1565c0", color: "#fff", padding: "8px 10px", cursor: "pointer" }}>
                    Add
                  </button>
                </div>
                {departments.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#5a7094" }}>ยังไม่มีแผนกกลาง</div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {departments.map((d) => (
                      <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8, alignItems: "center", background: "#f5f9ff", border: "1px solid #e3ecfb", borderRadius: 8, padding: 8 }}>
                        <strong style={{ fontSize: 12 }}>{d.dept_code}</strong>
                        <span style={{ fontSize: 12, color: "#15335c" }}>{d.dept_name}</span>
                        <button
                          type="button"
                          onClick={() => toggleDepartment(d)}
                          disabled={!isOrgLevel || saving}
                          style={{ border: "none", borderRadius: 8, padding: "6px 8px", background: d.is_active ? "#fef2e6" : "#e7f7ef", color: d.is_active ? "#a15b00" : "#0b875b", cursor: "pointer" }}
                        >
                          {d.is_active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={card}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>Organization Audit Log</h3>
                {auditLogs.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#5a7094" }}>ยังไม่มีประวัติการแก้ไข</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                    {auditLogs.map((log) => (
                      <div key={log.id} style={{ background: "#f8fbff", border: "1px solid #e3ecfb", borderRadius: 8, padding: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#16335c" }}>{log.action}</div>
                        <div style={{ fontSize: 11, color: "#5a7094" }}>{log.target_type} · {log.target_id || "-"}</div>
                        <div style={{ fontSize: 10, color: "#7a8da9", marginTop: 4 }}>{new Date(log.created_at).toLocaleString("th-TH")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ title, value }) {
  return (
    <div style={{ background: "#f0f6ff", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 10, color: "#5a7094" }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#15335c" }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "#425777", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function inputStyle() {
  return { width: "100%", padding: 8, border: "1px solid #c7d7f2", borderRadius: 8, boxSizing: "border-box" };
}
