import { supaLite } from "../../../lib/supa-lite.js";

export async function fetchProjectsForOrg(orgId) {
  return supaLite
    .from("projects")
    .select(
      "id,org_id,template_id,name,code,status,start_date,end_date,current_cash_balance_thb,features"
    )
    .eq("org_id", orgId)
    ._execute();
}

export async function fetchProjectTemplatesForOrg(orgId) {
  return supaLite
    .from("project_templates")
    .select(
      "id,org_id,name,unit_label,target_units,target_profit_thb,target_margin_pct,target_npv_thb,target_irr_pct,target_mirr_pct,target_payback_days,machinery_budget_thb"
    )
    .eq("org_id", orgId)
    ._execute();
}

export async function fetchOpenAlertsForOrg(orgId) {
  return supaLite
    .from("project_alerts")
    .select(
      "id,org_id,project_id,cluster_id,severity,alert_type,title,impact_summary,recommended_action,status,due_date"
    )
    .eq("org_id", orgId)
    .eq("status", "open")
    ._execute();
}
