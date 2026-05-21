import { useEffect, useState } from "react";

import {
  buildDemoProjectProfitData,
  buildProjectProfitViewData,
} from "../lib/demo-data.js";
import {
  fetchOpenAlertsForOrg,
  fetchProjectsForOrg,
  fetchProjectTemplatesForOrg,
} from "../lib/project-profit-api.js";

function buildInitialState(user) {
  if (!user?.orgId) {
    return {
      status: "ready",
      data: buildDemoProjectProfitData(),
      error: null,
    };
  }

  return {
    status: "loading",
    data: buildProjectProfitViewData({ source: "live" }),
    error: null,
  };
}

export function useProjectProfitData(user) {
  const [state, setState] = useState(() => buildInitialState(user));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.orgId) {
        if (!cancelled) {
          setState({
            status: "ready",
            data: buildDemoProjectProfitData(),
            error: null,
          });
        }

        return;
      }

      if (!cancelled) {
        setState({
          status: "loading",
          data: buildProjectProfitViewData({ source: "live" }),
          error: null,
        });
      }

      try {
        const [
          { data: projects, error: projectError },
          { data: templates, error: templateError },
          { data: alerts, error: alertError },
        ] = await Promise.all([
          fetchProjectsForOrg(user.orgId),
          fetchProjectTemplatesForOrg(user.orgId),
          fetchOpenAlertsForOrg(user.orgId),
        ]);

        const loadError = projectError ?? templateError ?? alertError ?? null;

        if (loadError) {
          if (!cancelled) {
            setState({
              status: "error",
              data: buildProjectProfitViewData({ source: "live" }),
              error: loadError,
            });
          }

          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            data: buildProjectProfitViewData({
              source: "live",
              projects,
              alerts,
              templates,
            }),
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            data: buildProjectProfitViewData({ source: "live" }),
            error,
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [user?.orgId]);

  return state;
}
