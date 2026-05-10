# RBAC Production Checklist (Org Level + Department Level)

ใช้เอกสารนี้ตรวจระบบหลัง deploy RBAC ให้ครบทั้งฐานข้อมูลและหน้าเว็บ

## 1) เตรียมผู้ใช้ทดสอบ

ต้องมีอย่างน้อย 3 บัญชี:
- `owner/admin` ระดับองค์กร (`access_level = org`)
- `member` ฝ่าย IT (`access_level = department`, `department = IT`)
- `member` ฝ่าย Finance (`access_level = department`, `department = Finance`)

ถ้ายังไม่มีข้อมูล ให้รัน:
- [rbac-seed-org-department.sql](D:\BCMS SaaS\scripts\rbac-seed-org-department.sql)

## 2) ตรวจโครงสร้าง RBAC ในฐานข้อมูล

รันใน Supabase SQL Editor:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('access_level', 'department');

select policyname, tablename
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','bia_processes','resources','bc_plans','process_resources')
order by tablename, policyname;
```

ผลที่คาดหวัง:
- มีคอลัมน์ `access_level`, `department` ใน `profiles`
- มี policy ครบสำหรับ 5 ตารางหลัก RBAC

## 3) ทดสอบสิทธิ์ระดับองค์กร (owner/admin)

ล็อกอินด้วย owner/admin:
- ต้องเห็นข้อมูลทุก department ในองค์กรเดียวกัน
- ต้องสร้าง/แก้ไข/ลบ `bia_processes`, `resources`, `bc_plans`, `process_resources` ได้

## 4) ทดสอบสิทธิ์ระดับหน่วยงาน (department user)

ล็อกอิน IT user:
- ต้องเห็นเฉพาะข้อมูล department = IT
- ห้ามเห็นหรือแก้ข้อมูล department = Finance

ล็อกอิน Finance user:
- ต้องเห็นเฉพาะข้อมูล department = Finance
- ห้ามเห็นหรือแก้ข้อมูล department = IT

## 5) ทดสอบกรณีข้ามองค์กร

ใช้บัญชีจากองค์กร A:
- ต้องไม่เห็นข้อมูลจากองค์กร B ทุกตาราง

## 6) ทดสอบการสร้างข้อมูลใหม่

สำหรับ department user:
- ถ้าสร้าง record ด้วย department ของตัวเอง ต้องสำเร็จ
- ถ้าพยายามสร้าง department อื่น ต้องโดนปฏิเสธด้วย RLS

## 7) ทดสอบฟังก์ชันที่โยงข้อมูล (แผนต่อ process)

สร้าง `bc_plan` ที่ผูก `process_id`:
- ถ้า `process_id` เป็น process ของแผนกตัวเอง ต้องสำเร็จ
- ถ้า `process_id` เป็นของอีกแผนก ต้องไม่ผ่าน

## 8) ตรวจ regression พื้นฐาน

- หน้า Dashboard โหลดได้
- BIA Module เพิ่ม process ได้ (กรณีสิทธิ์ถูกต้อง)
- ไม่เกิด `permission denied` กับ owner/admin
- ข้อมูล realtime ไม่หลุดข้ามหน่วยงาน

## 9) Sign-off ก่อนขึ้น production จริง

ให้บันทึกผลเป็นตาราง:
- ผู้ทดสอบ
- วันเวลา
- user role/access_level
- กรณีทดสอบ
- ผลลัพธ์ (Pass/Fail)
- หลักฐาน (screenshot / SQL output)

