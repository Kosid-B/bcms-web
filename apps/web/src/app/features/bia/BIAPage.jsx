import React, { useEffect, useState } from "react";

import {
  buildBiaProcessPayload,
  createEmptyBiaProcessForm,
} from "./bia-helpers.js";

export default function BIAPage({ orgId, pkg, onUpgrade, deps }) {
  const { supa, T, Btn, ModCard, EmptyState, DataTable, FeatureGate, Drawer } = deps;
  const [processes, setProcesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [drawer, setDrawer]       = useState(false);
  const [form, setForm]           = useState(() => createEmptyBiaProcessForm());
  const [saving, setSaving] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [autoWeights, setAutoWeights] = useState({
    impact: 60,
    rto: 25,
    mtpd: 15,
  });
  const isFree = pkg === "free";
  const IMPACT_KEYS = ["financial", "regulatory", "reputation", "operational"];
  const fmtDuration = (mins) => {
    const n = Number(mins);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const h = Math.floor(n / 60);
    const m = n % 60;
    if (h > 0 && m > 0) return `${h} ชม. ${m} นาที`;
    if (h > 0) return `${h} ชม.`;
    return `${m} นาที`;
  };

  const parseDurationToMinutes = (raw) => {
    if (raw === null || raw === undefined) return null;
    const value = String(raw).trim().toLowerCase();
    if (!value) return null;

    if (/^\d+$/.test(value)) return Number(value);

    const hhmm = value.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
    if (hhmm) {
      const h = Number(hhmm[1]);
      const m = Number(hhmm[2]);
      if (Number.isFinite(h) && Number.isFinite(m)) return (h * 60) + m;
    }

    const hm = value.match(/^(\d+)\s*(h|hr|hrs|hour|hours|ชม\.?|ชั่วโมง)\s*(\d+)?\s*(m|min|mins|minute|minutes|นาที)?$/);
    if (hm) {
      const h = Number(hm[1] || 0);
      const m = Number(hm[3] || 0);
      return (h * 60) + m;
    }

    const mm = value.match(/^(\d+)\s*(m|min|mins|minute|minutes|นาที)$/);
    if (mm) return Number(mm[1]);

    return null;
  };

  const calcAutoCriticality = (f) => {
    const impacts = f?.impacts || {};
    const impactVals = IMPACT_KEYS.map((k) => Number(impacts[k]) || 0);
    const impactAvg = impactVals.reduce((s, v) => s + v, 0) / IMPACT_KEYS.length;

    const rto = Number(f?.rto_minutes) || 0;
    const mtpd = Number(f?.mtpd_minutes) || 0;
    const rtoRisk = rto > 0 && rto <= 60 ? 5 : rto <= 240 ? 4 : rto <= 480 ? 3 : rto <= 1440 ? 2 : 1;
    const mtpdRisk = mtpd > 0 && mtpd <= 240 ? 5 : mtpd <= 480 ? 4 : mtpd <= 1440 ? 3 : mtpd <= 2880 ? 2 : 1;

    const wImpact = Number(autoWeights.impact) || 60;
    const wRto = Number(autoWeights.rto) || 25;
    const wMtpd = Number(autoWeights.mtpd) || 15;
    const wSum = Math.max(1, wImpact + wRto + wMtpd);
    const score = Math.round(
      (impactAvg * (wImpact / wSum)) +
      (rtoRisk * (wRto / wSum)) +
      (mtpdRisk * (wMtpd / wSum))
    );
    return Math.min(5, Math.max(1, score || 3));
  };

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: orgData }] = await Promise.all([
      supa.from("bia_processes")
      .select("id,name,department,owner,criticality,rto_minutes,rpo_minutes,mtpd_minutes,status,metadata,created_at")
      .eq("org_id", orgId).order("created_at", { ascending: false }),
      supa.from("organizations")
        .select("features")
        .eq("id", orgId)
        .maybeSingle(),
    ]);

    const cfg = orgData?.features?.bia_auto_weights;
    if (cfg) {
      setAutoWeights({
        impact: Number(cfg.impact) || 60,
        rto: Number(cfg.rto) || 25,
        mtpd: Number(cfg.mtpd) || 15,
      });
    }
    setProcesses(data ?? []);
    setLoading(false);
  };

  const loadDepartments = async () => {
    if (!orgId) return;
    const { data, error } = await supa
      .from("org_departments")
      .select("dept_name")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("dept_name", { ascending: true });
    if (error) {
      console.error("Failed to load org departments", error);
      return;
    }
    const names = (data ?? [])
      .map((row) => (row?.dept_name || "").trim())
      .filter(Boolean);
    setDepartments(Array.from(new Set(names)));
  };

  useEffect(() => {
    if (!orgId) return;
    load();
    loadDepartments();
  }, [orgId]);

  const atLimit = isFree && processes.length >= 3;

  const saveAutoWeights = async () => {
    if (!orgId) return;
    setWeightSaving(true);
    const { data: orgData } = await supa
      .from("organizations")
      .select("features")
      .eq("id", orgId)
      .maybeSingle();

    const nextFeatures = {
      ...(orgData?.features || {}),
      bia_auto_weights: {
        impact: Number(autoWeights.impact) || 60,
        rto: Number(autoWeights.rto) || 25,
        mtpd: Number(autoWeights.mtpd) || 15,
      },
    };

    const { error } = await supa
      .from("organizations")
      .update({ features: nextFeatures })
      .eq("id", orgId);

    setWeightSaving(false);
    if (error) {
      alert(`บันทึกค่าน้ำหนักไม่สำเร็จ: ${error.message || "Unknown error"}`);
      return;
    }
    alert("บันทึกค่าน้ำหนัก Auto Score สำเร็จ");
  };

  const handleSave = async () => {
    const name = (form.name || "").trim();
    if (!name) return;
    if (!orgId) {
      alert("ยังไม่พบ Organization ของผู้ใช้ กรุณาออกจากระบบแล้วเข้าใหม่");
      return;
    }
    setSaving(true);
    const computedCriticality = form.scoring_mode === "manual"
      ? Number(form.criticality) || 3
      : calcAutoCriticality(form);
    const rtoMinutes = parseDurationToMinutes(form.rto_minutes);
    const rpoMinutes = parseDurationToMinutes(form.rpo_minutes);
    const mtpdMinutes = parseDurationToMinutes(form.mtpd_minutes);
    const payload = buildBiaProcessPayload({
      ...form,
      name,
      criticality: computedCriticality,
      rto_minutes: rtoMinutes,
      rpo_minutes: rpoMinutes,
      mtpd_minutes: mtpdMinutes,
    }, orgId);
    const { error } = await supa.from("bia_processes").insert(payload);
    setSaving(false);
    if (error) {
      console.error("Failed to create BIA process", error);
      alert(`เพิ่ม BIA Process ไม่สำเร็จ: ${error.message || "Unknown error"}`);
      return;
    }
    setDrawer(false);
    setForm(createEmptyBiaProcessForm());
    load();
    supa.functions("plg-event",{event_name:"bia_process_created",properties:{criticality:payload.criticality}}).catch(()=>{});
  };

  const critColor = (c) => c>=5?T.red:c>=4?T.amber:c>=3?T.gold:T.green;

  return (
    <div style={{ animation:"fadeUp 0.4s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:20, fontFamily:T.serif, fontWeight:800, color:T.white }}>◇ BIA Module</div>
          <div style={{ fontSize:12, color:T.muted, fontFamily:T.sans, marginTop:2 }}>
            Business Impact Analysis · ISO 22317 · {processes.length} Process{isFree?" (สูงสุด 3)":""}
          </div>
        </div>
        <Btn size="sm" onClick={() => { if(atLimit){ onUpgrade(); return; } setDrawer(true); }}
          disabled={loading}>
          {atLimit ? "⬆ อัปเกรดเพื่อเพิ่ม" : "+ เพิ่ม Process"}
        </Btn>
      </div>

      {/* Impact Matrix summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Critical (5)", val: processes.filter(p=>p.criticality>=5).length, color:T.red },
          { label:"High (4)",     val: processes.filter(p=>p.criticality===4).length, color:T.amber },
          { label:"Medium (3)",   val: processes.filter(p=>p.criticality===3).length, color:T.gold },
          { label:"Low (1-2)",    val: processes.filter(p=>p.criticality<=2).length, color:T.green },
        ].map(k => (
          <div key={k.label} style={{ background:T.bg2, borderRadius:10, padding:"12px 14px",
            border:`1px solid ${k.color}30`, boxShadow:"var(--shadow-sm)" }}>
            <div style={{ fontSize:22, fontWeight:800, color:k.color, fontFamily:T.mono }}>{k.val}</div>
            <div style={{ fontSize:10, color:T.muted, fontFamily:T.sans, marginTop:2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Auto score formula weights */}
      <ModCard style={{ marginBottom: 16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.white, fontFamily:T.sans, marginBottom:10 }}>
          ตั้งค่าน้ำหนัก Auto Criticality (ระดับองค์กร)
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10 }}>
          {[
            { key:"impact", label:"Impact %" },
            { key:"rto", label:"RTO %" },
            { key:"mtpd", label:"MTPD %" },
          ].map((w) => (
            <div key={w.key} style={{ background:T.bg3, border:`1px solid ${T.border}`, borderRadius:10, padding:10 }}>
              <div style={{ fontSize:11, color:T.muted2, marginBottom:6 }}>{w.label}</div>
              <input
                type="number"
                min={0}
                max={100}
                value={autoWeights[w.key]}
                onChange={(e) => setAutoWeights((p) => ({ ...p, [w.key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                style={{ width:"100%", padding:"8px 10px", background:T.bg2, border:`1px solid ${T.border}`, borderRadius:8, color:T.white, boxSizing:"border-box" }}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <div style={{ fontSize:11, color:T.muted, fontFamily:T.sans }}>
            รวมปัจจุบัน: {(Number(autoWeights.impact)||0)+(Number(autoWeights.rto)||0)+(Number(autoWeights.mtpd)||0)}%
          </div>
          <Btn size="sm" onClick={saveAutoWeights} disabled={weightSaving}>
            {weightSaving ? "กำลังบันทึก..." : "บันทึกค่าน้ำหนัก"}
          </Btn>
        </div>
      </ModCard>

      <ModCard>
        {loading ? (
          <div style={{ padding:32, textAlign:"center" }}>
            <span style={{ width:20,height:20,border:`2px solid ${T.border}`,borderTopColor:T.gold,
              borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }}/>
          </div>
        ) : processes.length === 0 ? (
          <EmptyState icon="◇" title="ยังไม่มี BIA Process"
            desc="เริ่มต้นด้วยการวิเคราะห์กระบวนการที่สำคัญขององค์กร"
            cta="+ เพิ่ม Process แรก" onCta={() => setDrawer(true)} />
        ) : (
          <DataTable
            cols={[
              { key:"name", label:"ชื่อ Process" },
              { key:"department", label:"ฝ่าย/แผนก" },
              { key:"criticality", label:"Criticality",
                render: v => <span style={{ background:critColor(v)+"18", color:critColor(v),
                  borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:700, fontFamily:T.mono }}>{v}</span> },
              { key:"rto_minutes", label:"RTO (เวลา)", mono:true,
                render: v => fmtDuration(v) },
              { key:"rpo_minutes", label:"RPO (เวลา)", mono:true,
                render: v => fmtDuration(v) },
              { key:"metadata", label:"Mode",
                render: v => (
                  <span style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>
                    {(v?.scoring_mode || "auto").toUpperCase()}
                  </span>
                ) },
              { key:"status", label:"Status",
                render: v => <span style={{ fontSize:10, color:v==="approved"?T.green:v==="reviewed"?T.teal:T.amber,
                  fontFamily:T.mono }}>{v?.toUpperCase()}</span> },
            ]}
            rows={processes}
          />
        )}
      </ModCard>

      {/* Heatmap */}
      <div style={{ marginTop: 16 }}>
        <ModCard>
          <div style={{ fontSize:13, fontWeight:700, color:T.white, fontFamily:T.sans, marginBottom:10 }}>
            Heatmap กระบวนการ (Criticality)
          </div>
          {processes.length === 0 ? (
            <div style={{ fontSize:11, color:T.muted, fontFamily:T.sans }}>ยังไม่มีข้อมูลสำหรับ Heatmap</div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10 }}>
              {processes.slice(0, 20).map((p) => {
                const c = Number(p.criticality) || 1;
                const bg = c >= 5 ? "#7f1d1d" : c >= 4 ? "#92400e" : c >= 3 ? "#854d0e" : "#14532d";
                return (
                  <div key={p.id} style={{ border:`1px solid ${T.border}`, borderRadius:10, padding:10, background:bg+"66" }}>
                    <div style={{ fontSize:12, color:T.white, fontWeight:700, fontFamily:T.sans, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize:10, color:T.muted2, marginTop:4, fontFamily:T.sans }}>
                      {p.department || "ไม่ระบุแผนก"}
                    </div>
                    <div style={{ marginTop:8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>{(p.metadata?.scoring_mode || "auto").toUpperCase()}</span>
                      <span style={{ fontSize:12, fontFamily:T.mono, fontWeight:800, color:"#fff" }}>C{c}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ModCard>
      </div>

      {/* Export gate */}
      <div style={{ marginTop:16 }}>
        <FeatureGate featureId="export" userPkg={pkg} onUpgrade={onUpgrade}>
          <div style={{ background:T.bg3, borderRadius:12, padding:16, border:`1px solid ${T.border}`,
            display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:24 }}>📊</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.white, fontFamily:T.sans }}>Export BIA Report</div>
              <div style={{ fontSize:11, color:T.muted, fontFamily:T.sans }}>ส่งออกรายงาน BIA เป็น PDF หรือ Excel</div>
            </div>
            <Btn size="sm" variant="outline" onClick={() => {
              supa.functions("plg-event",{event_name:"report_exported",properties:{module:"bia"}}).catch(()=>{});
              alert("กำลังสร้างรายงาน... (ฟีเจอร์นี้จะเชื่อมต่อ PDF generator ใน production)");
            }}>Export PDF</Btn>
          </div>
        </FeatureGate>
      </div>

      {/* Create Drawer */}
      <Drawer title="เพิ่ม BIA Process ใหม่" open={drawer} onClose={() => setDrawer(false)}>
        {[
          { l:"ชื่อกระบวนการ *", k:"name", placeholder:"e.g. Order Processing" },
          { l:"เจ้าของกระบวนการ", k:"owner", placeholder:"ชื่อ-นามสกุล" },
          { l:"RTO (เวลา)", k:"rto_minutes", placeholder:"เช่น 4h หรือ 04:00" },
          { l:"RPO (เวลา)", k:"rpo_minutes", placeholder:"เช่น 1h หรือ 01:00" },
          { l:"MTPD (เวลา)", k:"mtpd_minutes", placeholder:"เช่น 24h หรือ 24:00" },
        ].map(f => (
          <div key={f.k} style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:600, color:T.muted2, fontFamily:T.sans,
              display:"block", marginBottom:5 }}>{f.l}</label>
            <input type={f.type||"text"} value={form[f.k]}
              onChange={e => setForm(p=>({...p,[f.k]:e.target.value}))}
              placeholder={f.placeholder}
              style={{ width:"100%", padding:"9px 12px", background:T.bg3,
                border:`1px solid ${T.border}`, borderRadius:8, color:T.white,
                fontSize:13, fontFamily:T.sans, boxSizing:"border-box" }}/>
            {(f.k === "rto_minutes" || f.k === "rpo_minutes" || f.k === "mtpd_minutes") && (
              <div style={{ marginTop:4, fontSize:10, color:T.muted, fontFamily:T.sans }}>
                รองรับรูปแบบเวลา: `HH:MM`, `4h`, `90 นาที`
              </div>
            )}
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:T.muted2, fontFamily:T.sans,
            display:"block", marginBottom:5 }}>ฝ่าย/แผนก</label>
          <select
            value={form.department || ""}
            onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
            style={{ width:"100%", padding:"9px 12px", background:T.bg3,
              border:`1px solid ${T.border}`, borderRadius:8, color:T.white,
              fontSize:13, fontFamily:T.sans, boxSizing:"border-box" }}
          >
            <option value="">เลือกแผนก</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
            {!!form.department && !departments.includes(form.department) && (
              <option value={form.department}>{form.department}</option>
            )}
          </select>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:T.muted2, fontFamily:T.sans,
            display:"block", marginBottom:5 }}>รูปแบบการให้คะแนน</label>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { key:"auto", label:"Auto Score" },
              { key:"manual", label:"Manual Score" },
            ].map((m) => (
              <button key={m.key} type="button" onClick={() => setForm((p) => ({ ...p, scoring_mode: m.key }))}
                style={{ flex:1, padding:"8px", borderRadius:8, border:`1px solid ${T.border}`,
                  background: form.scoring_mode===m.key ? T.teal : T.bg3,
                  color:"#fff", fontSize:12, cursor:"pointer", fontFamily:T.sans }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:T.muted2, fontFamily:T.sans,
            display:"block", marginBottom:5 }}>Impact Scores (0-5)</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8 }}>
            {IMPACT_KEYS.map((k) => (
              <div key={k}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:4, textTransform:"capitalize" }}>{k}</div>
                <input type="number" min={0} max={5}
                  value={form.impacts?.[k] ?? 0}
                  onChange={(e) => setForm((p) => ({
                    ...p,
                    impacts: { ...(p.impacts || {}), [k]: Math.max(0, Math.min(5, Number(e.target.value) || 0)) },
                  }))}
                  style={{ width:"100%", padding:"8px 10px", background:T.bg3, border:`1px solid ${T.border}`, borderRadius:8, color:T.white, fontSize:12, boxSizing:"border-box" }}/>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:T.muted2, fontFamily:T.sans,
            display:"block", marginBottom:5 }}>Criticality (1=ต่ำ, 5=วิกฤต)</label>
          <div style={{ display:"flex", gap:8 }}>
            {[1,2,3,4,5].map(v => (
              <button key={v} onClick={() => setForm(p=>({...p,criticality:v}))}
                disabled={form.scoring_mode !== "manual"}
                style={{ flex:1, padding:"8px", borderRadius:8, border:"none",
                  background: form.criticality===v ? critColor(v) : T.bg3,
                  color: form.criticality===v ? "#fff" : T.muted,
                  fontWeight:700, fontSize:14, fontFamily:T.mono, cursor: form.scoring_mode === "manual" ? "pointer" : "not-allowed",
                  opacity: form.scoring_mode === "manual" ? 1 : 0.5 }}>{v}</button>
            ))}
          </div>
          <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>
            {form.scoring_mode === "manual"
              ? "Manual mode: ผู้ใช้กำหนด Criticality เอง"
              : `Auto mode: ระบบคำนวณให้อัตโนมัติ = C${calcAutoCriticality(form)}`}
          </div>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:T.muted2, fontFamily:T.sans,
            display:"block", marginBottom:5 }}>คำอธิบาย</label>
          <textarea value={form.description} rows={3}
            onChange={e => setForm(p=>({...p,description:e.target.value}))}
            style={{ width:"100%", padding:"9px 12px", background:T.bg3,
              border:`1px solid ${T.border}`, borderRadius:8, color:T.white,
              fontSize:13, fontFamily:T.sans, resize:"vertical", boxSizing:"border-box" }}/>
        </div>
        <Btn full onClick={handleSave} disabled={saving || !form.name}>
          {saving ? "กำลังบันทึก..." : "บันทึก BIA Process"}
        </Btn>
      </Drawer>
    </div>
  );
}
