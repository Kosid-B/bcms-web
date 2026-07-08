import { useCallback, useEffect, useState } from "react";

import { INSTALLATION_DEMO_DATA } from "../lib/demo-data.js";
import { fetchInstallationPlanningData } from "../lib/installation-planning-api.js";
import { buildInstallationPlanningView } from "../lib/installation-planning.js";

const demoView = buildInstallationPlanningView(INSTALLATION_DEMO_DATA);

export function useInstallationPlanningData(user) {
  const [state, setState] = useState({
    status: user?.orgId ? "loading" : "ready",
    source: "demo",
    data: demoView,
    error: null,
  });

  const reload = useCallback(async () => {
    if (!user?.orgId) {
      setState({ status: "ready", source: "demo", data: demoView, error: null });
      return;
    }

    setState((current) => ({ ...current, status: "loading", error: null }));

    try {
      const result = await fetchInstallationPlanningData(user.orgId);

      if (result.error) {
        setState({
          status: "ready",
          source: "demo",
          data: demoView,
          error: result.error,
        });
        return;
      }

      setState({
        status: "ready",
        source: "live",
        data: buildInstallationPlanningView(result.data),
        error: null,
      });
    } catch (error) {
      setState({ status: "ready", source: "demo", data: demoView, error });
    }
  }, [user?.orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

