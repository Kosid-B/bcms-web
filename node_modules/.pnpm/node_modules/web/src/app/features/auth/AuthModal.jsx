import React, { Suspense, lazy } from "react";

const LegacyAuthModal = lazy(() =>
  import("../../../../../../bcms-saas-platform.jsx").then((module) => ({
    default: module.AuthModal,
  }))
);

export default function AuthModal(props) {
  return (
    <Suspense fallback={null}>
      <LegacyAuthModal {...props} />
    </Suspense>
  );
}
