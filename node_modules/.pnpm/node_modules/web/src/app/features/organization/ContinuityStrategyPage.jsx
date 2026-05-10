import React, { useEffect, useMemo, useState } from "react";

import { supaLite } from "../../lib/supa-lite.js";

const STRATEGY_TEMPLATES = [
  {
    code: "ALT_SITE",
    name: "Alternative Site (สถานที่สำรอง)",
    category: "facility",
    objective: "ย้ายการปฏิบัติงานไปยังสถานที่สำรองภายใน RTO ที่กำหนด",
    isoReference: "ISO 22313:2020 §8.3 / ISO 22317 BIA linkage",
    defaultSteps: [
      { phase: "respond", title: "ประกาศการย้ายสถานที่", instruction: "แจ้งทีมและผู้มีส่วนได้ส่วนเสียตาม call tree", responsible_role: "BCM Coordinator", target_minutes: 30 },
      { phase: "recover", title: "เปิดใช้งานสถานที่สำรอง", instruction: "ตรวจสอบความพร้อมระบบและอุปกรณ์ขั้นต่ำตาม MAC", responsible_role: "Facility Lead", target_minutes: 120 },
      { phase: "resume", title: "โอนงานหลักกลับเข้าสู่ระดับบริการ", instruction: "ยืนยัน capacity >= MAC และบันทึกผล", responsible_role: "Process Owner", target_minutes: 60 },
    ],
  },
  {
    code: "REMOTE_WORK",
    name: "Remote Work (ทำงานระยะไกล)",
    category: "people",
    objective: "คงความต่อเนื่องด้วยการทำงานนอกสถานที่เมื่อสำนักงานใช้งานไม่ได้",
    isoReference: "ISO 22313:2020 §8.4 / ISO 22317 impact treatment",
    defaultSteps: [
      { phase: "respond", title: "เปิดนโยบายทำงานระยะไกล", instruction: "แจ้งเกณฑ์การสลับโหมดและ SLA ขั้นต่ำ", responsible_role: "HR / Admin", target_minutes: 30 },
      { phase: "recover", title: "ยืนยันการเข้าถึงระบบสำคัญ", instruction: "ทดสอบ VPN/SSO และสิทธิ์งานสำคัญ", responsible_role: "IT Lead", target_minutes: 90 },
      { phase: "resume", title: "ติดตามประสิทธิภาพบริการรายวัน", instruction: "วัดผลเทียบ MAC และ escalation ตาม trigger", responsible_role: "Process Owner", target_minutes: 30 },
    ],
  },
  {
    code: "MANUAL_WORKAROUND",
    name: "Manual Workaround (ทำงานแบบ Manual)",
    category: "process",
    objective: "รักษาบริการสำคัญด้วยขั้นตอน manual ชั่วคราวระหว่างระบบหลักหยุดชะงัก",
    isoReference: "ISO 22313:2020 §8.3.4 / ISO 22317 RTO-RPO decision support",
    defaultSteps: [
      { phase: "respond", title: "เปิด SOP แบบ Manual", instruction: "สลับไปใช้ฟอร์ม/ทะเบียนสำรองตาม checklist", responsible_role: "Process Supervisor", target_minutes: 20 },
      { phase: "recover", title: "ควบคุมคุณภาพข้อมูล", instruction: "ทวนสอบความถูกต้องและบันทึก backlog", responsible_role: "Quality Lead", target_minutes: 60 },
      { phase: "resume", title: "นำข้อมูลกลับเข้าระบบหลัก", instruction: "reconcile รายการที่ทำ manual หลังระบบกลับมา", responsible_role: "System Owner", target_minutes: 90 },
    ],
  },
  {
    code: "ALT_SUPPLIER",
    name: "Alternate Supplier (ผู้ส่งมอบสำรอง)",
    category: "supply",
    objective: "ลดผลกระทบซัพพลายเชนด้วยผู้ส่งมอบสำรองที่ผ่านการรับรอง",
    isoReference: "ISO 22313:2020 §8.3 / Supply continuity practice",
    defaultSteps: [
      { phase: "respond", title: "ประกาศเหตุหยุดชะงักซัพพลาย", instruction: "ยืนยัน trigger และอนุมัติสลับ vendor", responsible_role: "Procurement Lead", target_minutes: 45 },
      { phase: "recover", title: "เปิดสัญญาผู้ส่งมอบสำรอง", instruction: "ยืนยัน capacity, lead-time, และ quality baseline", responsible_role: "Procurement Lead", target_minutes: 180 },
      { phase: "resume", title: "ติดตาม service level", instruction: "ประเมินผลส่งมอบเทียบ MAC ของกระบวนการ", responsible_role: "Process Owner", target_minutes: 60 },
    ],
  },
  {
    code: "IT_DR",
    name: "IT Disaster Recovery (กู้คืนระบบ IT)",
    category: "technology",
    objective: "กู้คืนระบบสำคัญและข้อมูลให้กลับสู่ระดับยอมรับได้ตาม RTO/RPO",
    isoReference: "ISO 22313:2020 §8.4 / ISO 22317 BIA objective alignment",
    defaultSteps: [
      { phase: "respond", title: "ประกาศ DR Activation", instruction: "ยืนยันเหตุการณ์และผู้มีอำนาจอนุมัติ", responsible_role: "Incident Manager", target_minutes: 15 },
      { phase: "recover", title: "กู้คืนระบบสำคัญตามลำดับ", instruction: "restore ระบบ Tier-1, ตรวจสอบข้อมูลตาม RPO", responsible_role: "IT DR Team", target_minutes: 240 },
      { phase: "resume", title: "ยืนยันบริการหลังฟื้นตัว", instruction: "ทดสอบ end-to-end และส่งมอบกลับ owner", responsible_role: "IT Service Owner", target_minutes: 60 },
    ],
  },
];

