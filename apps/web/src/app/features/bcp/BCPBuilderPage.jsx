import { useCallback, useEffect, useState } from "react";
import { supaLite } from "../../lib/supa-lite.js";

const CATEGORIES = [
  { id: "platform",  label: "Platform / Infrastructure" },
  { id: "people",    label: "บุคลากร" },
  { id: "security",  label: "Security" },
  { id: "data",      label: "ข้อมูล / Database" },
  { id: "payment",   label: "การเงิน / Payment" },
  { id: "legal",     label: "กฎหมาย / Compliance" },
  { id: "other",     label: "อื่นๆ" },
];

const CHANNELS = ["email", "line", "phone", "slack", "sms", "in-person"];

const scoreColor = (s) => s >= 15 ? "#C53030" : s >= 9 ? "#C05621" : "#276749";
const scoreLabel = (s) => s >= 15 ? "HIGH" : s >= 9 ? "MED" : "LOW";

const box = { background: "#fff", border: "1px solid #dbe5f5", borderRadius: 14, padding: 16 };
const mkBtn = (primary) => ({
  padding: primary ? "8px 16px" : "6px 12px",
  borderRadius: 8, border: primary ? "none" : "1px solid #dbe5f5",
  background: primary ? "#1565C0" : "#fff",
  color: primary ? "#fff" : "#425777",
  fontWeight: primary ? 700 : 400, cursor: "pointer", fontSize: 13,
});
const field = { display: "block", width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe5f5", fontSize: 13, marginTop: 4, boxSizing: "border-box" };
const Label = ({ children }) => <label style={{ fontSize: 12, color: "#52617c", fontWeight: 600 }}>{children}</label>;

// Action item definitions
const ACTION_ITEMS = [
  { key: "backup_developer",  icon: "🧑‍💻", label: "กำหนด Backup Developer",       desc: "ระบุชื่อบุคคลที่ช่วย fix critical bug ได้ถ้าคุณไม่พร้อม",          canAutoComplete: false },
  { key: "supabase_backup",   icon: "🗄️", label: "ตรวจสอบ Supabase Backup",       desc: "Free plan: daily backup 7 วัน · Pro plan: 30 วัน + PITR",          canAutoComplete: true  },
  { key: "password_manager",  icon: "🔑", label: "เก็บ Credentials ใน Password Mgr", desc: "ย้าย API keys, tokens ทั้งหมดไป 1Password หรือ Bitwarden",           canAutoComplete: false },
  { key: "database_export",   icon: "📦", label: "Export BCP Data (JSON Backup)",  desc: "ดาวน์โหลดข้อมูล BCP ทั้งหมดเป็น JSON เก็บไว้ offline",              canAutoComplete: true  },
  { key: "bcp_offline_export",icon: "🖨️", label: "Export BCP เป็น PDF offline",   desc: "พิมพ์หรือบันทึก BCP เก็บนอก platform — สำคัญมากถ้า platform ล่ม",  canAutoComplete: true  },
  { key: "tabletop_exercise", icon: "🏋️", label: "Schedule Tabletop Exercise",    desc: "จำลองสถานการณ์ Platform Outage กับทีม — ISO 22301 Clause 8.5",      canAutoComplete: true  },
];

function ActionList({ label, items, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <span style={{ color: "#1565C0", fontWeight: 700, fontSize: 12, minWidth: 20, paddingTop: 8 }}>{i + 1}</span>
          <input value={item} onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
            style={{ ...field, marginTop: 0, flex: 1 }} placeholder={`ขั้นตอนที่ ${i + 1}...`} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
            style={{ ...mkBtn(false), padding: "4px 8px", color: "#C53030", border: "1px solid #FECACA" }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])}
        style={{ ...mkBtn(false), marginTop: 8, fontSize: 12 }}>+ เพิ่มขั้นตอน</button>
    </div>
  );
}

