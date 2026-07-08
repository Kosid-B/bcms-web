import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  List,
  LoaderCircle,
  Map,
  MapPin,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

import InstallationMap from "./components/InstallationMap.jsx";
import { useInstallationPlanningData } from "./hooks/useInstallationPlanningData.js";
import {
  createInstallationPlan,
  createInstallationPoint,
  createProjectTeam,
  updateInstallationPoint,
} from "./lib/installation-planning-api.js";
import {
  PLAN_STATUS_LABELS,
  POINT_STATUS_LABELS,
  TEAM_TYPE_LABELS,
  canManageInstallationPlans,
  computeInstallationMetrics,
  filterInstallationPlans,
  normalizeInstallationPayload,
} from "./lib/installation-planning.js";
import "./installation-planning.css";

const EMPTY_FILTERS = {
  query: "",
  projectId: "",
  province: "",
  teamId: "",
  planStatus: "",
  pointStatus: "",
};

export default function InstallationPlanningPage({ user }) {
  const { status, source, data, error, reload } = useInstallationPlanningData(user);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [viewMode, setViewMode] = useState("map");
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const canManage = canManageInstallationPlans(user);

  const filteredPlans = useMemo(
    () => filterInstallationPlans(data, filters),
    [data, filters],
  );
  const metrics = useMemo(() => computeInstallationMetrics(data), [data]);
  const selectedPlan =
    filteredPlans.find((plan) => plan.id === selectedPlanId) ?? filteredPlans[0] ?? null;
  const visiblePoints = selectedPlan ? selectedPlan.points : filteredPlans.flatMap((plan) => plan.points);
  const selectedPoint =
    visiblePoints.find((point) => point.id === selectedPointId) ?? visiblePoints[0] ?? null;
  const provinces = [...new Set(data.plans.map((plan) => plan.province).filter(Boolean))].sort();

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedPlanId(null);
    setSelectedPointId(null);
  }

  async function handleSubmit(kind, payload) {
    if (source !== "live") {
      setNotice({ type: "warning", message: "โหมดข้อมูลตัวอย่างยังไม่บันทึกลงฐานข้อมูล กรุณา deploy migration ก่อน" });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const action =
        kind === "team"
          ? createProjectTeam
          : kind === "plan"
            ? createInstallationPlan
            : createInstallationPoint;
      const { error: saveError } = await action({
        ...payload,
        org_id: user.orgId,
        created_by: user.id,
      });

      if (saveError) throw saveError;

      await reload();
      setModal(null);
      setNotice({ type: "success", message: "บันทึกข้อมูลเรียบร้อยแล้ว" });
    } catch (saveError) {
      setNotice({
        type: "error",
        message: saveError?.message ?? "บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(pointId, nextStatus) {
    if (!canManage || source !== "live") return;
    const { error: updateError } = await updateInstallationPoint(pointId, { status: nextStatus });
    if (updateError) {
      setNotice({ type: "error", message: updateError.message ?? "อัปเดตสถานะไม่สำเร็จ" });
      return;
    }
    await reload();
  }

  return (
    <section className="installation-page" aria-label="แผนการติดตั้ง">
      <header className="installation-header">
        <div>
          <p className="installation-eyebrow">ศูนย์ควบคุมงานภาคสนาม</p>
          <h1>แผนการติดตั้ง</h1>
          <p className="installation-subtitle">
            กำหนดทีม วันเข้าพื้นที่ เป้าหมายงาน และพิกัดจุดติดตั้งทั่วประเทศไทย
          </p>
        </div>

        <div className="installation-header__actions">
          <span className={`source-badge source-badge--${source}`}>
            {source === "live" ? "ข้อมูลจริง" : "ข้อมูลตัวอย่าง"}
          </span>
          {canManage ? (
            <>
              <button className="ip-button ip-button--secondary" type="button" onClick={() => setModal("team")}>
                <Users size={16} /> เพิ่มทีม
              </button>
              <button className="ip-button ip-button--secondary" type="button" onClick={() => setModal("plan")}>
                <ClipboardList size={16} /> สร้างแผน
              </button>
              <button className="ip-button ip-button--primary" type="button" onClick={() => setModal("point")}>
                <Plus size={16} /> เพิ่มจุดติดตั้ง
              </button>
            </>
          ) : null}
        </div>
      </header>

      {notice ? (
        <div className={`ip-notice ip-notice--${notice.type}`} role="status">
          {notice.type === "success" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <span>{notice.message}</span>
          <button type="button" aria-label="ปิดข้อความ" onClick={() => setNotice(null)}><X size={16} /></button>
        </div>
      ) : null}

      {error && source === "demo" ? (
        <div className="ip-notice ip-notice--warning">
          <AlertTriangle size={17} />
          <span>ยังเชื่อมตารางแผนการติดตั้งไม่ได้ ระบบจึงแสดงข้อมูลตัวอย่างสำหรับตรวจหน้าจอ</span>
        </div>
      ) : null}

      <div className="installation-metrics" aria-label="ตัวชี้วัดแผนการติดตั้ง">
        <Metric icon={<ClipboardList size={18} />} label="แผนที่กำลังเดิน" value={metrics.activePlans} tone="cyan" />
        <Metric icon={<MapPin size={18} />} label="จุดติดตั้งทั้งหมด" value={metrics.totalPoints} tone="blue" />
        <Metric icon={<Users size={18} />} label="มอบหมายทีมแล้ว" value={metrics.assignedPoints} tone="green" />
        <Metric icon={<AlertTriangle size={18} />} label="จุดติดปัญหา" value={metrics.blockedPoints} tone="red" />
        <Metric icon={<CalendarDays size={18} />} label="เข้าพื้นที่วันนี้" value={metrics.scheduledToday} tone="amber" />
      </div>

      <div className="installation-toolbar">
        <label className="ip-search">
          <Search size={16} />
          <input
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="ค้นหารหัสจุด พื้นที่ หรือชื่อทีม"
          />
        </label>
        <FilterSelect label="โครงการ" value={filters.projectId} onChange={(value) => updateFilter("projectId", value)}>
          {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </FilterSelect>
        <FilterSelect label="จังหวัด" value={filters.province} onChange={(value) => updateFilter("province", value)}>
          {provinces.map((province) => <option key={province} value={province}>{province}</option>)}
        </FilterSelect>
        <FilterSelect label="ทีม" value={filters.teamId} onChange={(value) => updateFilter("teamId", value)}>
          {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </FilterSelect>
        <div className="view-switch" aria-label="รูปแบบการแสดงผล">
          <button type="button" className={viewMode === "map" ? "is-active" : ""} onClick={() => setViewMode("map")} title="มุมมองแผนที่"><Map size={16} /></button>
          <button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")} title="มุมมองรายการ"><List size={16} /></button>
        </div>
        {Object.values(filters).some(Boolean) ? (
          <button className="ip-clear" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>ล้างตัวกรอง</button>
        ) : null}
      </div>

      {status === "loading" ? (
        <div className="installation-loading"><LoaderCircle size={26} /> กำลังโหลดแผนการติดตั้ง</div>
      ) : filteredPlans.length === 0 ? (
        <div className="installation-empty">
          <MapPin size={30} />
          <h2>ไม่พบแผนการติดตั้ง</h2>
          <p>ปรับตัวกรอง หรือสร้างแผนใหม่เพื่อเริ่มกำหนดจุดและทีมงาน</p>
        </div>
      ) : (
        <>
          <div className={`installation-workspace installation-workspace--${viewMode}`}>
            <aside className="plan-list" aria-label="รายการแผน">
              <div className="panel-heading">
                <div><strong>รายการแผน</strong><span>{filteredPlans.length} แผน</span></div>
              </div>
              <div className="plan-list__scroll">
                {filteredPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={`plan-row ${selectedPlan?.id === plan.id ? "is-selected" : ""}`}
                    onClick={() => { setSelectedPlanId(plan.id); setSelectedPointId(null); }}
                  >
                    <div className="plan-row__top">
                      <span className={`status-dot status-dot--${plan.status}`} />
                      <strong>{plan.name}</strong>
                      <ChevronRight size={16} />
                    </div>
                    <div className="plan-row__meta">
                      <span>{plan.province}</span><span>{plan.points.length} จุด</span>
                    </div>
                    <div className="plan-row__date">
                      {formatDate(plan.start_date)} – {formatDate(plan.end_date)}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <div className="map-panel">
              <div className="panel-heading">
                <div>
                  <strong>{selectedPlan?.name ?? "แผนที่ประเทศไทย"}</strong>
                  <span>{selectedPlan?.area_name ?? "จุดติดตั้งที่มองเห็นทั้งหมด"}</span>
                </div>
                <span className="map-count"><MapPin size={14} /> {visiblePoints.length} จุด</span>
              </div>
              {viewMode === "map" ? (
                <InstallationMap
                  points={visiblePoints}
                  selectedPointId={selectedPoint?.id}
                  onSelectPoint={setSelectedPointId}
                />
              ) : (
                <PointList points={visiblePoints} selectedPointId={selectedPoint?.id} onSelect={setSelectedPointId} />
              )}
            </div>
          </div>

          <div className="point-section">
            <div className="panel-heading panel-heading--table">
              <div><strong>จุดติดตั้งในแผน</strong><span>ติดตามวันเข้าพื้นที่ ทีม เป้าหมาย และสถานะ</span></div>
              {selectedPoint ? <span className="selected-location"><MapPin size={14} /> {selectedPoint.name}</span> : null}
            </div>
            <PointTable
              points={visiblePoints}
              canManage={canManage}
              onStatusChange={handleStatusChange}
              onSelect={setSelectedPointId}
            />
          </div>
        </>
      )}

      {modal ? (
        <InstallationModal
          kind={modal}
          data={data}
          saving={saving}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  );
}

function Metric({ icon, label, value, tone }) {
  return (
    <div className={`installation-metric installation-metric--${tone}`}>
      <span>{icon}</span><div><strong>{Number(value).toLocaleString("th-TH")}</strong><small>{label}</small></div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="ip-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">ทั้งหมด</option>{children}
      </select>
    </label>
  );
}

function PointList({ points, selectedPointId, onSelect }) {
  return (
    <div className="point-list-view">
      {points.map((point) => (
        <button key={point.id} type="button" className={point.id === selectedPointId ? "is-selected" : ""} onClick={() => onSelect(point.id)}>
          <span className={`status-dot status-dot--${point.status}`} />
          <div><strong>{point.point_code || "ไม่มีรหัส"} · {point.name}</strong><small>{point.location_text}</small></div>
          <span>{point.team_name}</span>
        </button>
      ))}
    </div>
  );
}

function PointTable({ points, canManage, onStatusChange, onSelect }) {
  if (!points.length) return <div className="point-table-empty">แผนนี้ยังไม่มีจุดติดตั้ง</div>;
  return (
    <div className="point-table-wrap">
      <table className="point-table">
        <thead><tr><th>จุดติดตั้ง</th><th>พื้นที่</th><th>ทีม</th><th>วันที่เข้าพื้นที่</th><th>เป้าหมาย</th><th>สถานะ</th></tr></thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.id} onClick={() => onSelect(point.id)}>
              <td><strong>{point.point_code || "—"}</strong><span>{point.name}</span></td>
              <td><strong>{point.province}{point.district ? ` · ${point.district}` : ""}</strong><span>{point.location_text}</span></td>
              <td>{point.team_name}</td>
              <td>{formatDate(point.assigned_date)}</td>
              <td>{Number(point.target_units || 0).toLocaleString("th-TH")} ต้น</td>
              <td onClick={(event) => event.stopPropagation()}>
                {canManage ? (
                  <select className={`point-status point-status--${point.status}`} value={point.status} onChange={(event) => onStatusChange(point.id, event.target.value)}>
                    {Object.entries(POINT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                ) : <span className={`point-status point-status--${point.status}`}>{POINT_STATUS_LABELS[point.status]}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InstallationModal({ kind, data, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(() => initialForm(kind, data));
  const selectedPlan = data.plans.find((plan) => plan.id === form.plan_id);
  const selectedProjectId = kind === "point" ? selectedPlan?.project_id : form.project_id;
  const availableTeams = data.teams.filter((team) => team.project_id === selectedProjectId);

  function setField(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function submit(event) {
    event.preventDefault();
    const payload = normalizeInstallationPayload(kind, form);
    if (kind === "team") {
      payload.leader_name = data.profiles.find((profile) => profile.id === payload.leader_profile_id)?.full_name || payload.leader_name;
    }
    if (kind === "point") {
      payload.project_id = selectedPlan?.project_id;
    }
    onSubmit(kind, payload);
  }

  return (
    <div className="ip-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="ip-modal" role="dialog" aria-modal="true" aria-labelledby="installation-modal-title">
        <header><div><p>แผนการติดตั้ง</p><h2 id="installation-modal-title">{kind === "team" ? "เพิ่มทีมงาน" : kind === "plan" ? "สร้างแผนใหม่" : "เพิ่มจุดติดตั้ง"}</h2></div><button type="button" aria-label="ปิด" onClick={onClose}><X size={20} /></button></header>
        <form onSubmit={submit}>
          {kind === "team" ? <TeamFields form={form} data={data} setField={setField} /> : null}
          {kind === "plan" ? <PlanFields form={form} data={data} setField={setField} /> : null}
          {kind === "point" ? <PointFields form={form} data={data} teams={availableTeams} setField={setField} /> : null}
          <footer><button type="button" className="ip-button ip-button--secondary" onClick={onClose}>ยกเลิก</button><button type="submit" className="ip-button ip-button--primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />} บันทึกข้อมูล</button></footer>
        </form>
      </div>
    </div>
  );
}

function TeamFields({ form, data, setField }) {
  return <div className="ip-form-grid">
    <FieldSelect label="โครงการ" value={form.project_id} onChange={(v) => setField("project_id", v)} required options={data.projects.map((p) => [p.id, p.name])} />
    <FieldSelect label="ประเภททีม" value={form.team_type} onChange={(v) => setField("team_type", v)} required options={Object.entries(TEAM_TYPE_LABELS)} />
    <FieldInput label="ชื่อทีม" value={form.name} onChange={(v) => setField("name", v)} required placeholder="ทีมติดตั้ง A" />
    <FieldSelect label="หัวหน้าทีม" value={form.leader_profile_id} onChange={(v) => setField("leader_profile_id", v)} options={data.profiles.map((p) => [p.id, p.full_name || p.display_name])} />
    <FieldInput label="ชื่อหัวหน้าทีม (กรณีไม่มีบัญชี)" value={form.leader_name} onChange={(v) => setField("leader_name", v)} required placeholder="ชื่อ-นามสกุล" />
    <FieldInput label="จำนวนคน" type="number" min="1" value={form.crew_size} onChange={(v) => setField("crew_size", v)} required />
    <FieldTextarea label="ขอบเขตงานของทีม" value={form.assigned_work} onChange={(v) => setField("assigned_work", v)} span />
  </div>;
}

function PlanFields({ form, data, setField }) {
  return <div className="ip-form-grid">
    <FieldSelect label="โครงการ" value={form.project_id} onChange={(v) => setField("project_id", v)} required options={data.projects.map((p) => [p.id, p.name])} span />
    <FieldInput label="ชื่อแผน" value={form.name} onChange={(v) => setField("name", v)} required placeholder="แผนติดตั้งศรีสะเกษ สัปดาห์ที่ 1" span />
    <FieldInput label="พื้นที่หลัก" value={form.area_name} onChange={(v) => setField("area_name", v)} required placeholder="คลัสเตอร์เมืองศรีสะเกษ" />
    <FieldInput label="จังหวัด" value={form.province} onChange={(v) => setField("province", v)} required placeholder="ศรีสะเกษ" />
    <FieldInput label="วันที่เริ่ม" type="date" value={form.start_date} onChange={(v) => setField("start_date", v)} />
    <FieldInput label="วันที่สิ้นสุด" type="date" value={form.end_date} onChange={(v) => setField("end_date", v)} />
    <FieldSelect label="สถานะ" value={form.status} onChange={(v) => setField("status", v)} options={Object.entries(PLAN_STATUS_LABELS)} />
    <FieldTextarea label="หมายเหตุ" value={form.notes} onChange={(v) => setField("notes", v)} span />
  </div>;
}

function PointFields({ form, data, teams, setField }) {
  return <div className="ip-point-form">
    <div className="ip-form-grid">
      <FieldSelect label="แผนการติดตั้ง" value={form.plan_id} onChange={(v) => { setField("plan_id", v); setField("team_id", ""); }} required options={data.plans.map((p) => [p.id, p.name])} span />
      <FieldSelect label="ทีมรับผิดชอบ" value={form.team_id} onChange={(v) => setField("team_id", v)} options={teams.map((t) => [t.id, `${t.name} · ${t.leader_name}`])} />
      <FieldInput label="รหัสจุด" value={form.point_code} onChange={(v) => setField("point_code", v)} placeholder="SK-A-001" />
      <FieldInput label="ชื่อจุดติดตั้ง" value={form.name} onChange={(v) => setField("name", v)} required placeholder="จุดติดตั้งบ้านหนองครก" span />
      <FieldTextarea label="รายละเอียดพื้นที่" value={form.location_text} onChange={(v) => setField("location_text", v)} required span />
      <FieldInput label="จังหวัด" value={form.province} onChange={(v) => setField("province", v)} required />
      <FieldInput label="อำเภอ" value={form.district} onChange={(v) => setField("district", v)} />
      <FieldInput label="ตำบล" value={form.subdistrict} onChange={(v) => setField("subdistrict", v)} />
      <FieldInput label="วันที่เข้าพื้นที่" type="date" value={form.assigned_date} onChange={(v) => setField("assigned_date", v)} />
      <FieldInput label="เป้าหมาย (ต้น)" type="number" min="0" value={form.target_units} onChange={(v) => setField("target_units", v)} required />
      <FieldSelect label="สถานะ" value={form.status} onChange={(v) => setField("status", v)} options={Object.entries(POINT_STATUS_LABELS)} />
      <FieldTextarea label="งานที่มอบหมาย" value={form.assigned_work} onChange={(v) => setField("assigned_work", v)} required span />
      <FieldTextarea label="หมายเหตุเพิ่มเติม" value={form.notes} onChange={(v) => setField("notes", v)} span />
    </div>
    <div className="ip-picker"><div className="ip-picker__title"><MapPin size={16} /><strong>ระบุพิกัดบนแผนที่</strong><span>คลิกตำแหน่งที่ต้องการ</span></div><InstallationMap compact pickerValue={form} onPick={({ latitude, longitude }) => setFormCoordinates(setField, latitude, longitude)} /><div className="coordinate-grid"><FieldInput label="ละติจูด" type="number" step="0.000001" value={form.latitude} onChange={(v) => setField("latitude", v)} /><FieldInput label="ลองจิจูด" type="number" step="0.000001" value={form.longitude} onChange={(v) => setField("longitude", v)} /></div></div>
  </div>;
}

function setFormCoordinates(setField, latitude, longitude) { setField("latitude", latitude); setField("longitude", longitude); }
function FieldInput({ label, value, onChange, span, ...props }) { return <label className={span ? "ip-field ip-field--span" : "ip-field"}><span>{label}{props.required ? " *" : ""}</span><input {...props} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>; }
function FieldTextarea({ label, value, onChange, span, required }) { return <label className={span ? "ip-field ip-field--span" : "ip-field"}><span>{label}{required ? " *" : ""}</span><textarea rows="3" required={required} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>; }
function FieldSelect({ label, value, onChange, options, required, span }) { return <label className={span ? "ip-field ip-field--span" : "ip-field"}><span>{label}{required ? " *" : ""}</span><select required={required} value={value ?? ""} onChange={(e) => onChange(e.target.value)}><option value="">เลือกข้อมูล</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>; }

function initialForm(kind, data) {
  if (kind === "team") return { project_id: data.projects[0]?.id ?? "", team_type: "installation", leader_profile_id: "", leader_name: "", name: "", crew_size: 6, assigned_work: "", is_active: true };
  if (kind === "plan") return { project_id: data.projects[0]?.id ?? "", name: "", area_name: "", province: "", start_date: "", end_date: "", status: "draft", notes: "" };
  return { plan_id: data.plans[0]?.id ?? "", team_id: "", point_code: "", name: "", location_text: "", province: data.plans[0]?.province ?? "", district: "", subdistrict: "", latitude: "", longitude: "", assigned_date: "", target_units: 1, assigned_work: "", notes: "", status: "planned" };
}

function formatDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "ยังไม่กำหนด"; }
