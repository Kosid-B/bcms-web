import React, { Suspense, lazy } from "react";

const LegacyWelcomePage = lazy(() =>
  import("../../../../../../bcms-saas-platform.jsx").then((module) => ({
    default: module.WelcomePage,
  }))
);

export default function WelcomePage(props) {
  return (
    <Suspense fallback={null}>
      <LegacyWelcomePage {...props} />
    </Suspense>
  );
}
