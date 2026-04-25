import React, { Suspense, lazy } from "react";

const LegacyDashboard = lazy(() =>
  import("../../../../../../bcms-saas-platform.jsx").then((module) => ({
    default: module.Dashboard,
  }))
);

export default function Dashboard(props) {
  return (
    <Suspense fallback={null}>
      <LegacyDashboard {...props} />
    </Suspense>
  );
}