const PHASES = [
  { value: "respond", label: "Respond" },
  { value: "recover", label: "Recover" },
  { value: "resume", label: "Resume" },
];

const card = {
  background: "#fff",
  border: "1px solid #dbe5f5",
  borderRadius: 14,
  padding: 16,
};

function emptyForm() {
  return {
    process_id: "",
    bc_plan_id: "",
    department: "",
    strategy_code: STRATEGY_TEMPLATES[0].code,
    strategy_name: STRATEGY_TEMPLATES[0].name,
    strategy_category: STRATEGY_TEMPLATES[0].category,
    objective: STRATEGY_TEMPLATES[0].objective,
    rationale: "",
    iso_reference: STRATEGY_TEMPLATES[0].isoReference,
    target_rto_minutes: "",
    target_mac_pct: "",
    owner: "",
  };
}

export default function ContinuityStrategyPage({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processes, setProcesses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [steps, setSteps] = useState([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState(null);
  const [automation, setAutomation] = useState({
    process_id: "",
    strategy_id: "",
    title: "",
  });
  const [readiness, setReadiness] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [stepForm, setStepForm] = useState({
    phase: "respond",
    title: "",
    instruction: "",
    responsible_role: "",
    target_minutes: "",
    mandatory: true,
  });

  const isOrgLevel = useMemo(
    () => (user?.accessLevel ?? "org") === "org" || ["owner", "admin"].includes((user?.role ?? "").toLowerCase()),
    [user?.accessLevel, user?.role]
  );

  const selectedStrategy = useMemo(
    () => strategies.find((row) => row.id === selectedStrategyId) ?? null,
    [selectedStrategyId, strategies]
  );

  const selectedProcess = useMemo(
    () => processes.find((row) => row.id === form.process_id) ?? null,
    [form.process_id, processes]
  );
  const selectedPlanForReadiness = useMemo(
    () => plans.find((row) => row.id === form.bc_plan_id) ?? null,
    [plans, form.bc_plan_id]
  );

  const load = async () => {
    if (!user?.orgId) return;
    setLoading(true);
    const [pRes, bRes, sRes] = await Promise.all([
      supaLite
        .from("bia_processes")
        .select("id,name,department,rto_minutes,mac_pct,status")
        .eq("org_id", user.orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supaLite
        .from("bc_plans")
        .select("id,title,department,process_id,status")
        .eq("org_id", user.orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supaLite
        .from("continuity_strategies")
        .select("id,strategy_code,strategy_name,strategy_category,process_id,bc_plan_id,department,status,target_rto_minutes,target_mac_pct,iso_reference,created_at")
        .eq("org_id", user.orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    setProcesses(pRes.data ?? []);
    setPlans(bRes.data ?? []);
    setStrategies(sRes.data ?? []);
    const firstStrategyId = sRes.data?.[0]?.id ?? null;
    setSelectedStrategyId((prev) => prev ?? firstStrategyId);
    setAutomation((prev) => ({
      ...prev,
      process_id: prev.process_id || pRes.data?.[0]?.id || "",
      strategy_id: prev.strategy_id || sRes.data?.[0]?.id || "",
    }));
    setLoading(false);
  };

  const loadSteps = async (strategyId) => {
    if (!strategyId || !user?.orgId) {
      setSteps([]);
      return;
    }
    const { data } = await supaLite
      .from("continuity_procedure_steps")
      .select("id,step_no,phase,title,instruction,responsible_role,target_minutes,mandatory")
      .eq("org_id", user.orgId)
      .eq("strategy_id", strategyId)
      .order("step_no", { ascending: true });
    setSteps(data ?? []);
  };

  useEffect(() => {
    load();
  }, [user?.orgId]);

  useEffect(() => {
    loadSteps(selectedStrategyId);
  }, [selectedStrategyId, user?.orgId]);

  const onTemplateChange = (code) => {
    const template = STRATEGY_TEMPLATES.find((row) => row.code === code);
    if (!template) return;
    setForm((prev) => ({
      ...prev,
      strategy_code: template.code,
      strategy_name: template.name,
      strategy_category: template.category,
      objective: template.objective,
      iso_reference: template.isoReference,
    }));
  };

  const saveStrategy = async () => {
    if (!isOrgLevel || !user?.orgId) return;
    if (!form.process_id || !form.strategy_name.trim()) {
      alert("กรุณาเลือก BIA Process และระบุชื่อกลยุทธ์");
      return;
    }
    setSaving(true);
    const payload = {
      org_id: user.orgId,
      process_id: form.process_id,
      bc_plan_id: form.bc_plan_id || null,
      department: form.department || selectedProcess?.department || null,
      strategy_code: form.strategy_code.trim(),
      strategy_name: form.strategy_name.trim(),
      strategy_category: form.strategy_category.trim(),
      objective: form.objective.trim() || null,
      rationale: form.rationale.trim() || null,
      iso_reference: form.iso_reference.trim() || null,
      target_rto_minutes: form.target_rto_minutes ? Number(form.target_rto_minutes) : null,
      target_mac_pct: form.target_mac_pct ? Number(form.target_mac_pct) : null,
      owner: form.owner.trim() || null,
      status: "draft",
      metadata: {
        source: "iso22317-22313-guided",
      },
    };

    const { data, error } = await supaLite
      .from("continuity_strategies")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      alert(`บันทึกกลยุทธ์ไม่สำเร็จ: ${error.message}`);
      return;
    }

    const template = STRATEGY_TEMPLATES.find((row) => row.code === payload.strategy_code);
    let stepRows = [];
    if (template?.defaultSteps?.length) {
      stepRows = template.defaultSteps.map((step, index) => ({
        org_id: user.orgId,
        strategy_id: data.id,
        step_no: index + 1,
        phase: step.phase,
        title: step.title,
        instruction: step.instruction,
        responsible_role: step.responsible_role,
        target_minutes: step.target_minutes,
        mandatory: true,
      }));
      await supaLite.from("continuity_procedure_steps").insert(stepRows);
    }

    if (payload.bc_plan_id) {
      await syncStrategyToBcPlan({
        orgId: user.orgId,
        bcPlanId: payload.bc_plan_id,
        strategyId: data.id,
        strategyName: payload.strategy_name,
        stepsData: stepRows,
      });
    }

    setSaving(false);
    setForm(emptyForm());
    await load();
    setSelectedStrategyId(data.id);
  };

  const saveStep = async () => {
    if (!isOrgLevel || !selectedStrategyId || !user?.orgId) return;
    if (!stepForm.title.trim()) {
      alert("กรุณาระบุชื่อขั้นตอน");
      return;
    }
    setSaving(true);
    const nextNo = (steps[steps.length - 1]?.step_no ?? 0) + 1;
    const { error } = await supaLite.from("continuity_procedure_steps").insert({
      org_id: user.orgId,
      strategy_id: selectedStrategyId,
      step_no: nextNo,
      phase: stepForm.phase,
      title: stepForm.title.trim(),
      instruction: stepForm.instruction.trim() || null,
      responsible_role: stepForm.responsible_role.trim() || null,
      target_minutes: stepForm.target_minutes ? Number(stepForm.target_minutes) : null,
      mandatory: stepForm.mandatory,
    });
    setSaving(false);
    if (error) {
      alert(`เพิ่มขั้นตอนไม่สำเร็จ: ${error.message}`);
      return;
    }

    if (selectedStrategy?.bc_plan_id) {
      const { data: allSteps } = await supaLite
        .from("continuity_procedure_steps")
        .select("step_no,phase,title,instruction,responsible_role,target_minutes")
        .eq("org_id", user.orgId)
        .eq("strategy_id", selectedStrategyId)
        .order("step_no", { ascending: true });
      await syncStrategyToBcPlan({
        orgId: user.orgId,
        bcPlanId: selectedStrategy.bc_plan_id,
        strategyId: selectedStrategyId,
        strategyName: selectedStrategy.strategy_name,
        stepsData: allSteps ?? [],
      });
    }

    setStepForm({
      phase: "respond",
      title: "",
      instruction: "",
      responsible_role: "",
      target_minutes: "",
      mandatory: true,
    });
    await loadSteps(selectedStrategyId);
  };

  const runAutomate = async () => {
    if (!isOrgLevel || !automation.process_id) {
      alert("กรุณาเลือก BIA Process");
      return;
    }
    setSaving(true);
    const { data, error } = await supaLite.rpc("generate_bcp_automate", {
      p_process_id: automation.process_id,
      p_strategy_id: automation.strategy_id || null,
      p_title: automation.title || null,
    });
    setSaving(false);
    if (error) {
      alert(`สร้าง BCP อัตโนมัติไม่สำเร็จ: ${error.message}`);
      return;
    }
    await load();
    alert("สร้าง BCP อัตโนมัติสำเร็จ");
    if (data) {
      setForm((prev) => ({ ...prev, bc_plan_id: data }));
      setReadiness(null);
    }
  };

  const checkReadiness = async () => {
    if (!selectedPlanForReadiness?.id) {
      alert("เลือก BC Plan ก่อนตรวจความพร้อม");
      return;
    }
    const { data, error } = await supaLite.rpc("evaluate_bcp_readiness", {
      p_plan_id: selectedPlanForReadiness.id,
    });
    if (error) {
      alert(`ตรวจความพร้อมไม่สำเร็จ: ${error.message}`);
      return;
    }
    setReadiness(data ?? null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f8ff", padding: 20 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, color: "#10294d" }}>Continuity Strategy</h2>
            <div style={{ fontSize: 13, color: "#4b5b78", marginTop: 4 }}>
              เลือกกลยุทธ์ความต่อเนื่องที่เชื่อมโยง BIA (ISO 22317) กับแผนและขั้นตอน BCP (ISO 22313)
            </div>
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
                <Metric title="BIA Processes" value={String(processes.length)} />
                <Metric title="BC Plans" value={String(plans.length)} />
                <Metric title="Strategies" value={String(strategies.length)} />
                <Metric title="Procedure Steps" value={String(steps.length)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
              <div style={card}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>สร้างกลยุทธ์ความต่อเนื่อง</h3>
                <Field label="เทมเพลตกลยุทธ์">
                  <select
                    value={form.strategy_code}
                    onChange={(e) => onTemplateChange(e.target.value)}
                    disabled={!isOrgLevel}
                    style={inputStyle()}
                  >
                    {STRATEGY_TEMPLATES.map((row) => (
                      <option key={row.code} value={row.code}>{row.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="BIA Process ที่อ้างอิง">
                  <select
                    value={form.process_id}
                    onChange={(e) => {
                      const process = processes.find((row) => row.id === e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        process_id: e.target.value,
                        department: process?.department ?? "",
                        target_rto_minutes: process?.rto_minutes ?? prev.target_rto_minutes,
                        target_mac_pct: process?.mac_pct ?? prev.target_mac_pct,
                      }));
                    }}
                    disabled={!isOrgLevel}
                    style={inputStyle()}
                  >
                    <option value="">เลือก process</option>
                    {processes.map((row) => (
                      <option key={row.id} value={row.id}>{row.name} ({row.department || "N/A"})</option>
                    ))}
                  </select>
                </Field>
                <Field label="BC Plan ที่เชื่อมโยง">
                  <select value={form.bc_plan_id} onChange={(e) => setForm((prev) => ({ ...prev, bc_plan_id: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()}>
                    <option value="">เลือก BC Plan (ไม่บังคับ)</option>
                    {plans.map((row) => (
                      <option key={row.id} value={row.id}>{row.title} ({row.status})</option>
                    ))}
                  </select>
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Field label="Target RTO (นาที)">
                    <input value={form.target_rto_minutes} onChange={(e) => setForm((prev) => ({ ...prev, target_rto_minutes: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                  </Field>
                  <Field label="Target MAC (%)">
                    <input value={form.target_mac_pct} onChange={(e) => setForm((prev) => ({ ...prev, target_mac_pct: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                  </Field>
                </div>
                <Field label="Objective">
                  <textarea value={form.objective} onChange={(e) => setForm((prev) => ({ ...prev, objective: e.target.value }))} disabled={!isOrgLevel} style={{ ...inputStyle(), minHeight: 64 }} />
                </Field>
                <Field label="Rationale">
                  <textarea value={form.rationale} onChange={(e) => setForm((prev) => ({ ...prev, rationale: e.target.value }))} disabled={!isOrgLevel} style={{ ...inputStyle(), minHeight: 64 }} />
                </Field>
                <Field label="ISO Reference">
                  <input value={form.iso_reference} onChange={(e) => setForm((prev) => ({ ...prev, iso_reference: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                </Field>
                <Field label="Owner / Responsible">
                  <input value={form.owner} onChange={(e) => setForm((prev) => ({ ...prev, owner: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                </Field>
                <button
                  type="button"
                  onClick={saveStrategy}
                  disabled={!isOrgLevel || saving}
                  style={{ marginTop: 8, border: "none", borderRadius: 8, background: "#1565c0", color: "#fff", padding: "10px 12px", cursor: isOrgLevel ? "pointer" : "not-allowed" }}
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกกลยุทธ์ + สร้างขั้นตอนตั้งต้น"}
                </button>
              </div>

              <div style={card}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>รายการกลยุทธ์ที่สร้างแล้ว</h3>
                {strategies.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#5a7094" }}>ยังไม่มีกลยุทธ์</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, maxHeight: 520, overflowY: "auto" }}>
                    {strategies.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelectedStrategyId(row.id)}
                        style={{
                          textAlign: "left",
                          background: selectedStrategyId === row.id ? "#ecf4ff" : "#fff",
                          border: selectedStrategyId === row.id ? "1px solid #9cc0f0" : "1px solid #e3ecfb",
                          borderRadius: 8,
                          padding: 10,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#10294d", fontWeight: 700 }}>{row.strategy_name}</div>
                        <div style={{ fontSize: 11, color: "#5a7094" }}>
                          {row.strategy_code} · {row.status} · {row.department || "N/A"}
                        </div>
                        <div style={{ fontSize: 10, color: "#7a8da9" }}>RTO {row.target_rto_minutes || "-"} นาที · MAC {row.target_mac_pct || "-"}%</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ ...card, marginTop: 12 }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>BCP Automate</h3>
              <div style={{ fontSize: 12, color: "#4e6285", marginBottom: 10 }}>
                สร้าง BC Plan อัตโนมัติจาก BIA + Strategy และตรวจความพร้อมก่อนอนุมัติ
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 8 }}>
                <select
                  value={automation.process_id}
                  onChange={(e) => setAutomation((prev) => ({ ...prev, process_id: e.target.value }))}
                  disabled={!isOrgLevel}
                  style={inputStyle()}
                >
                  <option value="">เลือก BIA Process</option>
                  {processes.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
                <select
                  value={automation.strategy_id}
                  onChange={(e) => setAutomation((prev) => ({ ...prev, strategy_id: e.target.value }))}
                  disabled={!isOrgLevel}
                  style={inputStyle()}
                >
                  <option value="">ไม่เชื่อมกลยุทธ์</option>
                  {strategies.map((row) => (
                    <option key={row.id} value={row.id}>{row.strategy_name}</option>
                  ))}
                </select>
                <input
                  placeholder="ชื่อ BC Plan (ไม่บังคับ)"
                  value={automation.title}
                  onChange={(e) => setAutomation((prev) => ({ ...prev, title: e.target.value }))}
                  disabled={!isOrgLevel}
                  style={inputStyle()}
                />
                <button type="button" onClick={runAutomate} disabled={!isOrgLevel || saving} style={{ border: "none", borderRadius: 8, background: "#1565c0", color: "#fff", padding: "0 12px", cursor: "pointer" }}>
                  สร้าง Auto BCP
                </button>
                <button type="button" onClick={checkReadiness} disabled={saving} style={{ border: "1px solid #bdd2f0", borderRadius: 8, background: "#fff", color: "#15335c", padding: "0 12px", cursor: "pointer" }}>
                  ตรวจ Readiness
                </button>
              </div>

              {readiness?.ok && (
                <div style={{ marginTop: 10, borderRadius: 8, padding: 10, background: readiness.ready ? "#e9f8f0" : "#fff5e8", border: `1px solid ${readiness.ready ? "#b8e7cc" : "#f4d5a7"}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: readiness.ready ? "#0f7a4f" : "#9a5c00" }}>
                    {readiness.ready ? "พร้อมอนุมัติ BCP" : "ยังไม่พร้อมอนุมัติ BCP"}
                  </div>
                  <div style={{ fontSize: 11, color: "#4e6285", marginTop: 4 }}>
                    Process Link: {readiness.checks?.has_process_link ? "ผ่าน" : "ไม่ผ่าน"} ·
                    Trigger: {readiness.checks?.has_trigger ? "ผ่าน" : "ไม่ผ่าน"} ·
                    Strategy Link: {readiness.checks?.has_strategy_link ? "ผ่าน" : "ไม่ผ่าน"} ·
                    Tasks: {readiness.checks?.task_count ?? 0}
                  </div>
                </div>
              )}
            </div>

            <div style={{ ...card, marginTop: 12 }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>ขั้นตอนความต่อเนื่องทางธุรกิจ (Procedure Steps)</h3>
              {!selectedStrategy ? (
                <div style={{ fontSize: 12, color: "#5a7094" }}>เลือกกลยุทธ์ก่อนเพื่อจัดการขั้นตอน</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "#314d76", marginBottom: 10 }}>
                    กลยุทธ์: <strong>{selectedStrategy.strategy_name}</strong> · ISO Ref: {selectedStrategy.iso_reference || "-"}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px auto", gap: 8, marginBottom: 8 }}>
                    <select value={stepForm.phase} onChange={(e) => setStepForm((prev) => ({ ...prev, phase: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()}>
                      {PHASES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <input placeholder="ชื่อขั้นตอน" value={stepForm.title} onChange={(e) => setStepForm((prev) => ({ ...prev, title: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                    <input placeholder="ผู้รับผิดชอบ" value={stepForm.responsible_role} onChange={(e) => setStepForm((prev) => ({ ...prev, responsible_role: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                    <input placeholder="นาที" value={stepForm.target_minutes} onChange={(e) => setStepForm((prev) => ({ ...prev, target_minutes: e.target.value }))} disabled={!isOrgLevel} style={inputStyle()} />
                    <button type="button" onClick={saveStep} disabled={!isOrgLevel || saving} style={{ border: "none", borderRadius: 8, background: "#1565c0", color: "#fff", cursor: "pointer" }}>
                      เพิ่มขั้นตอน
                    </button>
                  </div>
                  <textarea
                    placeholder="คำอธิบายขั้นตอน"
                    value={stepForm.instruction}
                    onChange={(e) => setStepForm((prev) => ({ ...prev, instruction: e.target.value }))}
                    disabled={!isOrgLevel}
                    style={{ ...inputStyle(), minHeight: 56, marginBottom: 10 }}
                  />

                  {steps.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#5a7094" }}>ยังไม่มีขั้นตอน</div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {steps.map((row) => (
                        <div key={row.id} style={{ background: "#f8fbff", border: "1px solid #e3ecfb", borderRadius: 8, padding: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#17335c" }}>
                            Step {row.step_no} · {row.phase.toUpperCase()} · {row.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#4e6285", marginTop: 4 }}>{row.instruction || "-"}</div>
                          <div style={{ fontSize: 10, color: "#6c82a5", marginTop: 6 }}>
                            Owner: {row.responsible_role || "-"} · Target: {row.target_minutes || "-"} นาที
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

async function syncStrategyToBcPlan({ orgId, bcPlanId, strategyId, strategyName, stepsData }) {
  const { data: planRow, error: planError } = await supaLite
    .from("bc_plans")
    .select("id,tasks,metadata")
    .eq("org_id", orgId)
    .eq("id", bcPlanId)
    .single();
  if (planError || !planRow) return;

  const currentTasks = Array.isArray(planRow.tasks) ? planRow.tasks : [];
  const strategyTasks = (stepsData ?? []).map((step, idx) => ({
    source: "continuity_strategy",
    strategy_id: strategyId,
    step_no: step.step_no ?? idx + 1,
    phase: step.phase ?? "respond",
    title: step.title ?? "",
    instruction: step.instruction ?? "",
    owner: step.responsible_role ?? "",
    target_minutes: step.target_minutes ?? null,
  }));

  const preservedTasks = currentTasks.filter(
    (task) => !(task?.source === "continuity_strategy" && task?.strategy_id === strategyId)
  );
  const mergedTasks = [...preservedTasks, ...strategyTasks];

  const prevMetadata = planRow.metadata && typeof planRow.metadata === "object" ? planRow.metadata : {};
  const links = Array.isArray(prevMetadata.strategy_links) ? prevMetadata.strategy_links : [];
  const hasLink = links.some((x) => x?.strategy_id === strategyId);
  const nextLinks = hasLink
    ? links.map((x) => (x?.strategy_id === strategyId ? { ...x, strategy_name: strategyName } : x))
    : [...links, { strategy_id: strategyId, strategy_name: strategyName }];

  const nextMetadata = {
    ...prevMetadata,
    strategy_links: nextLinks,
    strategy_sync_at: new Date().toISOString(),
  };

  await supaLite
    .from("bc_plans")
    .update({
      tasks: mergedTasks,
      metadata: nextMetadata,
    })
    .eq("org_id", orgId)
    .eq("id", bcPlanId);
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
