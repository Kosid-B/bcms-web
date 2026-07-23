import React, { useEffect, useMemo, useState } from "react";

import { supaLite } from "../../lib/supa-lite.js";

const box = {
  background: "#fff",
  border: "1px solid #dbe5f5",
  borderRadius: 14,
  padding: 16,
};

function Progress({ label, value, color = "#1565c0" }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#425777", marginBottom: 4 }}>
        <span>{label}</span>
        <strong>{safe.toFixed(0)}%</strong>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "#edf3ff", overflow: "hidden" }}>
        <div style={{ width: `${safe}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

export default function PersonnelContinuityPage({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [readiness, setReadiness] = useState(null);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [people, setPeople] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [unitForm, setUnitForm] = useState({ unit_code: "", unit_name: "", criticality: 3, minimum_capacity_pct: 60, target_rto_minutes: "" });
  const [roleForm, setRoleForm] = useState({ role_name: "", unit_id: "", criticality: 3, min_headcount: 1, target_headcount: 1, max_absence_pct: 30 });
  const [personForm, setPersonForm] = useState({ full_name: "", unit_id: "", employment_type: "employee", status: "active", email: "", phone: "" });
  const [assignmentForm, setAssignmentForm] = useState({ person_id: "", role_id: "", is_primary: true, backup_priority: "" });

  const isOrgLevel = (user?.accessLevel ?? "org") === "org" || (user?.role ?? "") === "owner" || (user?.role ?? "") === "admin";
  const userDept = (user?.department ?? "").trim();

  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const visibleUnits = useMemo(() => {
    if (isOrgLevel) return units;
    if (!userDept) return [];
    return units.filter((u) => (u.unit_name ?? "").toLowerCase() === userDept.toLowerCase() || (u.unit_code ?? "").toLowerCase() === userDept.toLowerCase());
  }, [isOrgLevel, units, userDept]);

  const visibleUnitIds = useMemo(() => new Set(visibleUnits.map((u) => u.id)), [visibleUnits]);
  const visibleRoles = useMemo(() => roles.filter((r) => isOrgLevel || visibleUnitIds.has(r.unit_id)), [roles, isOrgLevel, visibleUnitIds]);
  const visiblePeople = useMemo(() => people.filter((p) => isOrgLevel || visibleUnitIds.has(p.unit_id)), [people, isOrgLevel, visibleUnitIds]);
  const visibleRoleIds = useMemo(() => new Set(visibleRoles.map((r) => r.id)), [visibleRoles]);
  const visiblePersonIds = useMemo(() => new Set(visiblePeople.map((p) => p.id)), [visiblePeople]);
  const visibleAssignments = useMemo(
    () => assignments.filter((a) => isOrgLevel || (visibleRoleIds.has(a.role_id) && visiblePersonIds.has(a.person_id))),
    [assignments, isOrgLevel, visibleRoleIds, visiblePersonIds]
  );

  const loadAll = async () => {
    if (!user?.orgId) return;
    setLoading(true);
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        supaLite.rpc("evaluate_personnel_readiness", { p_org_id: user.orgId, p_unit_id: null }),
        supaLite.from("org_units").select("id,unit_code,unit_name,criticality,minimum_capacity_pct,target_rto_minutes,created_at").eq("org_id", user.orgId).order("created_at", { ascending: false }),
        supaLite.from("personnel_roles").select("id,role_name,unit_id,criticality,min_headcount,target_headcount,max_absence_pct,created_at").eq("org_id", user.orgId).order("created_at", { ascending: false }),
        supaLite.from("personnel_profiles").select("id,full_name,unit_id,employment_type,status,email,phone,created_at").eq("org_id", user.orgId).order("created_at", { ascending: false }),
        supaLite.from("personnel_assignments").select("id,person_id,role_id,is_primary,backup_priority,effective_from,effective_to,created_at").eq("org_id", user.orgId).order("created_at", { ascending: false }),
      ]);
      setReadiness(r1?.data ?? null);
      setUnits(r2?.data ?? []);
      setRoles(r3?.data ?? []);
      setPeople(r4?.data ?? []);
      setAssignments(r5?.data ?? []);
    } catch (_) {
      setReadiness(null);
      setUnits([]); setRoles([]); setPeople([]); setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user?.orgId]);

  const submitInsert = async (table, payload) => {
    setSaving(true);
    const { error } = await supaLite.from(table).insert(payload);
    setSaving(false);
    if (error) {
      alert(`${table} error: ${error.message}`);
      return false;
    }
    await loadAll();
    return true;
  };

  const createUnit = async () => {
    if (!isOrgLevel) {
      alert("สิทธิ์ระดับหน่วยงานไม่สามารถเพิ่มหน่วยงานใหม่ได้");
      return;
    }
    if (!unitForm.unit_code.trim() || !unitForm.unit_name.trim()) return;
    const ok = await submitInsert("org_units", {
      org_id: user.orgId,
      unit_code: unitForm.unit_code.trim().toUpperCase(),
      unit_name: unitForm.unit_name.trim(),
      criticality: Number(unitForm.criticality) || 3,
      minimum_capacity_pct: Number(unitForm.minimum_capacity_pct) || 60,
      target_rto_minutes: unitForm.target_rto_minutes === "" ? null : Number(unitForm.target_rto_minutes),
    });
    if (ok) setUnitForm({ unit_code: "", unit_name: "", criticality: 3, minimum_capacity_pct: 60, target_rto_minutes: "" });
  };

  const createRole = async () => {
    if (!roleForm.role_name.trim() || !roleForm.unit_id) return;
    if (!isOrgLevel && !visibleUnitIds.has(roleForm.unit_id)) {
      alert("คุณสร้างบทบาทได้เฉพาะหน่วยงานของคุณ");
      return;
    }
    const ok = await submitInsert("personnel_roles", {
      org_id: user.orgId,
      role_name: roleForm.role_name.trim(),
      unit_id: roleForm.unit_id,
      criticality: Number(roleForm.criticality) || 3,
      min_headcount: Number(roleForm.min_headcount) || 1,
      target_headcount: Number(roleForm.target_headcount) || 1,
      max_absence_pct: Number(roleForm.max_absence_pct) || 30,
    });
    if (ok) setRoleForm({ role_name: "", unit_id: "", criticality: 3, min_headcount: 1, target_headcount: 1, max_absence_pct: 30 });
  };

  const createPerson = async () => {
    if (!personForm.full_name.trim() || !personForm.unit_id) return;
    if (!isOrgLevel && !visibleUnitIds.has(personForm.unit_id)) {
      alert("คุณเพิ่มบุคลากรได้เฉพาะหน่วยงานของคุณ");
      return;
    }
    const ok = await submitInsert("personnel_profiles", {
      org_id: user.orgId,
      full_name: personForm.full_name.trim(),
      unit_id: personForm.unit_id,
      employment_type: personForm.employment_type,
      status: personForm.status,
      email: personForm.email.trim() || null,
      phone: personForm.phone.trim() || null,
    });
    if (ok) setPersonForm({ full_name: "", unit_id: "", employment_type: "employee", status: "active", email: "", phone: "" });
  };

  const createAssignment = async () => {
    if (!assignmentForm.person_id || !assignmentForm.role_id) return;
    if (!isOrgLevel) {
      if (!visiblePersonIds.has(assignmentForm.person_id) || !visibleRoleIds.has(assignmentForm.role_id)) {
        alert("คุณมอบหมายบทบาทได้เฉพาะข้อมูลในหน่วยงานของคุณ");
        return;
      }
    }
    const ok = await submitInsert("personnel_assignments", {
      org_id: user.orgId,
      person_id: assignmentForm.person_id,
      role_id: assignmentForm.role_id,
      is_primary: !!assignmentForm.is_primary,
      backup_priority: assignmentForm.backup_priority === "" ? null : Number(assignmentForm.backup_priority),
    });
    if (ok) setAssignmentForm({ person_id: "", role_id: "", is_primary: true, backup_priority: "" });
  };

  const breakdown = readiness?.breakdown ?? {};

  return (
    <div style={{ minHeight: "100vh", background: "#f5f8ff", padding: 20 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, color: "#10294d" }}>Personnel Continuity</h2>
            <div style={{ fontSize: 13, color: "#4b5b78", marginTop: 4 }}>ISO 22330/22331: people continuity planning and readiness monitoring</div>
          </div>
          <button type="button" onClick={onBack} style={{ border: "1px solid #c7d7f2", background: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>กลับ Dashboard</button>
        </div>

        {loading ? (
          <div style={box}>กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            <div style={{ ...box, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8, marginBottom: 14 }}>
                <div style={{ background: "#f0f6ff", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#5a7094" }}>Organization</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#16335c" }}>{user?.org ?? "—"}</div>
                </div>
                <div style={{ background: "#f0f6ff", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#5a7094" }}>Role</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#16335c" }}>{(user?.role ?? "member").toUpperCase()}</div>
                </div>
                <div style={{ background: "#f0f6ff", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#5a7094" }}>Access Level</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#16335c" }}>{(user?.accessLevel ?? "org").toUpperCase()}</div>
                </div>
                <div style={{ background: "#f0f6ff", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#5a7094" }}>Department Scope</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#16335c" }}>{isOrgLevel ? "ALL" : (userDept || "UNSET")}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#425777" }}>Readiness Score</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: "#1565c0" }}>{Number(readiness?.readiness_score ?? 0).toFixed(0)}</div>
                  <div style={{ fontSize: 12, color: "#425777" }}>Maturity: {(readiness?.maturity_level ?? "initial").toUpperCase()}</div>
                </div>
                <div>
                  <Progress label="Role Coverage" value={breakdown.role_coverage_score} color="#1565c0" />
                  <Progress label="Training Completion" value={breakdown.training_score} color="#0b875b" />
                  <Progress label="Competency" value={breakdown.competency_score} color="#d97a00" />
                  <Progress label="Improvement Actions" value={breakdown.action_score} color="#8a4ddb" />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={box}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>เพิ่มหน่วยงาน</h3>
                <input value={unitForm.unit_code} onChange={(e) => setUnitForm((s) => ({ ...s, unit_code: e.target.value }))} placeholder="Unit Code" style={{ width: "100%", marginBottom: 8, padding: 8 }} />
                <input value={unitForm.unit_name} onChange={(e) => setUnitForm((s) => ({ ...s, unit_name: e.target.value }))} placeholder="Unit Name" style={{ width: "100%", marginBottom: 8, padding: 8 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  <input type="number" min="1" max="5" value={unitForm.criticality} onChange={(e) => setUnitForm((s) => ({ ...s, criticality: e.target.value }))} placeholder="Criticality" style={{ padding: 8 }} />
                  <input type="number" min="0" max="100" value={unitForm.minimum_capacity_pct} onChange={(e) => setUnitForm((s) => ({ ...s, minimum_capacity_pct: e.target.value }))} placeholder="Min Capacity %" style={{ padding: 8 }} />
                  <input type="number" value={unitForm.target_rto_minutes} onChange={(e) => setUnitForm((s) => ({ ...s, target_rto_minutes: e.target.value }))} placeholder="RTO min" style={{ padding: 8 }} />
                </div>
                <button type="button" onClick={createUnit} disabled={saving || !isOrgLevel} style={{ marginTop: 10, padding: "8px 12px" }}>บันทึกหน่วยงาน</button>
                {!isOrgLevel && <div style={{ fontSize: 11, color: "#7b4f00", marginTop: 6 }}>สิทธิ์ระดับหน่วยงานเพิ่ม Unit ใหม่ไม่ได้</div>}
              </div>

              <div style={box}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>เพิ่มบทบาทสำคัญ</h3>
                <input value={roleForm.role_name} onChange={(e) => setRoleForm((s) => ({ ...s, role_name: e.target.value }))} placeholder="Role Name" style={{ width: "100%", marginBottom: 8, padding: 8 }} />
                <select value={roleForm.unit_id} onChange={(e) => setRoleForm((s) => ({ ...s, unit_id: e.target.value }))} style={{ width: "100%", marginBottom: 8, padding: 8 }}>
                  <option value="">เลือกหน่วยงาน</option>
                  {visibleUnits.map((u) => <option key={u.id} value={u.id}>{u.unit_code} - {u.unit_name}</option>)}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  <input type="number" min="1" max="5" value={roleForm.criticality} onChange={(e) => setRoleForm((s) => ({ ...s, criticality: e.target.value }))} placeholder="Crit" style={{ padding: 8 }} />
                  <input type="number" min="1" value={roleForm.min_headcount} onChange={(e) => setRoleForm((s) => ({ ...s, min_headcount: e.target.value }))} placeholder="Min HC" style={{ padding: 8 }} />
                  <input type="number" min="1" value={roleForm.target_headcount} onChange={(e) => setRoleForm((s) => ({ ...s, target_headcount: e.target.value }))} placeholder="Target HC" style={{ padding: 8 }} />
                  <input type="number" min="0" max="100" value={roleForm.max_absence_pct} onChange={(e) => setRoleForm((s) => ({ ...s, max_absence_pct: e.target.value }))} placeholder="Absence %" style={{ padding: 8 }} />
                </div>
                <button type="button" onClick={createRole} disabled={saving || visibleUnits.length === 0} style={{ marginTop: 10, padding: "8px 12px" }}>บันทึกบทบาท</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={box}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>เพิ่มบุคลากร</h3>
                <input value={personForm.full_name} onChange={(e) => setPersonForm((s) => ({ ...s, full_name: e.target.value }))} placeholder="ชื่อ-นามสกุล" style={{ width: "100%", marginBottom: 8, padding: 8 }} />
                <select value={personForm.unit_id} onChange={(e) => setPersonForm((s) => ({ ...s, unit_id: e.target.value }))} style={{ width: "100%", marginBottom: 8, padding: 8 }}>
                  <option value="">เลือกหน่วยงาน</option>
                  {visibleUnits.map((u) => <option key={u.id} value={u.id}>{u.unit_code} - {u.unit_name}</option>)}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <select value={personForm.employment_type} onChange={(e) => setPersonForm((s) => ({ ...s, employment_type: e.target.value }))} style={{ padding: 8 }}>
                    <option value="employee">employee</option>
                    <option value="contractor">contractor</option>
                    <option value="outsource">outsource</option>
                  </select>
                  <select value={personForm.status} onChange={(e) => setPersonForm((s) => ({ ...s, status: e.target.value }))} style={{ padding: 8 }}>
                    <option value="active">active</option>
                    <option value="leave">leave</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <input value={personForm.email} onChange={(e) => setPersonForm((s) => ({ ...s, email: e.target.value }))} placeholder="email (optional)" style={{ padding: 8 }} />
                  <input value={personForm.phone} onChange={(e) => setPersonForm((s) => ({ ...s, phone: e.target.value }))} placeholder="phone (optional)" style={{ padding: 8 }} />
                </div>
                <button type="button" onClick={createPerson} disabled={saving || visibleUnits.length === 0} style={{ marginTop: 10, padding: "8px 12px" }}>บันทึกบุคลากร</button>
              </div>

              <div style={box}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>มอบหมายบทบาท</h3>
                <select value={assignmentForm.person_id} onChange={(e) => setAssignmentForm((s) => ({ ...s, person_id: e.target.value }))} style={{ width: "100%", marginBottom: 8, padding: 8 }}>
                  <option value="">เลือกบุคลากร</option>
                  {visiblePeople.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <select value={assignmentForm.role_id} onChange={(e) => setAssignmentForm((s) => ({ ...s, role_id: e.target.value }))} style={{ width: "100%", marginBottom: 8, padding: 8 }}>
                  <option value="">เลือกบทบาท</option>
                  {visibleRoles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ fontSize: 12, color: "#425777", display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={assignmentForm.is_primary} onChange={(e) => setAssignmentForm((s) => ({ ...s, is_primary: e.target.checked }))} />
                    Primary Role
                  </label>
                  <input type="number" placeholder="Backup Priority"
                    value={assignmentForm.backup_priority}
                    onChange={(e) => setAssignmentForm((s) => ({ ...s, backup_priority: e.target.value }))}
                    style={{ padding: 8 }} />
                </div>
                <button type="button" onClick={createAssignment} disabled={saving || visibleRoles.length === 0 || visiblePeople.length === 0} style={{ marginTop: 10, padding: "8px 12px" }}>บันทึกการมอบหมาย</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={box}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>รายการบุคลากร</h3>
                {visiblePeople.length === 0 ? <div style={{ color: "#4b5b78", fontSize: 13 }}>ยังไม่มีข้อมูล</div> : (
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {visiblePeople.map((p) => {
                      const unit = unitMap.get(p.unit_id);
                      return <li key={p.id} style={{ marginBottom: 6 }}><strong>{p.full_name}</strong> · {unit?.unit_name || "—"} · {p.status}</li>;
                    })}
                  </ul>
                )}
              </div>
              <div style={box}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>รายการมอบหมาย</h3>
                {visibleAssignments.length === 0 ? <div style={{ color: "#4b5b78", fontSize: 13 }}>ยังไม่มีข้อมูล</div> : (
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {visibleAssignments.map((a) => {
                      const p = personMap.get(a.person_id);
                      const r = roleMap.get(a.role_id);
                      return <li key={a.id} style={{ marginBottom: 6 }}><strong>{p?.full_name || "Unknown"}</strong> → {r?.role_name || "Unknown"} {a.is_primary ? "(Primary)" : ""}</li>;
                    })}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
