import React, { Suspense, lazy } from "react";

const LegacySuccessModal = lazy(() =>
  import("../../../../../../bcms-saas-platform.jsx").then((module) => ({
    default: module.SuccessModal,
  }))
);

const LegacyRealtimeUpgradeModal = lazy(() =>
  import("../../../../../../bcms-saas-platform.jsx").then((module) => ({
    default: module.RealtimeUpgradeModal,
  }))
);

export function SuccessModal(props) {
  return (
    <Suspense fallback={null}>
      <LegacySuccessModal {...props} />
    </Suspense>
  );
}

export function RealtimeUpgradeModal(props) {
  return (
    <Suspense fallback={null}>
      <LegacyRealtimeUpgradeModal {...props} />
    </Suspense>
  );
}
