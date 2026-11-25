import "server-only";

import { DEFAULT_SETTINGS, type WorkspaceSettings } from "@/lib/settings/schema";

import { getServiceClient } from "../supabase-server";
import { getDemoCompanyId } from "./tenders";

/**
 * The saved settings, or the defaults. A missing row, or a read that fails, gives the defaults and is logged,
 * so no page ever breaks because of Settings.
 */
export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  try {
    const companyId = await getDemoCompanyId();
    const { data, error } = await getServiceClient()
      .from("workspace_settings")
      .select(
        "financing_rate, require_stage_reviews, auto_start_analysis, alert_closing, alert_closing_days, alert_documents, alert_documents_days",
      )
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULT_SETTINGS;
    return {
      financingRate: Number(data.financing_rate),
      requireStageReviews: data.require_stage_reviews,
      autoStartAnalysis: data.auto_start_analysis,
      alertClosing: data.alert_closing,
      alertClosingDays: data.alert_closing_days,
      alertDocuments: data.alert_documents,
      alertDocumentsDays: data.alert_documents_days,
    };
  } catch (error) {
    console.error("load workspace settings", error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<void> {
  const companyId = await getDemoCompanyId();
  const { error } = await getServiceClient()
    .from("workspace_settings")
    .upsert({
      company_id: companyId,
      updated_at: new Date().toISOString(),
      financing_rate: settings.financingRate,
      require_stage_reviews: settings.requireStageReviews,
      auto_start_analysis: settings.autoStartAnalysis,
      alert_closing: settings.alertClosing,
      alert_closing_days: settings.alertClosingDays,
      alert_documents: settings.alertDocuments,
      alert_documents_days: settings.alertDocumentsDays,
    });
  if (error) throw new Error(`save workspace settings: ${error.message}`);
}
