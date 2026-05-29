import React, { Suspense, lazy } from "react";

const LegacyWelcomePage = lazy(() =>
  import("../../../../../../bcms-saas-platform.jsx").then((module) => ({
    default: module.WelcomePage,
  })),
);

function WelcomePage(props) {
  return (
    <Suspense fallback={null}>
      <LegacyWelcomePage {...props} />
    </Suspense>
  );
}

export default WelcomePage;
export { WelcomePage };

