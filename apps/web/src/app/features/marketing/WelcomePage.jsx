import React, { Suspense, lazy } from "react";

// 1. ดักจับ Error ในกรณีที่ Dynamic Import ล้มเหลวเพื่อไม่ให้ระบบพัง
const LegacyWelcomePage = lazy(() =>
  import("../../../../../../bcms-saas-platform.jsx")
    .then((module) => ({
      default: module.WelcomePage,
    }))
    .catch((error) => {
      console.error("Failed to load WelcomePage module:", error);
      // คืนค่าเป็น Component แจ้งเตือนข้อผิดพลาดแทน
      return { 
        default: () => (
          <div className="error-container">
            <p>ไม่สามารถโหลดหน้าจอได้ กรุณาลองใหม่อีกครั้ง</p>
          </div>
        ) 
      };
    })
);

// 2. สร้าง Fallback Component ที่สื่อสารกับผู้ใช้ชัดเจน
const LoadingFallback = () => (
  <div className="loading-container">
    <p>กำลังโหลดข้อมูล...</p>
    {/* สามารถใส่ Spinner หรือ UI Skeleton ตรงนี้ */}
  </div>
);

function WelcomePage(props) {
  return (
    // 3. ปรับปรุง UX โดยใส่ LoadingFallback แทน null
    <Suspense fallback={<LoadingFallback />}>
      <LegacyWelcomePage {...props} />
    </Suspense>
  );
}

// 4. คงเหลือไว้เฉพาะ Export ที่จำเป็นต่อการใช้งาน
export default WelcomePage;