# ISO 22330/22331 Feature Roadmap (Plan -> Implement -> Check -> Improve)

## เป้าหมาย
พัฒนาระบบ BCMS SaaS ให้ผู้ใช้สามารถ:
- กำหนดกลยุทธ์ความต่อเนื่องทางธุรกิจเชิงบุคลากร
- ประเมินความพร้อมกำลังคนต่อกระบวนการสำคัญ
- ติดตามช่องว่างและแผนปรับปรุงอย่างต่อเนื่อง

## ขอบเขตมาตรฐานที่นำมาใช้
- **ISO 22331**: แนวทางด้านกลยุทธ์ความต่อเนื่องและการกำหนดวิธีรองรับ (continuity strategies and solutions)
- **ISO 22330**: แนวทางการจัดการบุคลากร (people aspects) เพื่อรองรับการตอบสนองและฟื้นฟู

> หมายเหตุ: ไฟล์ PDF ที่แนบเป็นสแกนภาพ จึงอ้างอิงการออกแบบจากหลักการมาตรฐานที่ใช้งานทั่วไปและสอดคล้องกับ BCMS implementation

---

## 1) PLAN (วางแผนระบบ)

### 1.1 Capability Map ที่ต้องมี
- โครงสร้างหน่วยงาน/ทีม (`org_units`)
- ข้อมูลบุคลากรเชิงความต่อเนื่อง (`personnel_profiles`)
- บทบาทสำคัญและขั้นต่ำกำลังคน (`personnel_roles`)
- การมอบหมายงานหลัก/สำรอง (`personnel_assignments`)
- ความสามารถและหลักฐาน competency (`personnel_competencies`, `personnel_competency_evidence`)
- รอบฝึกอบรม/ซ้อมแผน (`personnel_training_cycles`)
- แผนแก้ไขปรับปรุง (CAPA) (`personnel_improvement_actions`)

### 1.2 KPI หลัก
- Role Coverage %
- On-time Training Completion %
- Competency Achievement %
- Overdue Action %
- Personnel Readiness Score (รวมถ่วงน้ำหนัก)

### 1.3 Governance/RBAC
- แยกสิทธิ์ `org` vs `department`
- owner/admin เห็นทุกหน่วยงานในองค์กร
- member เห็นเฉพาะหน่วยงานของตน

---

## 2) IMPLEMENT (ดำเนินการ)

### 2.1 สิ่งที่ลงในระบบแล้ว
- Migration: [20260510_personnel_continuity_features.sql](D:\BCMS SaaS\supabase\migrations\20260510_personnel_continuity_features.sql)
- ฟังก์ชันประเมินความพร้อม: `evaluate_personnel_readiness(org_id, unit_id)`
- View snapshot: `personnel_readiness_snapshot`
- RLS policies สำหรับตารางบุคลากรทั้งหมด

### 2.2 สิ่งที่ต้องทำต่อใน UI
1. หน้าจัดการหน่วยงานและบทบาทสำคัญ
2. หน้าความพร้อมบุคลากร (Readiness Dashboard)
3. หน้าฝึกอบรม/ซ้อมแผน + สถานะตามกำหนด
4. หน้าติดตาม Action Plan และ overdue

---

## 3) CHECK (ตรวจสอบ)

### 3.1 Functional Verification
- ทดสอบสิทธิ์ RBAC ตาม role/access_level
- ทดสอบคำนวณคะแนน readiness จากข้อมูลจริง
- ทดสอบการปิดงาน action แล้วคะแนนดีขึ้น

### 3.2 Data Quality Checks
- ทุก role ต้องมี `min_headcount`
- ทุก unit ต้องมี `minimum_capacity_pct`
- competency evidence ที่หมดอายุต้องถูกนับเป็น gap

---

## 4) IMPROVE (ปรับปรุงต่อเนื่อง)

### 4.1 รอบการปรับปรุง
- รายเดือน: ตรวจ score และเปิด action ใหม่
- รายไตรมาส: ทบทวน role criticality / min staffing
- รายปี: ทบทวน strategy assumptions ตามบริบทธุรกิจ

### 4.2 Automation ที่แนะนำ
- Alert เมื่อ readiness score ต่ำกว่า threshold
- Alert เมื่อ training ใกล้ due และยังไม่ครบ
- Alert เมื่อ open actions เกิน SLA

---

## Acceptance Criteria (เวอร์ชันแรก)
- ผู้ใช้กำหนด unit/role/person/competency/training/action ได้
- ผู้ใช้เห็น readiness score องค์กรและรายหน่วยงานได้
- RBAC แยกองค์กร/หน่วยงานได้จริง
- มีหลักฐานการตรวจสอบและปรับปรุงต่อเนื่องได้

