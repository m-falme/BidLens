export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          actor: string
          created_at: string
          id: string
          kind: string
          opportunity_id: string
          payload_json: Json
        }
        Insert: {
          actor: string
          created_at?: string
          id?: string
          kind: string
          opportunity_id: string
          payload_json?: Json
        }
        Update: {
          actor?: string
          created_at?: string
          id?: string
          kind?: string
          opportunity_id?: string
          payload_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      capabilities: {
        Row: {
          company_id: string
          created_at: string
          detail: string | null
          evidence_ref: string | null
          expires_on: string | null
          holding: string | null
          id: string
          kind: string
          name: string
          original_holding: string | null
          self_declared: boolean
          updated_at: string
          verified: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          detail?: string | null
          evidence_ref?: string | null
          expires_on?: string | null
          holding?: string | null
          id?: string
          kind: string
          name: string
          original_holding?: string | null
          self_declared?: boolean
          updated_at?: string
          verified?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          detail?: string | null
          evidence_ref?: string | null
          expires_on?: string | null
          holding?: string | null
          id?: string
          kind?: string
          name?: string
          original_holding?: string | null
          self_declared?: boolean
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "capabilities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          profile_json: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          profile_json?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          profile_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      county_pending_bills: {
        Row: {
          age_1_2y_kes_m: number | null
          age_2_3y_kes_m: number | null
          age_over_3y_kes_m: number | null
          age_under_1y_kes_m: number | null
          ageing_total_kes_m: number | null
          budget_kes_m: number | null
          county: string
          created_at: string
          data_notes: string | null
          data_quality: string
          id: string
          pct_over_2y: number | null
          pct_over_3y: number | null
          pending_total_kes_m: number | null
          report_date: string
          retrieved_at: string | null
          source: string
          source_url: string
          trend_pct: number | null
          updated_at: string
        }
        Insert: {
          age_1_2y_kes_m?: number | null
          age_2_3y_kes_m?: number | null
          age_over_3y_kes_m?: number | null
          age_under_1y_kes_m?: number | null
          ageing_total_kes_m?: number | null
          budget_kes_m?: number | null
          county: string
          created_at?: string
          data_notes?: string | null
          data_quality: string
          id?: string
          pct_over_2y?: number | null
          pct_over_3y?: number | null
          pending_total_kes_m?: number | null
          report_date: string
          retrieved_at?: string | null
          source: string
          source_url: string
          trend_pct?: number | null
          updated_at?: string
        }
        Update: {
          age_1_2y_kes_m?: number | null
          age_2_3y_kes_m?: number | null
          age_over_3y_kes_m?: number | null
          age_under_1y_kes_m?: number | null
          ageing_total_kes_m?: number | null
          budget_kes_m?: number | null
          county?: string
          created_at?: string
          data_notes?: string | null
          data_quality?: string
          id?: string
          pct_over_2y?: number | null
          pct_over_3y?: number | null
          pending_total_kes_m?: number | null
          report_date?: string
          retrieved_at?: string | null
          source?: string
          source_url?: string
          trend_pct?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      county_risk: {
        Row: {
          as_of: string
          band: string
          confidence: string
          county: string
          created_at: string
          id: string
          part_a: number | null
          part_b: number | null
          part_c: number | null
          pending_bills_id: string
          reason: string | null
          score: number | null
          updated_at: string
        }
        Insert: {
          as_of: string
          band: string
          confidence: string
          county: string
          created_at?: string
          id?: string
          part_a?: number | null
          part_b?: number | null
          part_c?: number | null
          pending_bills_id: string
          reason?: string | null
          score?: number | null
          updated_at?: string
        }
        Update: {
          as_of?: string
          band?: string
          confidence?: string
          county?: string
          created_at?: string
          id?: string
          part_a?: number | null
          part_b?: number | null
          part_c?: number | null
          pending_bills_id?: string
          reason?: string | null
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "county_risk_pending_bills_id_fkey"
            columns: ["pending_bills_id"]
            isOneToOne: false
            referencedRelation: "county_pending_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          choice: string
          created_at: string
          decided_by: string
          id: string
          note: string | null
          opportunity_id: string
          snapshot_json: Json
        }
        Insert: {
          choice: string
          created_at?: string
          decided_by: string
          id?: string
          note?: string | null
          opportunity_id: string
          snapshot_json: Json
        }
        Update: {
          choice?: string
          created_at?: string
          decided_by?: string
          id?: string
          note?: string | null
          opportunity_id?: string
          snapshot_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "decisions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_candidates: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          opportunity_id: string
          reasons_json: Json
          resolution: string
          score: number
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          opportunity_id: string
          reasons_json?: Json
          resolution?: string
          score: number
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          reasons_json?: Json
          resolution?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_candidates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_candidates_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          model: string
          prompt_version: string
          provider: string
          source_id: string
          stats_json: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          model: string
          prompt_version: string
          provider: string
          source_id: string
          stats_json?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          model?: string
          prompt_version?: string
          provider?: string
          source_id?: string
          stats_json?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          affects_key: string | null
          confidence: number
          created_at: string
          edited_at: string | null
          edited_by: string | null
          extraction_run_id: string | null
          id: string
          key: string
          opportunity_id: string
          ordinal: number
          original_value: string | null
          page_no: number | null
          quote: string | null
          source_id: string | null
          status: string
          updated_at: string
          value: string | null
        }
        Insert: {
          affects_key?: string | null
          confidence: number
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          extraction_run_id?: string | null
          id?: string
          key: string
          opportunity_id: string
          ordinal?: number
          original_value?: string | null
          page_no?: number | null
          quote?: string | null
          source_id?: string | null
          status: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          affects_key?: string | null
          confidence?: number
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          extraction_run_id?: string | null
          id?: string
          key?: string
          opportunity_id?: string
          ordinal?: number
          original_value?: string | null
          page_no?: number | null
          quote?: string | null
          source_id?: string | null
          status?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fields_extraction_run_id_fkey"
            columns: ["extraction_run_id"]
            isOneToOne: false
            referencedRelation: "extraction_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          buyer_county: string | null
          company_id: string
          created_at: string
          deadline_at: string | null
          follow_up_on: string | null
          id: string
          location: string | null
          next_action: string | null
          organization: string | null
          owner: string | null
          readiness_pct: number | null
          reference: string | null
          retrieved_at: string | null
          sector: string | null
          source_platform: string | null
          source_url: string | null
          status: string
          submission_method: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          buyer_county?: string | null
          company_id: string
          created_at?: string
          deadline_at?: string | null
          follow_up_on?: string | null
          id?: string
          location?: string | null
          next_action?: string | null
          organization?: string | null
          owner?: string | null
          readiness_pct?: number | null
          reference?: string | null
          retrieved_at?: string | null
          sector?: string | null
          source_platform?: string | null
          source_url?: string | null
          status?: string
          submission_method?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          buyer_county?: string | null
          company_id?: string
          created_at?: string
          deadline_at?: string | null
          follow_up_on?: string | null
          id?: string
          location?: string | null
          next_action?: string | null
          organization?: string | null
          owner?: string | null
          readiness_pct?: number | null
          reference?: string | null
          retrieved_at?: string | null
          sector?: string | null
          source_platform?: string | null
          source_url?: string | null
          status?: string
          submission_method?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          brief_md: string | null
          created_at: string
          draft_md: string | null
          id: string
          opportunity_id: string
          placeholders_json: Json
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          brief_md?: string | null
          created_at?: string
          draft_md?: string | null
          id?: string
          opportunity_id: string
          placeholders_json?: Json
          status?: string
          updated_at?: string
          version: number
        }
        Update: {
          brief_md?: string | null
          created_at?: string
          draft_md?: string | null
          id?: string
          opportunity_id?: string
          placeholders_json?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          capability_id: string | null
          category: string
          created_at: string
          id: string
          match: string
          opportunity_id: string
          page_no: number | null
          quote: string | null
          rationale: string | null
          text: string
          updated_at: string
        }
        Insert: {
          capability_id?: string | null
          category: string
          created_at?: string
          id?: string
          match?: string
          opportunity_id: string
          page_no?: number | null
          quote?: string | null
          rationale?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          capability_id?: string | null
          category?: string
          created_at?: string
          id?: string
          match?: string
          opportunity_id?: string
          page_no?: number | null
          quote?: string | null
          rationale?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirements_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          breakeven_days: number | null
          clause_flags_json: Json
          created_at: string
          id: string
          inputs_json: Json
          opportunity_id: string
          price_to_keep_margin_json: Json | null
          reasons_json: Json
          recommendation: string
          scenarios_json: Json
        }
        Insert: {
          breakeven_days?: number | null
          clause_flags_json?: Json
          created_at?: string
          id?: string
          inputs_json: Json
          opportunity_id: string
          price_to_keep_margin_json?: Json | null
          reasons_json?: Json
          recommendation: string
          scenarios_json: Json
        }
        Update: {
          breakeven_days?: number | null
          clause_flags_json?: Json
          created_at?: string
          id?: string
          inputs_json?: Json
          opportunity_id?: string
          price_to_keep_margin_json?: Json | null
          reasons_json?: Json
          recommendation?: string
          scenarios_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      source_pages: {
        Row: {
          created_at: string
          id: string
          is_scanned: boolean
          page_no: number
          source_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_scanned?: boolean
          page_no: number
          source_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_scanned?: boolean
          page_no?: number
          source_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_pages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          created_at: string
          id: string
          kind: string
          opportunity_id: string | null
          original_name: string
          raw_text: string | null
          role: string
          sha256: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          opportunity_id?: string | null
          original_name: string
          raw_text?: string | null
          role?: string
          sha256: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          opportunity_id?: string | null
          original_name?: string
          raw_text?: string | null
          role?: string
          sha256?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_reviews: {
        Row: {
          created_at: string
          id: string
          note: string | null
          reviewer_name: string
          stage: string
          tender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          reviewer_name: string
          stage: string
          tender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          reviewer_name?: string
          stage?: string
          tender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_reviews_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
