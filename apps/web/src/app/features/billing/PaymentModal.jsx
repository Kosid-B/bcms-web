import React, { Suspense, lazy } from "react";

const LegacyPaymentModal = lazy(() =>
  import("../../../../../../bcms-saas-platform.jsx").then((module) => ({
    default: module.PaymentModal,
  }))
);

export default function PaymentModal({ pkgId, ...props }) {
  return (
    <Suspense fallback={null}>
      <LegacyPaymentModal
        {...props}
        pkg={{
          id: pkgId,
          name: pkgId === "enterprise" ? "Enterprise" : pkgId === "starter" ? "Starter" : "Professional",
          price: pkgId === "starter" ? 2900 : pkgId === "enterprise" ? 19900 : 7900,
          priceAnnual: pkgId === "starter" ? 2320 : pkgId === "enterprise" ? 15920 : 6320,
        }}
      />
    </Suspense>
  );
}
