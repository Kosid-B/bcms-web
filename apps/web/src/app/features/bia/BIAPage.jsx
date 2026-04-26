import React, { useEffect, useState } from "react";

import {
  buildBiaProcessPayload,
  createEmptyBiaProcessForm,
} from "./bia-helpers.js";

export default function BIAPage({ orgId, pkg, onUpgrade, deps }) {
  const { supa, T, Btn, ModCard, EmptyState, DataTable, FeatureGate, Drawer } = deps;
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [drawer, setDrawer]       = useState(false);
  const [form, setForm]           = useState(() => createEmptyBiaProcessForm());
  const [saving, setSaving] = useState(false);
  const isFree = pkg === "free";

  const load = async () => {
    setLoading(true);
    const { data } = await supa.from("bia_processes")
      .select("id,name,department,owner,criticality,rto_minutes,rpo_minutes,status,created_at")
      .eq("org_id", orgId).order("created_at", { ascending: false });
    setProcesses(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (orgId) load(); }, [orgId]);

  const atLimit = isFree && processes.length >= 3;

  const handleSave = async () => {
    const name = (form.name || "").trim();
    if (!name) return;
    if (!orgId) {
      alert("ยังไม่พบ Organization ของผู้ใช้ กรุณาออกจากระบบแล้วเข้าใหม่");
      return;
    }
    setSaving(true);
    const payload = buildBiaProcessPayload({ ...form, name }, orgId);
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
              { key:"rto_minutes", label:"RTO (นาที)", mono:true,
                render: v => v ? v.toLocaleString() : "—" },
              { key:"rpo_minutes", label:"RPO (นาที)", mono:true,
                render: v => v ? v.toLocaleString() : "—" },
              { key:"status", label:"Status",
                render: v => <span style={{ fontSize:10, color:v==="approved"?T.green:v==="reviewed"?T.teal:T.amber,
                  fontFamily:T.mono }}>{v?.toUpperCase()}</span> },
            ]}
            rows={processes}
          />
        )}
      </ModCard>

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
          { l:"ฝ่าย/แผนก", k:"department", placeholder:"e.g. Operations" },
          { l:"เจ้าของกระบวนการ", k:"owner", placeholder:"ชื่อ-นามสกุล" },
          { l:"RTO (นาที)", k:"rto_minutes", placeholder:"240", type:"number" },
          { l:"RPO (นาที)", k:"rpo_minutes", placeholder:"60", type:"number" },
          { l:"MTPD (นาที)", k:"mtpd_minutes", placeholder:"1440", type:"number" },
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
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:T.muted2, fontFamily:T.sans,
            display:"block", marginBottom:5 }}>Criticality (1=ต่ำ, 5=วิกฤต)</label>
          <div style={{ display:"flex", gap:8 }}>
            {[1,2,3,4,5].map(v => (
              <button key={v} onClick={() => setForm(p=>({...p,criticality:v}))}
                style={{ flex:1, padding:"8px", borderRadius:8, border:"none",
                  background: form.criticality===v ? critColor(v) : T.bg3,
                  color: form.criticality===v ? "#fff" : T.muted,
                  fontWeight:700, fontSize:14, fontFamily:T.mono, cursor:"pointer" }}>{v}</button>
            ))}
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
