import React, { Suspense, lazy } from "react";

import {
  TenantLoadingScreen,
  TenantNotFoundScreen,
  TenantProvider,
  useTenantBootstrap,
} from "./tenant/runtime";

const AppCore = lazy(() =>
  import("./AppCore.jsx")
);

export default function App() {
  const { tenant, loading, error } = useTenantBootstrap();

  if (loading) return <TenantLoadingScreen />;
  if (error === "not_found") return <TenantNotFoundScreen />;

  return (
    <TenantProvider value={tenant}>
      <Suspense fallback={<TenantLoadingScreen />}>
        <AppCore tenant={tenant} />
      </Suspense>
    </TenantProvider>
  );
}
