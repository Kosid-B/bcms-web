import React from "react";

import { AppCore } from "../../../../bcms-saas-platform.jsx";
import {
  TenantLoadingScreen,
  TenantNotFoundScreen,
  TenantProvider,
  useTenantBootstrap,
} from "./tenant/runtime";

export default function App() {
  const { tenant, loading, error } = useTenantBootstrap();

  if (loading) return <TenantLoadingScreen />;
  if (error === "not_found") return <TenantNotFoundScreen />;

  return (
    <TenantProvider value={tenant}>
      <AppCore tenant={tenant} />
    </TenantProvider>
  );
}
