import React, { useEffect, useRef, useState } from "react";

import {
  buildBiaWizardPayload,
  createEmptyBiaWizardForm,
} from "./bia-helpers.js";

export default function BIAWizardPage({ orgId, pkg, onUpgrade, deps }) {
  const { supa, T, FeatureGate, ACTIVITY_TEMPLATES, INDUSTRY_BENCHMARKS } = deps;
  const [step, setStep]           = useState(1);
  const [saving, setSaving]       = useState(false);
  const [saved,  setSaved]        = useState(false);
  const [tooltip, setTooltip]     = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [search, setSearch]       = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const [form, setForm] = useState(() => createEmptyBiaWizardForm());
  const resetTimerRef = useRef(null);
  const aiTimerRef = useRef(null);

  // Derived values
  const impactScores = form.impacts;
  const maxImpact    = Math.max(...Object.values(impactScores));
  const avgImpact    = Object.values(impactScores).reduce((a,b)=>a+b,0) / 4;
  const criticality  = Math.min(5, Math.ceil(maxImpact || avgImpact));

  // MAC helpers
  const macColor = (pct) => pct<=25?T.red:pct<=40?T.amber:pct<=60?T.gold:T.green;
  const macLabel = (pct) => pct<=25?"วิกฤต":pct<=40?"สูง":pct<=60?"ปานกลาง":"ต่ำ";

  // Suggest RTO based on MAC% + criticality
  const suggestRTO = () => {
    const base = form.mac_pct<=25?240:form.mac_pct<=40?480:form.mac_pct<=60?960:1440;
    const f2   = criticality>=4?0.5:criticality>=3?0.75:1.0;
    return Math.round(base * f2 / 60) * 60;
  };

  const applyTemplate = (tmpl) => {
    setForm(f => ({
      ...f, name:tmpl.name, industry:tmpl.industry,
      rto_minutes:tmpl.rto_hint, rpo_minutes:Math.floor(tmpl.rpo_hint),
      mac_pct: tmpl.mac_pct || 40,
    }));
    setShowTemplates(false); setSearch("");
  };

  const applyAISuggestion = () => {
    setAiLoading(true);
    const bench = INDUSTRY_BENCHMARKS[form.industry] || INDUSTRY_BENCHMARKS.all;
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      setForm(f => ({
        ...f,
        impacts:{ financial:bench.financial, regulatory:bench.regulatory,
          reputation:bench.reputation, operational:bench.operational },
        rto_minutes: bench.rto,
        mac_pct: bench.mac_pct || 40,
      }));
      setAiLoading(false);
      aiTimerRef.current = null;
    }, 900);
  };

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
  }, []);

  const setResource = (type,idx,val) => setForm(f => {
    const a=[...f.resources[type]]; a[idx]=val;
    return {...f,resources:{...f.resources,[type]:a}};
  });
  const addResource = (type) => setForm(f => ({
    ...f, resources:{...f.resources,[type]:[...f.resources[type],""]}
  }));

  const handleFinish = async () => {
    if (!orgId) {
      alert("ยังไม่พบ Organization ของผู้ใช้ กรุณาออกจากระบบแล้วเข้าใหม่");
      return;
    }
    if (!(form.name || "").trim()) return;
    setSaving(true);
    const payload = buildBiaWizardPayload(form, orgId, criticality, macLabel);
    const { error } = await supa.from("bia_processes").insert(payload);
    if (error) {
      setSaving(false);
      console.error("Failed to create BIA wizard process", error);
      alert(`บันทึก BIA ไม่สำเร็จ: ${error.message || "Unknown error"}`);
      return;
    }
    supa.functions("plg-event",{
      event_name:"bia_wizard_v3_completed",
      properties:{ criticality, mac_pct:form.mac_pct, rto_minutes:form.rto_minutes }
    }).catch(()=>{});
    setSaving(false); setSaved(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setSaved(false); setStep(1);
      setForm(createEmptyBiaWizardForm());
      resetTimerRef.current = null;
    }, 2400);
  };

  const canNext = () => {
    if (step===1) return form.name.length > 0;
    if (step===2) return Object.values(form.impacts).some(v=>v>0);
    if (step===3) return form.mac_pct >= 10 && form.rto_minutes !== null;
    return true;
  };

  const STEPS = [
    { id:1, label:"เลือกงาน",  icon:"📋" },
    { id:2, label:"ผลกระทบ",   icon:"💥" },
    { id:3, label:"MAC & RTO",  icon:"⚡" },
    { id:4, label:"ทรัพยากร",  icon:"🔗" },
    { id:5, label:"สรุป",       icon:"✅" },
  ];

  const filteredTemplates = ACTIVITY_TEMPLATES.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.cat.includes(search)
  );

  // ── MAC Capacity Visual Component ────────────────────────────
  const MACCapacityChart = ({ macPct, rtoMinutes }) => {
    if (!macPct || !rtoMinutes) return null;
    const mc  = macColor(macPct);
    const fmtM = (m) => !m?"—":m<60?`${m}m`:m<1440?`${Math.round(m/60)}h`:`${Math.round(m/1440)}d`;
    return (
      <div style={{ marginTop:18 }}>
        {/* Capacity zone diagram */}
        <div style={{ background:"#F0F6FF", borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0D1B3E",
            fontFamily:"'Kanit',sans-serif", marginBottom:12 }}>
            📊 MAC Capacity Zone — Trigger Point Visualization
          </div>
          {/* Zone bar */}
          <div style={{ position:"relative", height:48, borderRadius:10,
            overflow:"hidden", background:"rgba(197,212,240,0.2)" }}>
            {/* Risk zone (0 → MAC%) */}
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${macPct}%`,
              background:"rgba(220,38,38,0.1)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:9, color:"#DC2626", fontWeight:700,
                fontFamily:"'Kanit',sans-serif" }}>⚠️ BC Plan Active</span>
            </div>
            {/* Safe zone (MAC% → 100%) */}
            <div style={{ position:"absolute", left:`${macPct}%`, right:0, top:0, bottom:0,
              background:"rgba(5,150,105,0.07)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:9, color:"#059669", fontFamily:"'Kanit',sans-serif" }}>
                ✅ Acceptable ({macPct}–100%)
              </span>
            </div>
            {/* MAC threshold line */}
            <div style={{ position:"absolute", top:0, bottom:0, left:`${macPct}%`,
              width:2, background:mc, zIndex:2 }}/>
            {/* Trigger arrow */}
            <div style={{ position:"absolute", top:4, left:`${macPct}%`,
              transform:"translateX(-50%)",
              background:mc, color:"white", fontSize:7,
              fontFamily:"'DM Mono',monospace", fontWeight:800,
              padding:"2px 5px", borderRadius:4, zIndex:3, whiteSpace:"nowrap" }}>
              MAC {macPct}% ← Trigger
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6,
            fontSize:8, color:"#64748B", fontFamily:"'Kanit',sans-serif" }}>
            <span style={{ color:"#DC2626" }}>0% (หยุดทั้งหมด)</span>
            <span style={{ color:mc, fontWeight:700 }}>⬆ Trigger Point</span>
            <span style={{ color:"#059669" }}>100% (ปกติ)</span>
          </div>
        </div>

        {/* Timeline steps */}
        <div style={{ background:"#F0F6FF", borderRadius:12, padding:"14px 18px", marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0D1B3E",
            fontFamily:"'Kanit',sans-serif", marginBottom:10 }}>
            ⏱ RTO Timeline — ตั้งแต่ Trigger จนกู้คืนถึง MAC {macPct}%
          </div>
          <div style={{ display:"flex", alignItems:"stretch" }}>
            {[
              { icon:"⚡", label:"เหตุการณ์เกิด",    color:"#DC2626", flex:2 },
              { icon:"🔴", label:`Capacity < ${macPct}% / Trigger`, color:mc, flex:2 },
              { icon:"📋", label:"BC Plan / เปิดทำงาน", color:T.amber, flex:2 },
              { icon:"⏱", label:`RTO ${fmtM(rtoMinutes)}`, color:T.amber, flex:3 },
              { icon:"📈", label:`Recovery ≥${macPct}%`, color:"#059669", flex:2 },
            ].map((seg,i) => (
              <div key={i} style={{ flex:seg.flex, textAlign:"center", padding:"8px 4px",
                borderRight:i<4?`1px solid #C5D4F0`:"none" }}>
                <div style={{ fontSize:16, marginBottom:2 }}>{seg.icon}</div>
                <div style={{ fontSize:8, fontWeight:700, color:seg.color, lineHeight:1.4,
                  fontFamily:"'Kanit',sans-serif", whiteSpace:"pre-line" }}>{seg.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ISO 22301 compliance */}
        <div style={{ background:"#F0F6FF", borderRadius:10, padding:"12px 16px",
          border:`1px dashed ${mc}40` }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#475569",
            fontFamily:"'Kanit',sans-serif", marginBottom:8 }}>
            ⚖️ ตรวจสอบตาม ISO 22301:2019 §8.3 & §8.4
          </div>
          {[
            { check:`MAC กำหนดที่ ${macPct}% — MBCO (Minimum Business Continuity Objective)`,  pass:true },
            { check:`RTO = ${fmtM(rtoMinutes)} — เป้ากู้คืนกลับสู่ MAC% หลัง Trigger Point`,   pass:rtoMinutes>0 },
            { check:"Trigger Point ชัดเจน — Capacity < MAC% = BC Plan ถูกเปิดใช้งานทันที",      pass:true },
            { check:"สอดคล้อง §8.4 — BC Plan ระบุ conditions ที่จะเปิดใช้งาน",                 pass:true },
          ].map((c,i) => (
            <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:5 }}>
              <span style={{ fontSize:12, color:c.pass?"#059669":"#DC2626", flexShrink:0 }}>{c.pass?"✓":"✗"}</span>
              <span style={{ fontSize:10, color:"#64748B",
                fontFamily:"'Kanit',sans-serif", lineHeight:1.5 }}>{c.check}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <FeatureGate featureId="bcplan" userPkg={pkg} onUpgrade={onUpgrade}>
      <div style={{ animation:"fadeUp 0.4s ease" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
          marginBottom:20, flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontSize:20, fontFamily:"'Kanit',sans-serif", fontWeight:800, color:"#0D1B3E" }}>
              🧙 BIA Wizard — MAC & RTO
            </div>
            <div style={{ fontSize:12, color:"#64748B", fontFamily:"'Kanit',sans-serif", marginTop:2 }}>
              ISO 22301 §8.3 · กำหนด <strong>MAC (Minimum Acceptable Capacity)</strong> + RTO Trigger Point ต่อกระบวนการสำคัญ
            </div>
          </div>
          <button onClick={applyAISuggestion} disabled={aiLoading}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
              borderRadius:8, border:"1px solid #1565C020",
              background:"rgba(21,101,192,0.06)", cursor:"pointer",
              color:"#1565C0", fontSize:11, fontFamily:"'Kanit',sans-serif", fontWeight:600 }}>
            {aiLoading ? "⏳ กำลังดึงข้อมูล..." : "🤖 AI Suggest MAC/RTO"}
          </button>
        </div>

        {/* Step progress */}
        <div style={{ display:"flex", gap:0, marginBottom:28, position:"relative" }}>
          <div style={{ position:"absolute", top:16, left:16, right:16, height:2,
            background:"rgba(197,212,240,0.5)", zIndex:0 }}/>
          <div style={{ position:"absolute", top:16, left:16, height:2, zIndex:1, transition:"width 0.4s",
            background:"linear-gradient(90deg, #1565C0, #0284C7)",
            width:`${Math.max(0,((step-1)/(STEPS.length-1))*100)}%` }}/>
          {STEPS.map(s => {
            const done=s.id<step; const active=s.id===step;
            return (
              <div key={s.id} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, zIndex:2 }}>
                <div style={{ width:32, height:32, borderRadius:"50%",
                  background:done?"#059669":active?"#1565C0":"#F0F6FF",
                  border:`2px solid ${done?"#059669":active?"#1565C0":"#C5D4F0"}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, transition:"all 0.2s", color:done||active?"#fff":"#64748B" }}>
                  {done?"✓":s.icon}
                </div>
                <div style={{ fontSize:8, color:active?"#1565C0":"#64748B",
                  fontFamily:"'Kanit',sans-serif", textAlign:"center",
                  fontWeight:active?700:400, maxWidth:64, lineHeight:1.3 }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* 2-col layout */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:20, alignItems:"start" }}>
          <div>

          {/* ════ STEP 1: เลือกกระบวนการ ════ */}
          {step===1 && (
            <div style={{ background:"#FFFFFF", borderRadius:14, padding:22,
              border:"1px solid #C5D4F0", animation:"fadeUp 0.2s ease" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0D1B3E",
                fontFamily:"'Kanit',sans-serif", marginBottom:16 }}>
                📋 ส่วนที่ 1 — เลือกกระบวนการที่จะประเมิน
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, fontWeight:600, color:"#475569",
                  fontFamily:"'Kanit',sans-serif", display:"block", marginBottom:6 }}>
                  🔍 ค้นหาหรือเลือกจากเทมเพลตมาตรฐาน
                </label>
                <div style={{ position:"relative" }}>
                  <input value={form.name||search}
                    onChange={e => { setSearch(e.target.value); setForm(f=>({...f,name:e.target.value})); setShowTemplates(true); }}
                    onFocus={() => setShowTemplates(true)}
                    placeholder="พิมพ์ชื่อ หรือเลือกจากรายการ เช่น 'ชำระเงิน', 'IT', 'สำรองข้อมูล'..."
                    style={{ width:"100%", padding:"11px 14px", background:"#E8F0FE",
                      border:`1.5px solid ${showTemplates?"#1565C0":"#C5D4F0"}`,
                      borderRadius:10, color:"#0D1B3E", fontSize:13,
                      fontFamily:"'Kanit',sans-serif", boxSizing:"border-box", outline:"none" }}/>
                  {showTemplates && (
                    <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:100,
                      background:"#FFFFFF", borderRadius:10, border:"1px solid #C5D4F0",
                      boxShadow:"0 8px 24px rgba(21,101,192,0.12)", maxHeight:240, overflowY:"auto" }}>
                      {filteredTemplates.map(tmpl => (
                        <div key={tmpl.id} onClick={() => applyTemplate(tmpl)}
                          style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                            cursor:"pointer", borderBottom:"1px solid #E8F0FE" }}
                          onMouseEnter={e => e.currentTarget.style.background="#E8F0FE"}
                          onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                          <span style={{ fontSize:16 }}>{tmpl.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:"#0D1B3E",
                              fontFamily:"'Kanit',sans-serif" }}>{tmpl.name}</div>
                            <div style={{ fontSize:9, color:"#64748B", fontFamily:"'Kanit',sans-serif" }}>
                              {tmpl.cat} · MAC {tmpl.mac_pct||40}% · RTO {tmpl.rto_hint<60?`${tmpl.rto_hint}m`:`${tmpl.rto_hint/60}h`}
                            </div>
                          </div>
                          <span style={{ fontSize:10, background:"rgba(21,101,192,0.08)",
                            color:"#1565C0", borderRadius:6, padding:"2px 8px",
                            fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                            MAC {tmpl.mac_pct||40}%
                          </span>
                        </div>
                      ))}
                      {filteredTemplates.length===0 && (
                        <div style={{ padding:"12px 14px", fontSize:11, color:"#64748B",
                          fontFamily:"'Kanit',sans-serif" }}>
                          ไม่พบเทมเพลต — พิมพ์ชื่อกระบวนการเองได้เลย
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { l:"ฝ่าย/แผนก", k:"department", ph:"e.g. IT / Operations / Finance" },
                  { l:"เจ้าของกระบวนการ", k:"owner", ph:"ชื่อ-นามสกุล หัวหน้า" },
                ].map(fld => (
                  <div key={fld.k}>
                    <label style={{ fontSize:11, fontWeight:600, color:"#475569",
                      fontFamily:"'Kanit',sans-serif", display:"block", marginBottom:5 }}>{fld.l}</label>
                    <input value={form[fld.k]} onChange={e=>setForm(p=>({...p,[fld.k]:e.target.value}))}
                      placeholder={fld.ph}
                      style={{ width:"100%", padding:"9px 12px", background:"#E8F0FE",
                        border:"1px solid #C5D4F0", borderRadius:8, color:"#0D1B3E",
                        fontSize:12, fontFamily:"'Kanit',sans-serif", boxSizing:"border-box" }}/>
                  </div>
                ))}
              </div>
              {form.name && (
                <div style={{ marginTop:14, padding:"10px 14px", background:"#E8F0FE",
                  borderRadius:8, border:"1px solid #C5D4F040",
                  display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:16 }}>✅</span>
                  <span style={{ fontSize:12, fontFamily:"'Kanit',sans-serif", color:"#0D1B3E" }}>
                    จะประเมิน: <strong>"{form.name}"</strong>
                    {form.department && ` — ${form.department}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ════ STEP 2: ผลกระทบ ════ */}
          {step===2 && (
            <div style={{ background:"#FFFFFF", borderRadius:14, padding:22,
              border:"1px solid #C5D4F0", animation:"fadeUp 0.2s ease" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0D1B3E",
                fontFamily:"'Kanit',sans-serif", marginBottom:6 }}>
                💥 ส่วนที่ 2 — ผลกระทบเมื่อ "{form.name}" หยุดทำงาน
              </div>
              <div style={{ fontSize:11, color:"#64748B", fontFamily:"'Kanit',sans-serif",
                marginBottom:20, lineHeight:1.6 }}>
                เลื่อนเมาส์บนคะแนนเพื่อดูคำอธิบาย · คลิกเพื่อเลือก · คะแนน 5 = วิกฤตที่สุด
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {Object.entries(IMPACT_MATRIX).map(([key, cfg]) => {
                  const val = impactScores[key] || 0;
                  return (
                    <div key={key} style={{ padding:"14px 16px", background:"#F0F6FF",
                      borderRadius:12, border:`1.5px solid ${val>0?cfg.color+"35":"#C5D4F0"}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                        <span style={{ fontSize:16 }}>{cfg.icon}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:"#0D1B3E",
                          fontFamily:"'Kanit',sans-serif" }}>{cfg.label}</span>
                        {val>0 && (
                          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:"50%",
                              background:val>=4?T.red:val>=3?T.amber:val>=2?T.gold:T.green }}/>
                            <span style={{ fontSize:10, color:cfg.color,
                              fontFamily:"'DM Mono',monospace", fontWeight:800 }}>{val}/5</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display:"flex", gap:6, marginBottom:tooltip?.key===key?8:0 }}>
                        {[1,2,3,4,5].map(lv => {
                          const sel=val===lv;
                          const bc=lv<=2?"#059669":lv===3?"#D97706":lv===4?"#EA580C":"#DC2626";
                          return (
                            <button key={lv}
                              onMouseEnter={()=>setTooltip({key,level:lv})}
                              onMouseLeave={()=>setTooltip(null)}
                              onClick={()=>setForm(f=>({...f,impacts:{...f.impacts,[key]:lv}}))}
                              style={{ flex:1, padding:"10px 0", borderRadius:10, border:"none",
                                cursor:"pointer", transition:"all 0.15s",
                                background:sel?bc:lv<=val?`${bc}20`:"#FFFFFF",
                                color:sel?"#FFFFFF":val>0&&lv<=val?bc:"#94A3B8",
                                fontWeight:800, fontSize:15, fontFamily:"'DM Mono',monospace",
                                boxShadow:sel?`0 2px 8px ${bc}40, 0 0 0 2px ${bc}`:"0 1px 3px rgba(0,0,0,0.06)",
                                transform:sel?"scale(1.12)":"scale(1)" }}>
                              {lv}
                            </button>
                          );
                        })}
                      </div>
                      {tooltip?.key===key && (
                        <div style={{ marginTop:8, padding:"8px 12px", background:"#0D1B3E",
                          borderRadius:8, fontSize:11, color:"#FFFFFF",
                          fontFamily:"'Kanit',sans-serif", lineHeight:1.5, animation:"fadeUp 0.15s ease" }}>
                          <span style={{ color:cfg.color, fontWeight:700 }}>คะแนน {tooltip.level}: </span>
                          {cfg.tooltips[tooltip.level]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {Object.values(impactScores).some(v=>v>0) && (
                <div style={{ marginTop:16, padding:"14px 18px", borderRadius:12,
                  background:criticality>=5?"#DC262610":criticality>=4?"#D9770610":criticality>=3?"#1D4ED810":"#05966910",
                  border:`1.5px solid ${criticality>=5?T.red:criticality>=4?T.amber:criticality>=3?"#1D4ED8":T.green}40` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#0D1B3E",
                        fontFamily:"'Kanit',sans-serif" }}>ระดับความสำคัญโดยรวม (Criticality)</div>
                      <div style={{ fontSize:10, color:"#64748B", marginTop:2 }}>
                        ISO 22317 §5.3.2 — ใช้กำหนด MAC% แนะนำ
                      </div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:28, fontWeight:800, fontFamily:"'DM Mono',monospace",
                        color:criticality>=5?T.red:criticality>=4?T.amber:criticality>=3?"#1D4ED8":T.green }}>
                        {criticality}/5
                      </div>
                      <div style={{ fontSize:10, color:criticality>=5?T.red:criticality>=4?T.amber:"#1D4ED8" }}>
                        {criticality>=5?"CRITICAL":criticality>=4?"HIGH":criticality>=3?"MEDIUM":"LOW"}
                      </div>
                    </div>
                  </div>
                  {criticality>=4 && (
                    <div style={{ marginTop:10, fontSize:10, color:"#DC2626",
                      background:"rgba(220,38,38,0.06)", borderRadius:6, padding:"6px 10px" }}>
                      ⚡ แนะนำ: MAC ≤ {criticality>=5?"25%":"35%"} และ RTO ≤ {criticality>=5?"4 ชั่วโมง":"8 ชั่วโมง"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ STEP 3: MAC & RTO ════ */}
          {step===3 && (
            <div style={{ background:"#FFFFFF", borderRadius:14, padding:22,
              border:"1px solid #C5D4F0", animation:"fadeUp 0.2s ease" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0D1B3E",
                fontFamily:"'Kanit',sans-serif", marginBottom:6 }}>
                ⚡ ส่วนที่ 3 — MAC (Minimum Acceptable Capacity) & RTO Trigger
              </div>
              <div style={{ fontSize:11, color:"#64748B", fontFamily:"'Kanit',sans-serif",
                marginBottom:20, lineHeight:1.7 }}>
                <span style={{ color:"#1565C0", fontWeight:700 }}>MAC%</span> = ระดับกำลังการผลิต/บริการขั้นต่ำสุดที่ยอมรับได้ระหว่างเหตุขัดข้อง
                <br/>เมื่อ Actual Capacity ตกต่ำกว่า MAC% →
                <span style={{ color:T.red, fontWeight:700 }}> Trigger Point</span> →
                BC Plan เปิดทำงาน →
                <span style={{ color:T.amber, fontWeight:700 }}> RTO นาฬิกาเริ่มนับ</span>
              </div>

              {/* MAC % Slider */}
              <div style={{ marginBottom:26, padding:"18px 20px", background:"#F0F6FF",
                borderRadius:12, border:"1px solid #C5D4F0" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <label style={{ fontSize:12, fontWeight:800, color:"#0D1B3E",
                    fontFamily:"'Kanit',sans-serif" }}>
                    📊 MAC% — Minimum Acceptable Capacity
                  </label>
                  <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                    <span style={{ fontSize:28, fontWeight:800,
                      color:macColor(form.mac_pct), fontFamily:"'DM Mono',monospace" }}>
                      {form.mac_pct}%
                    </span>
                    <span style={{ fontSize:10, color:macColor(form.mac_pct),
                      fontFamily:"'Kanit',sans-serif", fontWeight:700 }}>
                      [{macLabel(form.mac_pct)}]
                    </span>
                  </div>
                </div>
                <input type="range" min={10} max={80} step={5}
                  value={form.mac_pct}
                  onChange={e => setForm(f => ({...f, mac_pct:Number(e.target.value)}))}
                  style={{ width:"100%", accentColor:macColor(form.mac_pct), cursor:"pointer", height:6 }}/>
                <div style={{ display:"flex", gap:2, marginTop:6 }}>
                  {["≤25% วิกฤต","26–40% สูง","41–60% กลาง",">60% ต่ำ"].map((l,i) => (
                    <div key={l} style={{ flex:1, padding:"3px 0", borderRadius:4, textAlign:"center",
                      background:["#DC262618","#D9770618","#1565C018","#05966918"][i],
                      fontSize:8, color:["#DC2626","#D97706","#1565C0","#059669"][i],
                      fontFamily:"'DM Mono',monospace" }}>{l}</div>
                  ))}
                </div>
                <div style={{ marginTop:12, padding:"10px 14px", background:"#FFFFFF",
                  borderRadius:10, border:`1px solid ${macColor(form.mac_pct)}30`,
                  fontSize:11, color:"#475569", fontFamily:"'Kanit',sans-serif", lineHeight:1.7 }}>
                  💡 กิจกรรม <strong>"{form.name||"นี้"}"</strong> ต้องรักษาความสามารถบริการอย่างน้อย
                  <strong style={{ color:macColor(form.mac_pct) }}> {form.mac_pct}%</strong> ของระดับปกติ
                  <br/>เมื่อ capacity {"<"} <strong style={{ color:T.red }}>{form.mac_pct}%</strong> →
                  <strong> Trigger Point เปิด</strong> → BC Plan เปิดใช้งาน → นับ RTO ทันที
                </div>
              </div>

              {/* RTO Selection */}
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:"#0D1B3E",
                    fontFamily:"'Kanit',sans-serif" }}>
                    ⏱ RTO — เป้ากู้คืนกลับสู่ MAC {form.mac_pct}% ภายในเวลาเท่าใด?
                  </label>
                  <button onClick={() => setForm(f => ({...f, rto_minutes:suggestRTO()}))}
                    style={{ padding:"3px 10px", borderRadius:6, border:"1px dashed #1565C050",
                      background:"rgba(21,101,192,0.06)", color:"#1565C0",
                      fontSize:9, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>
                    แนะนำ: {suggestRTO()<60?`${suggestRTO()}m`:`${Math.round(suggestRTO()/60)}h`} →
                  </button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:8 }}>
                  {[
                    { label:"< 1 ชั่วโมง", minutes:60,    color:"#DC2626" },
                    { label:"4 ชั่วโมง",   minutes:240,   color:"#EA580C" },
                    { label:"8 ชั่วโมง",   minutes:480,   color:"#D97706" },
                    { label:"1 วัน",        minutes:1440,  color:"#1D4ED8" },
                    { label:"3 วัน",        minutes:4320,  color:"#0284C7" },
                    { label:">1 สัปดาห์",  minutes:10080, color:"#059669" },
                  ].map(p => {
                    const sel = form.rto_minutes===p.minutes;
                    return (
                      <button key={p.minutes} onClick={()=>setForm(f=>({...f,rto_minutes:p.minutes}))}
                        style={{ padding:"10px 8px", borderRadius:10, border:"none", cursor:"pointer",
                          background:sel?p.color:"#F0F6FF",
                          color:sel?"#fff":"#64748B",
                          fontWeight:sel?800:600, fontSize:11, fontFamily:"'Kanit',sans-serif",
                          boxShadow:sel?`0 2px 10px ${p.color}40`:"none",
                          transition:"all 0.15s" }}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                {form.rto_minutes && (
                  <div style={{ marginTop:10, padding:"8px 14px", background:"#E8F0FE",
                    borderRadius:8, fontSize:11, color:"#1565C0", fontFamily:"'Kanit',sans-serif" }}>
                    🎯 เป้าหมาย: Trigger → กู้คืน capacity ≥ <strong>{form.mac_pct}%</strong> ภายใน
                    <strong> {form.rto_minutes<60?`${form.rto_minutes} นาที`:`${Math.round(form.rto_minutes/60)} ชั่วโมง`}</strong>
                  </div>
                )}
              </div>

              {/* RPO */}
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12, fontWeight:700, color:"#0D1B3E",
                  fontFamily:"'Kanit',sans-serif", display:"block", marginBottom:8 }}>
                  💾 RPO — ข้อมูลย้อนหลังสูงสุดกี่นาทีที่รับได้?
                </label>
                <input type="number" value={form.rpo_minutes??""}
                  placeholder="e.g. 60 (= สูญเสียข้อมูลสูงสุด 1 ชั่วโมง)"
                  onChange={e=>setForm(f=>({...f,rpo_minutes:e.target.value?Number(e.target.value):null}))}
                  style={{ width:"100%", padding:"10px 14px", background:"#E8F0FE",
                    border:"1px solid #C5D4F0", borderRadius:8, color:"#0D1B3E",
                    fontSize:12, fontFamily:"'DM Mono',monospace", boxSizing:"border-box" }}/>
              </div>

              {/* MAC Capacity Chart */}
              {form.mac_pct>=10 && form.rto_minutes && (
                <MACCapacityChart macPct={form.mac_pct} rtoMinutes={form.rto_minutes} />
              )}
            </div>
          )}

          {/* ════ STEP 4: Resources ════ */}
          {step===4 && (
            <div style={{ background:"#FFFFFF", borderRadius:14, padding:22,
              border:"1px solid #C5D4F0", animation:"fadeUp 0.2s ease" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0D1B3E",
                fontFamily:"'Kanit',sans-serif", marginBottom:6 }}>
                🔗 ส่วนที่ 4 — ทรัพยากรที่จำเป็นเพื่อรักษา MAC {form.mac_pct}%
              </div>
              <div style={{ fontSize:11, color:"#64748B", fontFamily:"'Kanit',sans-serif",
                marginBottom:18, lineHeight:1.6 }}>
                ระบุทรัพยากรที่ต้องพร้อมใช้เมื่อ BC Plan เปิดทำงาน — เพื่อรักษา capacity ≥ {form.mac_pct}%
              </div>
              {[
                { type:"people",   icon:"👤", label:"บุคลากรหลักที่จำเป็น",     ph:"e.g. QMR, IT Admin" },
                { type:"system",   icon:"💻", label:"ระบบ IT / Application",    ph:"e.g. ERP, Backup Server" },
                { type:"vendor",   icon:"🏢", label:"Vendor / Supplier หลัก",   ph:"e.g. AWS, Backup Supplier" },
                { type:"facility", icon:"🏭", label:"สถานที่ / อุปกรณ์",         ph:"e.g. DR Site, Generator" },
              ].map(rt => (
                <div key={rt.type} style={{ marginBottom:18 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#475569",
                    fontFamily:"'Kanit',sans-serif", marginBottom:8,
                    display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:16 }}>{rt.icon}</span>{rt.label}
                  </div>
                  {form.resources[rt.type].map((val,i) => (
                    <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                      <input value={val} placeholder={rt.ph}
                        onChange={e=>setResource(rt.type,i,e.target.value)}
                        style={{ flex:1, padding:"8px 12px", background:"#E8F0FE",
                          border:"1px solid #C5D4F0", borderRadius:8, color:"#0D1B3E",
                          fontSize:12, fontFamily:"'Kanit',sans-serif", boxSizing:"border-box" }}/>
                      {i===form.resources[rt.type].length-1 && (
                        <button onClick={()=>addResource(rt.type)}
                          style={{ padding:"8px 12px", borderRadius:8,
                            border:"1px solid #C5D4F0", background:"#E8F0FE",
                            color:"#64748B", fontSize:14, cursor:"pointer" }}>+</button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ════ STEP 5: Summary ════ */}
          {step===5 && (
            <div style={{ background:"#FFFFFF", borderRadius:14, padding:22,
              border:"1px solid #C5D4F0", animation:"fadeUp 0.2s ease" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0D1B3E",
                fontFamily:"'Kanit',sans-serif", marginBottom:16 }}>
                ✅ สรุป BIA — "{form.name}"
              </div>

              {/* KPI */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
                {[
                  { l:"Criticality", v:`${criticality}/5`,   c:criticality>=5?"#DC2626":criticality>=4?"#D97706":"#1D4ED8" },
                  { l:"MAC%",        v:`${form.mac_pct}%`,   c:macColor(form.mac_pct) },
                  { l:"RTO",         v:form.rto_minutes?(form.rto_minutes<60?`${form.rto_minutes}m`:`${Math.round(form.rto_minutes/60)}h`):"—", c:"#D97706" },
                  { l:"RPO",         v:form.rpo_minutes?(form.rpo_minutes<60?`${form.rpo_minutes}m`:`${Math.round(form.rpo_minutes/60)}h`):"—", c:"#0284C7" },
                ].map(s => (
                  <div key={s.l} style={{ textAlign:"center", background:"#F0F6FF",
                    borderRadius:10, padding:"12px 8px",
                    border:`1px solid ${s.c}25`, borderTop:`3px solid ${s.c}` }}>
                    <div style={{ fontSize:18, fontWeight:800, color:s.c,
                      fontFamily:"'DM Mono',monospace", lineHeight:1 }}>{s.v}</div>
                    <div style={{ fontSize:9, color:"#64748B",
                      fontFamily:"'Kanit',sans-serif", marginTop:4 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Trigger Point logic */}
              <div style={{ background:"rgba(13,27,62,0.05)", borderRadius:12,
                padding:"16px 18px", marginBottom:16,
                border:`1px solid ${macColor(form.mac_pct)}40` }}>
                <div style={{ fontSize:12, fontWeight:800, color:"#0D1B3E",
                  fontFamily:"'Kanit',sans-serif", marginBottom:10 }}>
                  ⚡ Trigger Point — BC Plan Activation Logic
                </div>
                {[
                  { pre:"IF",   text:`Capacity ของ "${form.name}" < ${form.mac_pct}%`,                           color:macColor(form.mac_pct) },
                  { pre:"→",    text:"BC Plan เปิดใช้งานทันที + แจ้ง Team",                                       color:T.red   },
                  { pre:"⏱",   text:`RTO Clock เริ่มนับ — เป้ากู้คืน ≥ ${form.mac_pct}% ภายใน ${form.rto_minutes?(form.rto_minutes<60?`${form.rto_minutes}m`:`${Math.round(form.rto_minutes/60)}h`):"—"}`, color:T.amber },
                  { pre:"✅",   text:`Recovery เมื่อ Capacity ≥ ${form.mac_pct}% อีกครั้ง`,                      color:T.green },
                ].map((row,i) => (
                  <div key={i} style={{ display:"flex", gap:10, marginBottom:7,
                    fontSize:11, fontFamily:"'Kanit',sans-serif", color:"#475569" }}>
                    <span style={{ color:row.color, fontWeight:800, minWidth:22 }}>{row.pre}</span>
                    <span>{row.text}</span>
                  </div>
                ))}
              </div>

              {/* Dependencies */}
              {Object.entries(form.resources).some(([,arr])=>arr.some(v=>v)) && (
                <div style={{ background:"#F0F6FF", borderRadius:10, padding:14,
                  marginBottom:16, border:"1px solid #C5D4F0" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#475569",
                    fontFamily:"'Kanit',sans-serif", marginBottom:8 }}>
                    🔗 ทรัพยากรที่ต้องพร้อมใช้ทันทีที่ Trigger เปิด
                  </div>
                  {[{type:"people",icon:"👤"},{type:"system",icon:"💻"},{type:"vendor",icon:"🏢"},{type:"facility",icon:"🏭"}].map(rt => {
                    const vals = form.resources[rt.type].filter(v=>v);
                    if (!vals.length) return null;
                    return (
                      <div key={rt.type} style={{ marginBottom:4, fontSize:11,
                        color:"#475569", fontFamily:"'Kanit',sans-serif" }}>
                        {rt.icon} {vals.join(" · ")}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MAC Chart final */}
              {form.mac_pct>=10 && form.rto_minutes && (
                <div style={{ marginBottom:16 }}>
                  <MACCapacityChart macPct={form.mac_pct} rtoMinutes={form.rto_minutes} />
                </div>
              )}

              {saved ? (
                <div style={{ textAlign:"center", padding:16, color:"#059669", fontSize:14,
                  fontFamily:"'Kanit',sans-serif", fontWeight:700 }}>
                  ✅ บันทึก BIA + MAC Trigger Point สำเร็จ! — ดู Trigger Dashboard ใน BC Plan
                </div>
              ) : (
                <button onClick={handleFinish} disabled={saving}
                  style={{ width:"100%", padding:"14px", borderRadius:10, border:"none",
                    background:saving?"#94A3B8":"#1565C0",
                    color:"#fff", fontSize:13, fontFamily:"'Kanit',sans-serif", fontWeight:700,
                    cursor:saving?"not-allowed":"pointer",
                    boxShadow:"0 4px 14px rgba(21,101,192,0.3)" }}>
                  {saving?"⏳ กำลังบันทึก...":"💾 บันทึก BIA + MAC Trigger → BC Plan"}
                </button>
              )}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:14 }}>
            <button onClick={()=>setStep(s=>Math.max(1,s-1))} disabled={step===1}
              style={{ padding:"8px 18px", borderRadius:8, border:"1px solid #C5D4F0",
                background:step===1?"#F0F6FF":"#FFFFFF", color:step===1?"#94A3B8":"#475569",
                fontSize:12, fontFamily:"'Kanit',sans-serif", cursor:step===1?"not-allowed":"pointer" }}>
              ← ย้อนกลับ
            </button>
            {step<5 && (
              <button onClick={()=>{setStep(s=>s+1);setShowTemplates(false);}}
                disabled={!canNext()}
                style={{ padding:"8px 22px", borderRadius:8, border:"none",
                  background:canNext()?"#1565C0":"#94A3B8", color:"#fff",
                  fontSize:12, fontFamily:"'Kanit',sans-serif", fontWeight:700,
                  cursor:canNext()?"pointer":"not-allowed",
                  boxShadow:canNext()?"0 2px 8px rgba(21,101,192,0.3)":"none" }}>
                ดำเนินการต่อ →
              </button>
            )}
          </div>
          </div>

          {/* Sidebar */}
          <div style={{ width:220, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"#FFFFFF", borderRadius:12, padding:"14px 16px",
              border:"1px solid #C5D4F0" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#64748B",
                fontFamily:"'DM Mono',monospace", letterSpacing:1, marginBottom:10 }}>
                LIVE PREVIEW
              </div>
              {[
                { l:"MAC%", v:form.mac_pct?`${form.mac_pct}%`:"—",   c:macColor(form.mac_pct), d:"Min. Acceptable Capacity" },
                { l:"RTO",  v:form.rto_minutes?(form.rto_minutes<60?`${form.rto_minutes}m`:`${Math.round(form.rto_minutes/60)}h`):"—", c:"#D97706", d:"Recovery Time Objective" },
                { l:"RPO",  v:form.rpo_minutes?(form.rpo_minutes<60?`${form.rpo_minutes}m`:`${Math.round(form.rpo_minutes/60)}h`):"—", c:"#0284C7", d:"Recovery Point Objective" },
                { l:"Crit", v:criticality>0?`${criticality}/5`:"—",   c:criticality>=4?T.red:criticality>=3?T.amber:"#1D4ED8", d:"Impact Criticality" },
              ].map(item => (
                <div key={item.l} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                    <span style={{ fontSize:9, color:"#64748B", fontFamily:"'DM Mono',monospace" }}>{item.l}</span>
                    <span style={{ fontSize:16, fontWeight:800, fontFamily:"'DM Mono',monospace",
                      color:item.v==="—"?"#CBD5E1":item.c }}>{item.v}</span>
                  </div>
                  <div style={{ height:3, borderRadius:2, background:"#E8F0FE", marginTop:2 }}>
                    {item.v!=="—" && <div style={{ height:"100%", width:"65%",
                      background:item.c, borderRadius:2 }}/>}
                  </div>
                  <div style={{ fontSize:8, color:"#94A3B8", marginTop:1 }}>{item.d}</div>
                </div>
              ))}
              {form.mac_pct>=10 && (
                <div style={{ marginTop:8, padding:"8px 10px",
                  background:macColor(form.mac_pct)+"12",
                  border:`1px solid ${macColor(form.mac_pct)}30`,
                  borderRadius:8, textAlign:"center" }}>
                  <div style={{ fontSize:9, fontWeight:700, color:macColor(form.mac_pct) }}>Trigger Point</div>
                  <div style={{ fontSize:11, fontWeight:800, color:macColor(form.mac_pct),
                    fontFamily:"'DM Mono',monospace" }}>
                    capacity {"<"} {form.mac_pct}%
                  </div>
                  <div style={{ fontSize:8, color:"#64748B" }}>{macLabel(form.mac_pct)} tier</div>
                </div>
              )}
            </div>

            <div style={{ background:"#E8F0FE", borderRadius:12, padding:"10px 14px" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#1565C0",
                fontFamily:"'DM Mono',monospace", marginBottom:8 }}>ISO 22301</div>
              {[
                { c:"§8.3", d:"MAC = Minimum Acceptable Capacity ต่อกิจกรรมสำคัญ" },
                { c:"§8.4", d:"BC Plan ต้องระบุ Trigger Conditions ชัดเจน" },
                { c:"MBCO", d:"Minimum Business Continuity Objective เชื่อมกับ MAC%" },
                { c:"§8.3.3",d:"RTO นับจาก Trigger Point จนกู้คืนถึง MAC%" },
              ].map(r => (
                <div key={r.c} style={{ marginBottom:6 }}>
                  <span style={{ fontSize:9, fontWeight:800, color:"#1565C0",
                    fontFamily:"'DM Mono',monospace" }}>{r.c} </span>
                  <span style={{ fontSize:9, color:"#64748B", fontFamily:"'Kanit',sans-serif", lineHeight:1.5 }}>
                    {r.d}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