// ── Break Glass Modal ──
function BreakGlassModal({ onClose, contacts, procs, user }) {
  const top3 = [...procs].sort((a, b) => {
    const sev = { critical: 3, major: 2, minor: 1 };
    return (sev[b.severity] || 0) - (sev[a.severity] || 0);
  }).slice(0, 4);

  const printDoc = () => window.print();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, overflow: "auto", padding: 20 }}>
      <div id="break-glass-doc" style={{ maxWidth: 800, margin: "0 auto", background: "#fff", borderRadius: 12, overflow: "hidden" }}>
        {/* Print styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #break-glass-doc, #break-glass-doc * { visibility: visible; }
            #break-glass-doc { position: fixed; inset: 0; margin: 0; border-radius: 0; }
            .no-print { display: none !important; }
          }
        `}</style>

        {/* Header */}
        <div style={{ background: "#C53030", padding: "16px 24px", color: "#fff" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>🚨 BREAK GLASS DOCUMENT</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            เอกสารฉุกเฉิน — เปิดเมื่อเกิดวิกฤตเท่านั้น · สร้าง: {new Date().toLocaleDateString("th-TH")}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
            เก็บสำเนาใน Google Drive + Local Drive — อย่าเก็บไว้ใน Platform เท่านั้น
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Section 1: Critical Access */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, color: "#C53030", borderBottom: "2px solid #FECACA", paddingBottom: 6, marginBottom: 12 }}>
              🔑 Section 1: Critical Access Information
            </h2>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { label: "Platform URL", value: "https://bcms-web.vercel.app" },
                { label: "Vercel Login", value: user?.email || "buffkosid@gmail.com" },
                { label: "Vercel Password", value: "→ ดูใน 1Password vault 'BCMS'" },
                { label: "Supabase Project ID", value: "pbtngbwbieskvmutshbz" },
                { label: "Supabase Dashboard", value: "https://supabase.com/dashboard/project/pbtngbwbieskvmutshbz" },
                { label: "GitHub Repository", value: "→ ดูใน 1Password vault 'BCMS'" },
                { label: "Deploy Command", value: 'cd "D:\\BCMS SaaS" && npx vercel --prod' },
                { label: "Force Deploy (clear cache)", value: 'cd "D:\\BCMS SaaS" && npx vercel --prod --force' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "180px 1fr", background: "#f9fafc", borderRadius: 6, overflow: "hidden", border: "1px solid #e5ebf5" }}>
                  <div style={{ background: "#eef3ff", padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#1565C0" }}>{label}</div>
                  <div style={{ padding: "6px 10px", fontSize: 12, color: "#10294d", fontFamily: "monospace" }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff8e1", border: "1px solid #ffd54f", borderRadius: 8, padding: "8px 12px", marginTop: 10, fontSize: 12, color: "#6D4C41" }}>
              ⚠️ Critical files: <code style={{ fontFamily: "monospace", background: "#fdf3d0", padding: "1px 4px", borderRadius: 4 }}>AppCore.jsx</code> · <code style={{ fontFamily: "monospace", background: "#fdf3d0", padding: "1px 4px", borderRadius: 4 }}>supa-lite.js</code> · <code style={{ fontFamily: "monospace", background: "#fdf3d0", padding: "1px 4px", borderRadius: 4 }}>OrganizationFeaturePage.jsx</code>
            </div>
          </div>

          {/* Section 2: Emergency Contacts */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, color: "#C53030", borderBottom: "2px solid #FECACA", paddingBottom: 6, marginBottom: 12 }}>
              📞 Section 2: Emergency Contacts
            </h2>
            {contacts.length === 0 ? (
              <div style={{ background: "#fff8e1", border: "1px solid #ffd54f", borderRadius: 8, padding: 12, fontSize: 12, color: "#6D4C41" }}>
                ⚠️ ยังไม่มี Emergency Contacts — กลับไป Phase 4 แล้วเพิ่ม Contact ก่อน
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f5f8ff" }}>
                    {["ชื่อ", "บทบาท", "โทรศัพท์", "Email", "เรียกเมื่อ"].map(h => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: "left", borderBottom: "2px solid #dbe5f5", color: "#52617c", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #eef3ff" }}>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: "6px 10px", color: "#1565C0" }}>{c.role}</td>
                      <td style={{ padding: "6px 10px" }}>{c.phone || "—"}</td>
                      <td style={{ padding: "6px 10px" }}>{c.email || "—"}</td>
                      <td style={{ padding: "6px 10px", color: "#52617c" }}>{c.when_to_contact || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Section 3: Top Recovery Steps */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, color: "#C53030", borderBottom: "2px solid #FECACA", paddingBottom: 6, marginBottom: 12 }}>
              🔧 Section 3: Top Recovery Procedures
            </h2>
            {top3.length === 0 ? (
              <div style={{ background: "#fff8e1", border: "1px solid #ffd54f", borderRadius: 8, padding: 12, fontSize: 12, color: "#6D4C41" }}>
                ⚠️ ยังไม่มี Recovery Procedures — กลับไป Phase 2 แล้วเพิ่มก่อน
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {top3.map((p) => {
                  const sevColor = p.severity === "critical" ? "#C53030" : p.severity === "major" ? "#C05621" : "#276749";
                  return (
                    <div key={p.id} style={{ border: `1px solid ${sevColor}`, borderLeft: `4px solid ${sevColor}`, borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{p.risk_name}</span>
                        <span style={{ background: sevColor, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                          {p.severity.toUpperCase()} · RTO: {p.rto_hours}h
                        </span>
                      </div>
                      {p.immediate_actions?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: "#52617c", fontWeight: 600, marginBottom: 3 }}>Immediate Actions:</div>
                          {p.immediate_actions.map((a, i) => (
                            <div key={i} style={{ fontSize: 12, color: "#425777", padding: "2px 0" }}>
                              <span style={{ color: sevColor, fontWeight: 700, marginRight: 6 }}>{i + 1}.</span>{a}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Backup Status */}
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, color: "#C53030", borderBottom: "2px solid #FECACA", paddingBottom: 6, marginBottom: 12 }}>
              🗄️ Section 4: Database Backup
            </h2>
            <div style={{ display: "grid", gap: 6 }}>
              {[
                { label: "Supabase Backup URL", value: "https://supabase.com/dashboard/project/pbtngbwbieskvmutshbz/database/backups" },
                { label: "Backup Type", value: "Free plan: daily snapshot 7 วัน · Pro plan: PITR 30 วัน" },
                { label: "Last JSON Export", value: "→ ดูใน Google Drive / BCMS-BCP-Backup folder" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "180px 1fr", background: "#f9fafc", borderRadius: 6, overflow: "hidden", border: "1px solid #e5ebf5" }}>
                  <div style={{ background: "#f0fdf4", padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#166534" }}>{label}</div>
                  <div style={{ padding: "6px 10px", fontSize: 12, color: "#10294d" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="no-print" style={{ padding: "14px 24px", borderTop: "1px solid #dbe5f5", display: "flex", gap: 10, justifyContent: "flex-end", background: "#f9fafc" }}>
          <button type="button" onClick={onClose} style={mkBtn(false)}>✕ ปิด</button>
          <button type="button" onClick={printDoc}
            style={{ ...mkBtn(true), background: "#C53030" }}>
            🖨️ Print / บันทึก PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BCPBuilderPage({ user }) {
  const orgId  = user?.orgId;
  const isAdmin = ["owner", "admin"].includes(user?.role ?? "");

  const [tab,         setTab]         = useState("risk");
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [flashMsg,    setFlashMsg]    = useState(null);
  const [showBG,      setShowBG]      = useState(false);

  const [risks,       setRisks]       = useState([]);
  const [procs,       setProcs]       = useState([]);
  const [comms,       setComms]       = useState([]);
  const [contacts,    setContacts]    = useState([]);
  const [actionItems, setActionItems] = useState({});

  // Risk form
  const emptyRisk = () => ({ name: "", category: "platform", likelihood: 3, impact: 3, mtpd_hours: "", notes: "" });
  const [riskForm,     setRiskForm]     = useState(emptyRisk());
  const [riskEditId,   setRiskEditId]   = useState(null);
  const [showRiskForm, setShowRiskForm] = useState(false);

  // Procedure form
  const emptyProc = () => ({ risk_id: "", risk_name: "", severity: "major", rto_hours: 24, rpo_hours: "", immediate_actions: [""], short_term_actions: [""], return_to_normal: [""], resources: [""] });
  const [procForm,     setProcForm]     = useState(emptyProc());
  const [procEditId,   setProcEditId]   = useState(null);
  const [showProcForm, setShowProcForm] = useState(false);

  // Comm form
  const emptyComm = () => ({ stakeholder: "", notify_within_hours: 4, channel: "email", template_code: "C1", subject: "", body: "", responsible: "" });
  const [commForm,      setCommForm]      = useState(emptyComm());
  const [commEditId,    setCommEditId]    = useState(null);
  const [showCommForm,  setShowCommForm]  = useState(false);
  const [viewTemplate,  setViewTemplate]  = useState(null);

  // Contact form
  const emptyContact = () => ({ name: "", role: "", phone: "", email: "", when_to_contact: "" });
  const [contactForm,     setContactForm]     = useState(emptyContact());
  const [contactEditId,   setContactEditId]   = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [r, p, c, ct, ai] = await Promise.all([
      supaLite.from("bcp_risks").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supaLite.from("bcp_recovery_procedures").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supaLite.from("bcp_comm_templates").select("*").eq("org_id", orgId).order("created_at"),
      supaLite.from("bcp_emergency_contacts").select("*").eq("org_id", orgId).order("sort_order"),
      supaLite.from("bcp_action_items").select("*").eq("org_id", orgId),
    ]);
    setRisks(r?.data ?? []);
    setProcs(p?.data ?? []);
    setComms(c?.data ?? []);
    setContacts(ct?.data ?? []);
    // Convert to map: action_key → {completed, notes, completed_at}
    const aiMap = {};
    (ai?.data ?? []).forEach(item => { aiMap[item.action_key] = item; });
    setActionItems(aiMap);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => { setFlashMsg(msg); setTimeout(() => setFlashMsg(null), 3500); };

  // ── Action Items ──
  const toggleActionItem = async (key, completed) => {
    const existing = actionItems[key];
    if (existing) {
      await supaLite.from("bcp_action_items")
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("org_id", orgId).eq("action_key", key);
    } else {
      await supaLite.from("bcp_action_items")
        .insert({ org_id: orgId, action_key: key, completed, completed_at: completed ? new Date().toISOString() : null });
    }
    setActionItems(prev => ({ ...prev, [key]: { ...prev[key], completed, action_key: key } }));
  };

  // ── Export BCP JSON ──
  const exportJSON = async () => {
    const payload = {
      exported_at: new Date().toISOString(),
      org_id: orgId,
      risks,
      recovery_procedures: procs,
      communication_templates: comms,
      emergency_contacts: contacts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BCMS-BCP-Backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await toggleActionItem("database_export", true);
    flash("📦 Export JSON สำเร็จ — บันทึกไว้ใน Google Drive ด้วยนะครับ");
  };

  // ── Schedule Tabletop Exercise ──
  const scheduleExercise = async () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    const scheduled = date.toISOString().split("T")[0];
    const topRisk = risks.sort((a, b) => (b.likelihood * b.impact) - (a.likelihood * a.impact))[0];
    await supaLite.from("exercises").insert({
      org_id: orgId,
      created_by: user?.id,
      title: `Tabletop Exercise #1 — ${topRisk?.name ?? "Platform Outage"} Scenario`,
      type: "tabletop",
      scheduled_date: scheduled,
      objectives: "ทดสอบขั้นตอน Recovery Procedures ตาม BCP Phase 2 · วัดเวลาจริงเทียบกับ RTO ที่กำหนด",
      scope: "IT Team + Management Team",
      status: "planned",
    });
    await toggleActionItem("tabletop_exercise", true);
    flash("🏋️ สร้าง Tabletop Exercise แล้ว — ดูได้ที่เมนู Exercise Programme");
  };

  // ── RISK CRUD ──
  const saveRisk = async () => {
    if (!riskForm.name.trim()) return;
    setSaving(true);
    const payload = { org_id: orgId, name: riskForm.name.trim(), category: riskForm.category, likelihood: Number(riskForm.likelihood), impact: Number(riskForm.impact), mtpd_hours: riskForm.mtpd_hours ? Number(riskForm.mtpd_hours) : null, notes: riskForm.notes.trim() || null };
    if (riskEditId) { await supaLite.from("bcp_risks").update(payload).eq("id", riskEditId); }
    else { await supaLite.from("bcp_risks").insert(payload); }
    setSaving(false); setShowRiskForm(false); setRiskForm(emptyRisk()); setRiskEditId(null);
    load(); flash("บันทึกความเสี่ยงแล้ว");
  };
  const startEditRisk = (r) => { setRiskForm({ name: r.name, category: r.category, likelihood: r.likelihood, impact: r.impact, mtpd_hours: r.mtpd_hours ?? "", notes: r.notes ?? "" }); setRiskEditId(r.id); setShowRiskForm(true); };
  const deleteRisk = async (id) => { if (!confirm("ลบความเสี่ยงนี้?")) return; await supaLite.from("bcp_risks").delete().eq("id", id); load(); };

  // ── PROCEDURE CRUD ──
  const saveProc = async () => {
    if (!procForm.risk_name.trim()) return;
    setSaving(true);
    const payload = { org_id: orgId, risk_id: procForm.risk_id || null, risk_name: procForm.risk_name.trim(), severity: procForm.severity, rto_hours: Number(procForm.rto_hours), rpo_hours: procForm.rpo_hours ? Number(procForm.rpo_hours) : null, immediate_actions: procForm.immediate_actions.filter(a => a.trim()), short_term_actions: procForm.short_term_actions.filter(a => a.trim()), return_to_normal: procForm.return_to_normal.filter(a => a.trim()), resources: procForm.resources.filter(a => a.trim()) };
    if (procEditId) { await supaLite.from("bcp_recovery_procedures").update(payload).eq("id", procEditId); }
    else { await supaLite.from("bcp_recovery_procedures").insert(payload); }
    setSaving(false); setShowProcForm(false); setProcForm(emptyProc()); setProcEditId(null);
    load(); flash("บันทึก Recovery Procedure แล้ว");
  };
  const startEditProc = (p) => { setProcForm({ risk_id: p.risk_id ?? "", risk_name: p.risk_name, severity: p.severity, rto_hours: p.rto_hours, rpo_hours: p.rpo_hours ?? "", immediate_actions: p.immediate_actions?.length ? p.immediate_actions : [""], short_term_actions: p.short_term_actions?.length ? p.short_term_actions : [""], return_to_normal: p.return_to_normal?.length ? p.return_to_normal : [""], resources: p.resources?.length ? p.resources : [""] }); setProcEditId(p.id); setShowProcForm(true); };
  const deleteProc = async (id) => { if (!confirm("ลบขั้นตอนนี้?")) return; await supaLite.from("bcp_recovery_procedures").delete().eq("id", id); load(); };

  // ── COMM CRUD ──
  const saveComm = async () => {
    if (!commForm.stakeholder.trim()) return;
    setSaving(true);
    const payload = { ...commForm, org_id: orgId, notify_within_hours: Number(commForm.notify_within_hours) };
    if (commEditId) { await supaLite.from("bcp_comm_templates").update(payload).eq("id", commEditId); }
    else { await supaLite.from("bcp_comm_templates").insert(payload); }
    setSaving(false); setShowCommForm(false); setCommForm(emptyComm()); setCommEditId(null);
    load(); flash("บันทึก Communication Plan แล้ว");
  };
  const startEditComm = (c) => { setCommForm({ stakeholder: c.stakeholder, notify_within_hours: c.notify_within_hours, channel: c.channel, template_code: c.template_code, subject: c.subject ?? "", body: c.body ?? "", responsible: c.responsible ?? "" }); setCommEditId(c.id); setShowCommForm(true); };
  const deleteComm = async (id) => { if (!confirm("ลบรายการนี้?")) return; await supaLite.from("bcp_comm_templates").delete().eq("id", id); load(); };

  // ── CONTACT CRUD ──
  const saveContact = async () => {
    if (!contactForm.name.trim()) return;
    setSaving(true);
    const payload = { ...contactForm, org_id: orgId };
    if (contactEditId) { await supaLite.from("bcp_emergency_contacts").update(payload).eq("id", contactEditId); }
    else { await supaLite.from("bcp_emergency_contacts").insert(payload); }
    setSaving(false); setShowContactForm(false); setContactForm(emptyContact()); setContactEditId(null);
    load(); flash("บันทึก Emergency Contact แล้ว");
  };
  const startEditContact = (c) => { setContactForm({ name: c.name, role: c.role, phone: c.phone ?? "", email: c.email ?? "", when_to_contact: c.when_to_contact ?? "" }); setContactEditId(c.id); setShowContactForm(true); };
  const deleteContact = async (id) => { if (!confirm("ลบ Contact นี้?")) return; await supaLite.from("bcp_emergency_contacts").delete().eq("id", id); load(); };

  const highRisks = risks.filter(r => r.likelihood * r.impact >= 15).length;
  const completedActions = ACTION_ITEMS.filter(a => actionItems[a.key]?.completed).length;

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}><div style={{ color: "#4b5b78" }}>กำลังโหลด BCP Builder...</div></div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 4px 40px" }}>
      {flashMsg && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9998, background: "#1565C0", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          ✓ {flashMsg}
        </div>
      )}

      {showBG && <BreakGlassModal onClose={() => setShowBG(false)} contacts={contacts} procs={procs} user={user} />}

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)", borderRadius: 16, padding: "20px 24px", marginBottom: 20, color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🛡️ BCP Builder — แผนความต่อเนื่องทางธุรกิจ</h1>
        <p style={{ margin: "4px 0 12px", fontSize: 12, opacity: 0.8 }}>ISO 22301 Clause 8.4 · 4-Phase Business Continuity Plan</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "ความเสี่ยง",  val: risks.length,    icon: "📊" },
            { label: "HIGH Risk",   val: highRisks,       icon: "🔴" },
            { label: "Recovery",    val: procs.length,    icon: "🔧" },
            { label: "Comm Plans",  val: comms.length,    icon: "📢" },
            { label: "Emergency Contacts", val: contacts.length, icon: "📞" },
            { label: "Action Items สำเร็จ", val: `${completedActions}/6`, icon: completedActions === 6 ? "✅" : "⚡" },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 80 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{s.icon} {s.val}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#f5f8ff", borderRadius: 12, padding: 4, marginBottom: 20 }}>
        {[
          { id: "risk",     label: "📊 Phase 1: ความเสี่ยง" },
          { id: "recovery", label: "🔧 Phase 2: Recovery" },
          { id: "comm",     label: "📢 Phase 3: สื่อสาร" },
          { id: "maint",    label: `🔄 Phase 4: Maintain ${completedActions < 6 ? `(${completedActions}/6)` : "✅"}` },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: "10px 6px", borderRadius: 8, border: "none", background: tab === t.id ? "#1565C0" : "transparent", color: tab === t.id ? "#fff" : "#425777", fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", fontSize: 12, transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════ PHASE 1: RISK ════ */}
      {tab === "risk" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, color: "#10294d" }}>📊 Risk Assessment Matrix</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#52617c" }}>Likelihood × Impact → Risk Score · ISO 22301 Clause 8.2</p>
            </div>
            {isAdmin && (
              <button type="button" onClick={() => { setRiskForm(emptyRisk()); setRiskEditId(null); setShowRiskForm(!showRiskForm); }} style={mkBtn(true)}>
                {showRiskForm ? "ซ่อนฟอร์ม" : "+ เพิ่มความเสี่ยง"}
              </button>
            )}
          </div>

          {showRiskForm && (
            <div style={{ ...box, marginBottom: 16, border: "2px solid #1565C0" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#10294d" }}>{riskEditId ? "✏️ แก้ไขความเสี่ยง" : "➕ เพิ่มความเสี่ยงใหม่"}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <Label>ชื่อความเสี่ยง *</Label>
                  <input value={riskForm.name} onChange={e => setRiskForm(f => ({ ...f, name: e.target.value }))} style={field} placeholder="เช่น Vercel / Supabase Platform Outage" />
                </div>
                <div>
                  <Label>หมวดหมู่</Label>
                  <select value={riskForm.category} onChange={e => setRiskForm(f => ({ ...f, category: e.target.value }))} style={field}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>MTPD — เวลาสูงสุดที่ยอมรับได้ (ชั่วโมง)</Label>
                  <input id="risk-mtpd-hours" name="mtpd_hours" type="number" value={riskForm.mtpd_hours} onChange={e => setRiskForm(f => ({ ...f, mtpd_hours: e.target.value }))} style={field} placeholder="เช่น 4" />
                </div>
                <div>
                  <Label>Likelihood: <strong style={{ color: "#1565C0" }}>{riskForm.likelihood}/5</strong></Label>
                  <input type="range" min={1} max={5} value={riskForm.likelihood} onChange={e => setRiskForm(f => ({ ...f, likelihood: Number(e.target.value) }))} style={{ display: "block", width: "100%", marginTop: 10, accentColor: "#1565C0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8099b8", marginTop: 2 }}><span>1 (ต่ำ)</span><span>5 (สูงมาก)</span></div>
                </div>
                <div>
                  <Label>Impact: <strong style={{ color: "#C53030" }}>{riskForm.impact}/5</strong></Label>
                  <input type="range" min={1} max={5} value={riskForm.impact} onChange={e => setRiskForm(f => ({ ...f, impact: Number(e.target.value) }))} style={{ display: "block", width: "100%", marginTop: 10, accentColor: "#C53030" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8099b8", marginTop: 2 }}><span>1 (ต่ำ)</span><span>5 (รุนแรง)</span></div>
                </div>
                <div style={{ gridColumn: "1/-1", background: "#f5f8ff", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 13, color: "#52617c" }}>Risk Score:</span>
                  <span style={{ background: scoreColor(riskForm.likelihood * riskForm.impact), color: "#fff", borderRadius: 12, padding: "3px 14px", fontSize: 14, fontWeight: 800 }}>
                    {riskForm.likelihood * riskForm.impact} — {scoreLabel(riskForm.likelihood * riskForm.impact)}
                  </span>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <Label>หมายเหตุ</Label>
                  <textarea value={riskForm.notes} onChange={e => setRiskForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...field, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowRiskForm(false); setRiskForm(emptyRisk()); setRiskEditId(null); }} style={mkBtn(false)}>ยกเลิก</button>
                <button type="button" onClick={saveRisk} disabled={saving} style={mkBtn(true)}>{saving ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
              </div>
            </div>
          )}

          {risks.length === 0 ? (
            <div style={{ ...box, textAlign: "center", padding: 48, color: "#52617c" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <p>ยังไม่มีความเสี่ยง — กด "เพิ่มความเสี่ยง" เพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {risks.map((r) => {
                const score = r.likelihood * r.impact;
                return (
                  <div key={r.id} style={{ ...box, borderLeft: `4px solid ${scoreColor(score)}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#10294d" }}>{r.name}</span>
                          <span style={{ background: scoreColor(score), color: "#fff", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>Score {score} — {scoreLabel(score)}</span>
                          <span style={{ background: "#eef3ff", color: "#1565C0", borderRadius: 8, padding: "2px 8px", fontSize: 11 }}>{CATEGORIES.find(c => c.id === r.category)?.label ?? r.category}</span>
                        </div>
                        <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: "#52617c" }}>Likelihood: <strong>{r.likelihood}/5</strong></span>
                          <span style={{ fontSize: 12, color: "#52617c" }}>Impact: <strong>{r.impact}/5</strong></span>
                          {r.mtpd_hours && <span style={{ fontSize: 12, color: "#52617c" }}>MTPD: <strong>{r.mtpd_hours} ชม.</strong></span>}
                        </div>
                        {r.notes && <div style={{ fontSize: 12, color: "#6b7fa3", marginTop: 6 }}>{r.notes}</div>}
                      </div>
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button type="button" onClick={() => startEditRisk(r)} style={{ ...mkBtn(false), fontSize: 12 }}>✏️</button>
                          <button type="button" onClick={() => deleteRisk(r.id)} style={{ ...mkBtn(false), fontSize: 12, color: "#C53030", border: "1px solid #FECACA" }}>🗑</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════ PHASE 2: RECOVERY ════ */}
      {tab === "recovery" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, color: "#10294d" }}>🔧 Recovery Procedures</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#52617c" }}>แผนกู้คืนพร้อม RTO/RPO · ISO 22301 Clause 8.4</p>
            </div>
            {isAdmin && (
              <button type="button" onClick={() => { setProcForm(emptyProc()); setProcEditId(null); setShowProcForm(!showProcForm); }} style={mkBtn(true)}>
                {showProcForm ? "ซ่อนฟอร์ม" : "+ เพิ่ม Recovery Plan"}
              </button>
            )}
          </div>

          {showProcForm && (
            <div style={{ ...box, marginBottom: 16, border: "2px solid #1565C0" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#10294d" }}>{procEditId ? "✏️ แก้ไข" : "➕ เพิ่ม"} Recovery Procedure</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>เชื่อมกับความเสี่ยง</Label>
                  <select value={procForm.risk_id} onChange={e => { const r = risks.find(r => r.id === e.target.value); setProcForm(f => ({ ...f, risk_id: e.target.value, risk_name: r?.name ?? f.risk_name })); }} style={field}>
                    <option value="">— เลือกความเสี่ยง (optional) —</option>
                    {risks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>ชื่อ Recovery Plan *</Label>
                  <input value={procForm.risk_name} onChange={e => setProcForm(f => ({ ...f, risk_name: e.target.value }))} style={field} placeholder="เช่น R1: Platform Outage Recovery" />
                </div>
                <div>
                  <Label>Severity</Label>
                  <select value={procForm.severity} onChange={e => setProcForm(f => ({ ...f, severity: e.target.value }))} style={field}>
                    <option value="critical">🔴 Critical</option>
                    <option value="major">🟠 Major</option>
                    <option value="minor">🟢 Minor</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div><label htmlFor="proc-rto" style={{ fontSize: 12, color: "#52617c", fontWeight: 600 }}>RTO (ชม.) *</label><input id="proc-rto" name="proc_rto_hours" type="number" min={1} value={procForm.rto_hours} onChange={e => setProcForm(f => ({ ...f, rto_hours: e.target.value }))} style={field} /></div>
                  <div><label htmlFor="proc-rpo" style={{ fontSize: 12, color: "#52617c", fontWeight: 600 }}>RPO (ชม.)</label><input id="proc-rpo" name="proc_rpo_hours" type="number" min={1} value={procForm.rpo_hours} onChange={e => setProcForm(f => ({ ...f, rpo_hours: e.target.value }))} style={field} placeholder="ไม่บังคับ" /></div>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <ActionList label="🚨 Immediate Actions (0–2 ชม.)" items={procForm.immediate_actions} onChange={v => setProcForm(f => ({ ...f, immediate_actions: v }))} />
                <ActionList label="🔧 Short-Term Recovery (24–72 ชม.)" items={procForm.short_term_actions} onChange={v => setProcForm(f => ({ ...f, short_term_actions: v }))} />
                <ActionList label="✅ Return to Normal" items={procForm.return_to_normal} onChange={v => setProcForm(f => ({ ...f, return_to_normal: v }))} />
                <ActionList label="📦 Resources Required" items={procForm.resources} onChange={v => setProcForm(f => ({ ...f, resources: v }))} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowProcForm(false); setProcForm(emptyProc()); setProcEditId(null); }} style={mkBtn(false)}>ยกเลิก</button>
                <button type="button" onClick={saveProc} disabled={saving} style={mkBtn(true)}>{saving ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
              </div>
            </div>
          )}

          {procs.length === 0 ? (
            <div style={{ ...box, textAlign: "center", padding: 48, color: "#52617c" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
              <p>ยังไม่มี Recovery Procedure — กด "เพิ่ม Recovery Plan"</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {procs.map((p) => {
                const sevColor = p.severity === "critical" ? "#C53030" : p.severity === "major" ? "#C05621" : "#276749";
                return (
                  <div key={p.id} style={{ ...box, borderLeft: `4px solid ${sevColor}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#10294d" }}>{p.risk_name}</span>
                          <span style={{ background: sevColor, color: "#fff", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{p.severity.toUpperCase()}</span>
                          <span style={{ background: "#eef3ff", color: "#1565C0", borderRadius: 8, padding: "2px 8px", fontSize: 11 }}>RTO: {p.rto_hours} ชม.</span>
                          {p.rpo_hours && <span style={{ background: "#f0fdf4", color: "#166534", borderRadius: 8, padding: "2px 8px", fontSize: 11 }}>RPO: {p.rpo_hours} ชม.</span>}
                        </div>
                        {p.immediate_actions?.length > 0 && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#52617c" }}>
                            <strong>Immediate:</strong> {p.immediate_actions.slice(0, 2).join(" · ")}
                            {p.immediate_actions.length > 2 && <span style={{ color: "#8099b8" }}> +{p.immediate_actions.length - 2} more</span>}
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button type="button" onClick={() => startEditProc(p)} style={{ ...mkBtn(false), fontSize: 12 }}>✏️</button>
                          <button type="button" onClick={() => deleteProc(p.id)} style={{ ...mkBtn(false), fontSize: 12, color: "#C53030", border: "1px solid #FECACA" }}>🗑</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════ PHASE 3: COMMUNICATION ════ */}
      {tab === "comm" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, color: "#10294d" }}>📢 Crisis Communication Plan</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#52617c" }}>ระบุว่าแจ้งใคร เมื่อไหร่ ช่องทางไหน · ISO 22301 Clause 8.4.3</p>
            </div>
            {isAdmin && (
              <button type="button" onClick={() => { setCommForm(emptyComm()); setCommEditId(null); setShowCommForm(!showCommForm); }} style={mkBtn(true)}>
                {showCommForm ? "ซ่อนฟอร์ม" : "+ เพิ่ม Stakeholder"}
              </button>
            )}
          </div>

          {showCommForm && (
            <div style={{ ...box, marginBottom: 16, border: "2px solid #1565C0" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#10294d" }}>{commEditId ? "✏️ แก้ไข" : "➕ เพิ่ม"} Communication Entry</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><Label>Stakeholder *</Label><input value={commForm.stakeholder} onChange={e => setCommForm(f => ({ ...f, stakeholder: e.target.value }))} style={field} placeholder="เช่น ลูกค้า Professional+" /></div>
                <div><label htmlFor="comm-notify-hours" style={{ fontSize: 12, color: "#52617c", fontWeight: 600 }}>แจ้งภายใน (ชั่วโมง)</label><input id="comm-notify-hours" name="notify_within_hours" type="number" min={1} value={commForm.notify_within_hours} onChange={e => setCommForm(f => ({ ...f, notify_within_hours: e.target.value }))} style={field} /></div>
                <div><Label>ช่องทาง</Label><select value={commForm.channel} onChange={e => setCommForm(f => ({ ...f, channel: e.target.value }))} style={field}>{CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><Label>รหัส Template</Label><input value={commForm.template_code} onChange={e => setCommForm(f => ({ ...f, template_code: e.target.value }))} style={field} placeholder="C1, C2..." /></div>
                <div><Label>ผู้รับผิดชอบ</Label><input value={commForm.responsible} onChange={e => setCommForm(f => ({ ...f, responsible: e.target.value }))} style={field} placeholder="ชื่อ / ตำแหน่ง" /></div>
                <div><Label>Subject</Label><input value={commForm.subject} onChange={e => setCommForm(f => ({ ...f, subject: e.target.value }))} style={field} placeholder="Subject line..." /></div>
                <div style={{ gridColumn: "1/-1" }}>
                  <Label>Template Message — ใช้ [ชื่อ], [วันที่], [สาเหตุ]</Label>
                  <textarea value={commForm.body} onChange={e => setCommForm(f => ({ ...f, body: e.target.value }))} rows={4} style={{ ...field, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowCommForm(false); setCommForm(emptyComm()); setCommEditId(null); }} style={mkBtn(false)}>ยกเลิก</button>
                <button type="button" onClick={saveComm} disabled={saving} style={mkBtn(true)}>{saving ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
              </div>
            </div>
          )}

          {comms.length === 0 ? (
            <div style={{ ...box, textAlign: "center", padding: 48, color: "#52617c" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
              <p>ยังไม่มี Communication Plan — กด "เพิ่ม Stakeholder"</p>
            </div>
          ) : (
            <>
              <div style={{ ...box, padding: 0, overflow: "hidden", marginBottom: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f5f8ff" }}>
                      {["Stakeholder", "แจ้งภายใน", "ช่องทาง", "Template", "ผู้รับผิดชอบ", ""].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "#52617c", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #dbe5f5" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comms.map((c) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #eef3ff" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#10294d" }}>{c.stakeholder}</td>
                        <td style={{ padding: "10px 14px", color: "#425777" }}>{c.notify_within_hours} ชม.</td>
                        <td style={{ padding: "10px 14px" }}><span style={{ background: "#eef3ff", color: "#1565C0", borderRadius: 8, padding: "2px 8px", fontSize: 11 }}>{c.channel}</span></td>
                        <td style={{ padding: "10px 14px" }}><span style={{ background: "#f0fdf4", color: "#166534", borderRadius: 8, padding: "2px 8px", fontSize: 11 }}>{c.template_code}</span></td>
                        <td style={{ padding: "10px 14px", color: "#425777", fontSize: 12 }}>{c.responsible || "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {c.body && <button type="button" onClick={() => setViewTemplate(viewTemplate?.id === c.id ? null : c)} style={{ ...mkBtn(false), fontSize: 11, padding: "3px 8px", background: viewTemplate?.id === c.id ? "#eef3ff" : "#fff" }}>📄 ดู</button>}
                            {isAdmin && <>
                              <button type="button" onClick={() => startEditComm(c)} style={{ ...mkBtn(false), fontSize: 11, padding: "3px 8px" }}>✏️</button>
                              <button type="button" onClick={() => deleteComm(c.id)} style={{ ...mkBtn(false), fontSize: 11, padding: "3px 8px", color: "#C53030", border: "1px solid #FECACA" }}>🗑</button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {viewTemplate && (
                <div style={{ ...box, border: "2px solid #1565C0", background: "#f5f8ff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 14, color: "#10294d" }}>📧 Template {viewTemplate.template_code} — {viewTemplate.stakeholder}</h3>
                    <button type="button" onClick={() => setViewTemplate(null)} style={mkBtn(false)}>✕</button>
                  </div>
                  {viewTemplate.subject && <div style={{ background: "#eef3ff", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#1565C0", fontWeight: 600, marginBottom: 10 }}>Subject: {viewTemplate.subject}</div>}
                  <pre style={{ fontSize: 13, color: "#425777", lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{viewTemplate.body}</pre>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════ PHASE 4: MAINTENANCE ════ */}
      {tab === "maint" && (
        <div>
          <h2 style={{ margin: "0 0 16px", fontSize: 17, color: "#10294d" }}>🔄 Maintenance, Export & Action Items</h2>

          {/* ── Action Items Checklist ── */}
          <div style={{ ...box, marginBottom: 16, border: "2px solid #1565C0", background: "#f5f8ff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: "#0D47A1", fontWeight: 800 }}>
                ⚡ BCP Action Items — {completedActions}/6 สำเร็จ
              </h3>
              <div style={{ background: completedActions === 6 ? "#16a34a" : "#1565C0", color: "#fff", borderRadius: 10, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                {completedActions === 6 ? "✅ BCP พร้อมใช้งาน!" : `${Math.round(completedActions / 6 * 100)}% เสร็จแล้ว`}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ background: "#dbe5f5", borderRadius: 999, height: 6, marginBottom: 16, overflow: "hidden" }}>
              <div style={{ width: `${(completedActions / 6) * 100}%`, height: "100%", background: completedActions === 6 ? "#16a34a" : "#1565C0", borderRadius: 999, transition: "width 0.5s" }} />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {ACTION_ITEMS.map((item) => {
                const done = !!actionItems[item.key]?.completed;
                return (
                  <div key={item.key} style={{ background: "#fff", border: `1px solid ${done ? "#bbf7d0" : "#dbe5f5"}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${done ? "#16a34a" : "#dbe5f5"}`, background: done ? "#16a34a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: isAdmin ? "pointer" : "default", flexShrink: 0, transition: "all 0.2s" }}
                      onClick={() => isAdmin && toggleActionItem(item.key, !done)}>
                      {done && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#166534" : "#10294d", textDecoration: done ? "line-through" : "none" }}>
                        {item.icon} {item.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#8099b8", marginTop: 2 }}>{item.desc}</div>
                    </div>
                    {/* Auto-action buttons */}
                    {!done && isAdmin && (
                      <div style={{ flexShrink: 0 }}>
                        {item.key === "supabase_backup" && (
                          <a href="https://supabase.com/dashboard/project/pbtngbwbieskvmutshbz/database/backups" target="_blank" rel="noreferrer"
                            onClick={() => setTimeout(() => toggleActionItem(item.key, true), 2000)}
                            style={{ ...mkBtn(false), fontSize: 11, padding: "4px 10px", textDecoration: "none", display: "inline-block" }}>
                            🔗 เปิด Supabase
                          </a>
                        )}
                        {item.key === "database_export" && (
                          <button type="button" onClick={exportJSON} style={{ ...mkBtn(true), fontSize: 11, padding: "4px 10px" }}>
                            📥 Export JSON
                          </button>
                        )}
                        {item.key === "bcp_offline_export" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" onClick={() => { setShowBG(true); setTimeout(() => toggleActionItem(item.key, true), 1000); }}
                              style={{ ...mkBtn(false), fontSize: 11, padding: "4px 10px" }}>
                              🚨 Break Glass
                            </button>
                            <button type="button" onClick={() => { window.print(); setTimeout(() => toggleActionItem(item.key, true), 1000); }}
                              style={{ ...mkBtn(true), fontSize: 11, padding: "4px 10px" }}>
                              🖨️ Print PDF
                            </button>
                          </div>
                        )}
                        {item.key === "tabletop_exercise" && (
                          <button type="button" onClick={scheduleExercise} style={{ ...mkBtn(true), fontSize: 11, padding: "4px 10px" }}>
                            📅 Schedule Now
                          </button>
                        )}
                        {(item.key === "backup_developer" || item.key === "password_manager") && (
                          <button type="button" onClick={() => toggleActionItem(item.key, true)} style={{ ...mkBtn(false), fontSize: 11, padding: "4px 10px", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                            ✓ เสร็จแล้ว
                          </button>
                        )}
                      </div>
                    )}
                    {done && (
                      <div style={{ flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>สำเร็จ</span>
                        {isAdmin && <button type="button" onClick={() => toggleActionItem(item.key, false)} style={{ ...mkBtn(false), fontSize: 10, padding: "2px 6px", marginLeft: 6, color: "#8099b8" }}>ยกเลิก</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Export Panel ── */}
          <div style={{ ...box, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#10294d" }}>📤 Export BCP</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={exportJSON}
                style={{ ...mkBtn(true), display: "flex", alignItems: "center", gap: 8 }}>
                📥 Download JSON Backup
              </button>
              <button type="button" onClick={() => setShowBG(true)}
                style={{ ...mkBtn(false), background: "#fff5f5", border: "1px solid #FECACA", color: "#C53030", display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                🚨 Break Glass Document
              </button>
              <button type="button" onClick={() => window.print()}
                style={{ ...mkBtn(false), display: "flex", alignItems: "center", gap: 8 }}>
                🖨️ Print Page as PDF
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#8099b8" }}>
              JSON Backup — ข้อมูล BCP ทั้งหมด (Risks, Recovery, Templates, Contacts) · Break Glass — Emergency one-pager สำหรับวิกฤต
            </div>
          </div>

          {/* ── Review Schedule ── */}
          <div style={{ ...box, marginBottom: 16, background: "#f5f8ff" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#1565C0" }}>📅 Review Schedule — ISO 22301 Clause 9</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 10 }}>
              {[
                { period: "ทุกไตรมาส", icon: "Q", color: "#1565C0", tasks: ["ตรวจ Contact info & API Keys", "อัปเดต Recovery Plans", "ทดสอบ Backup restore"] },
                { period: "ทุก 6 เดือน", icon: "½", color: "#0D47A1", tasks: ["ทดสอบ Recovery Procedure", "Tabletop Exercise", "Review Risk Scores"] },
                { period: "ประจำปี", icon: "Y", color: "#7B1FA2", tasks: ["Review BCP ทั้งหมด", "อัปเดต Risk Matrix", "Full Plan Revision"] },
                { period: "หลังเหตุการณ์", icon: "!", color: "#C62828", tasks: ["After-Action Report ทันที", "Root Cause Analysis", "อัปเดต Plan + แจ้งผู้เกี่ยวข้อง"] },
              ].map((s) => (
                <div key={s.period} style={{ background: "#fff", border: "1px solid #dbe5f5", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.color, marginBottom: 8 }}>{s.icon} {s.period}</div>
                  {s.tasks.map(t => (
                    <div key={t} style={{ fontSize: 12, color: "#425777", padding: "4px 0", borderBottom: "1px solid #eef3ff", display: "flex", gap: 6 }}>
                      <span style={{ color: s.color, flexShrink: 0 }}>•</span> {t}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ── Anti-Pattern Warning ── */}
          <div style={{ background: "#fff8e1", border: "1px solid #ffd54f", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 13, color: "#E65100" }}>⚠️ Anti-Pattern: อย่าเก็บ BCP ไว้ใน Platform เท่านั้น</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#6D4C41", lineHeight: 1.6 }}>
              ถ้า Platform ล่ม คุณจะเข้าอ่าน BCP ไม่ได้ — ต้องเก็บ backup ใน <strong>Google Drive</strong> + <strong>Local</strong> เสมอ
            </p>
          </div>

          {/* ── Emergency Contacts ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: "#10294d" }}>📞 Emergency Contacts</h3>
            {isAdmin && (
              <button type="button" onClick={() => { setContactForm(emptyContact()); setContactEditId(null); setShowContactForm(!showContactForm); }} style={mkBtn(true)}>
                {showContactForm ? "ซ่อนฟอร์ม" : "+ เพิ่ม Contact"}
              </button>
            )}
          </div>

          {/* Backup Developer Warning */}
          {!contacts.some(c => /developer|dev|programmer|นักพัฒนา/i.test(c.role)) && (
            <div style={{ background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🧑‍💻</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#C53030" }}>ยังไม่มี Backup Developer!</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>Action Item ① — เพิ่ม Developer สำรองที่สามารถ fix critical bug ได้ถ้าคุณไม่พร้อม</div>
              </div>
              <button type="button"
                onClick={() => { setContactForm({ name: "", role: "Backup Developer", phone: "", email: "", when_to_contact: "ถ้าเจ้าของระบบไม่พร้อมเกิน 48 ชม." }); setContactEditId(null); setShowContactForm(true); }}
                style={{ ...mkBtn(true), fontSize: 12, background: "#C53030" }}>+ เพิ่ม</button>
            </div>
          )}

          {showContactForm && (
            <div style={{ ...box, marginBottom: 16, border: "2px solid #1565C0" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, color: "#10294d" }}>{contactEditId ? "✏️ แก้ไข" : "➕ เพิ่ม"} Emergency Contact</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { key: "name",  label: "ชื่อ *",       placeholder: "ชื่อบุคคล / หน่วยงาน" },
                  { key: "role",  label: "บทบาท *",      placeholder: "เช่น Backup Developer" },
                  { key: "phone", label: "โทรศัพท์",     placeholder: "+66 XX XXX XXXX" },
                  { key: "email", label: "Email",         placeholder: "email@example.com" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}><Label>{label}</Label><input value={contactForm[key]} onChange={e => setContactForm(f => ({ ...f, [key]: e.target.value }))} style={field} placeholder={placeholder} /></div>
                ))}
                <div style={{ gridColumn: "1/-1" }}>
                  <Label>เรียกเมื่อ</Label>
                  <input value={contactForm.when_to_contact} onChange={e => setContactForm(f => ({ ...f, when_to_contact: e.target.value }))} style={field} placeholder="เช่น ถ้า Developer ไม่พร้อมเกิน 48 ชม." />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowContactForm(false); setContactForm(emptyContact()); setContactEditId(null); }} style={mkBtn(false)}>ยกเลิก</button>
                <button type="button" onClick={saveContact} disabled={saving} style={mkBtn(true)}>{saving ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <div style={{ ...box, textAlign: "center", padding: 32, color: "#52617c" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📞</div>
              <p>ยังไม่มี Emergency Contact — กด "เพิ่ม Contact"</p>
            </div>
          ) : (
            <div style={{ ...box, padding: 0, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f5f8ff" }}>
                    {["ชื่อ", "บทบาท", "โทรศัพท์", "Email", "เรียกเมื่อ", ""].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "#52617c", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #dbe5f5", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #eef3ff" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#10294d" }}>{c.name}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ background: "#eef3ff", color: "#1565C0", borderRadius: 8, padding: "2px 8px", fontSize: 11 }}>{c.role}</span></td>
                      <td style={{ padding: "10px 14px", color: "#425777", fontSize: 12 }}>{c.phone || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#425777", fontSize: 12 }}>{c.email || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#52617c", fontSize: 12 }}>{c.when_to_contact || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {isAdmin && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button type="button" onClick={() => startEditContact(c)} style={{ ...mkBtn(false), fontSize: 11, padding: "3px 8px" }}>✏️</button>
                            <button type="button" onClick={() => deleteContact(c.id)} style={{ ...mkBtn(false), fontSize: 11, padding: "3px 8px", color: "#C53030", border: "1px solid #FECACA" }}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
