export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      affiliate_clicks: {
        Row: {
          created_at: string;
          fingerprint_hash: string | null;
          id: number;
          landing_path: string | null;
          link_id: string;
          locale: string | null;
          referer: string | null;
        };
        Insert: {
          created_at?: string;
          fingerprint_hash?: string | null;
          id?: number;
          landing_path?: string | null;
          link_id: string;
          locale?: string | null;
          referer?: string | null;
        };
        Update: {
          created_at?: string;
          fingerprint_hash?: string | null;
          id?: number;
          landing_path?: string | null;
          link_id?: string;
          locale?: string | null;
          referer?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: false;
            referencedRelation: "affiliate_links";
            referencedColumns: ["id"];
          },
        ];
      };
      affiliate_links: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      buyer_lead_matches: {
        Row: {
          buyer_lead_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          score: Database["public"]["Enums"]["match_score"] | null;
          vehicle_opportunity_id: string;
        };
        Insert: {
          buyer_lead_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          score?: Database["public"]["Enums"]["match_score"] | null;
          vehicle_opportunity_id: string;
        };
        Update: {
          buyer_lead_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          score?: Database["public"]["Enums"]["match_score"] | null;
          vehicle_opportunity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_lead_matches_buyer_lead_id_fkey";
            columns: ["buyer_lead_id"];
            isOneToOne: false;
            referencedRelation: "buyer_leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_lead_matches_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      buyer_lead_status_history: {
        Row: {
          buyer_lead_id: string;
          changed_by: string | null;
          created_at: string;
          id: string;
          new_status: Database["public"]["Enums"]["buyer_lead_status"];
          old_status: Database["public"]["Enums"]["buyer_lead_status"] | null;
        };
        Insert: {
          buyer_lead_id: string;
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_status: Database["public"]["Enums"]["buyer_lead_status"];
          old_status?: Database["public"]["Enums"]["buyer_lead_status"] | null;
        };
        Update: {
          buyer_lead_id?: string;
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_status?: Database["public"]["Enums"]["buyer_lead_status"];
          old_status?: Database["public"]["Enums"]["buyer_lead_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_lead_status_history_buyer_lead_id_fkey";
            columns: ["buyer_lead_id"];
            isOneToOne: false;
            referencedRelation: "buyer_leads";
            referencedColumns: ["id"];
          },
        ];
      };
      buyer_leads: {
        Row: {
          assigned_group: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id: string | null;
          assigned_sales_agent_id: string | null;
          body_type: string | null;
          budget_flexible: string | null;
          buy_timeline: string | null;
          city: string | null;
          company_name: string | null;
          country: string | null;
          created_at: string;
          currency: string;
          email: string;
          embedded_at: string | null;
          embedding: string | null;
          embedding_source_hash: string | null;
          extra: Json;
          financing_needed: string | null;
          first_name: string;
          fuel_type: string | null;
          gdpr_consent: boolean;
          gearbox: string | null;
          id: string;
          intended_use: string | null;
          last_name: string;
          locale: string;
          max_budget_ht: number | null;
          max_mileage: number | null;
          message: string | null;
          min_euro_norm: string | null;
          min_year: number | null;
          payload_kg: number | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          phone: string | null;
          preferred_brand: string | null;
          preferred_model: string | null;
          ptac_kg: number | null;
          reference_number: string | null;
          referral_code: string | null;
          referred_by: string | null;
          reject_reason: string | null;
          required_equipment: string[] | null;
          source: string;
          status: Database["public"]["Enums"]["buyer_lead_status"];
          updated_at: string;
          usage_country: string | null;
          user_id: string | null;
          vehicle_category: string | null;
          vehicle_type: string | null;
          wanted_equipment: string[] | null;
        };
        Insert: {
          assigned_group?: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id?: string | null;
          assigned_sales_agent_id?: string | null;
          body_type?: string | null;
          budget_flexible?: string | null;
          buy_timeline?: string | null;
          city?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          currency?: string;
          email: string;
          embedded_at?: string | null;
          embedding?: string | null;
          embedding_source_hash?: string | null;
          extra?: Json;
          financing_needed?: string | null;
          first_name: string;
          fuel_type?: string | null;
          gdpr_consent?: boolean;
          gearbox?: string | null;
          id?: string;
          intended_use?: string | null;
          last_name: string;
          locale?: string;
          max_budget_ht?: number | null;
          max_mileage?: number | null;
          message?: string | null;
          min_euro_norm?: string | null;
          min_year?: number | null;
          payload_kg?: number | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          phone?: string | null;
          preferred_brand?: string | null;
          preferred_model?: string | null;
          ptac_kg?: number | null;
          reference_number?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          reject_reason?: string | null;
          required_equipment?: string[] | null;
          source?: string;
          status?: Database["public"]["Enums"]["buyer_lead_status"];
          updated_at?: string;
          usage_country?: string | null;
          user_id?: string | null;
          vehicle_category?: string | null;
          vehicle_type?: string | null;
          wanted_equipment?: string[] | null;
        };
        Update: {
          assigned_group?: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id?: string | null;
          assigned_sales_agent_id?: string | null;
          body_type?: string | null;
          budget_flexible?: string | null;
          buy_timeline?: string | null;
          city?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          currency?: string;
          email?: string;
          embedded_at?: string | null;
          embedding?: string | null;
          embedding_source_hash?: string | null;
          extra?: Json;
          financing_needed?: string | null;
          first_name?: string;
          fuel_type?: string | null;
          gdpr_consent?: boolean;
          gearbox?: string | null;
          id?: string;
          intended_use?: string | null;
          last_name?: string;
          locale?: string;
          max_budget_ht?: number | null;
          max_mileage?: number | null;
          message?: string | null;
          min_euro_norm?: string | null;
          min_year?: number | null;
          payload_kg?: number | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          phone?: string | null;
          preferred_brand?: string | null;
          preferred_model?: string | null;
          ptac_kg?: number | null;
          reference_number?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          reject_reason?: string | null;
          required_equipment?: string[] | null;
          source?: string;
          status?: Database["public"]["Enums"]["buyer_lead_status"];
          updated_at?: string;
          usage_country?: string | null;
          user_id?: string | null;
          vehicle_category?: string | null;
          vehicle_type?: string | null;
          wanted_equipment?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_leads_assigned_group_id_fkey";
            columns: ["assigned_group_id"];
            isOneToOne: false;
            referencedRelation: "staff_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      client_quotes: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
        };
        Relationships: [];
      };
      commission_rules: {
        Row: {
          active: boolean;
          applies_to: Database["public"]["Enums"]["commission_scope"];
          basis: Database["public"]["Enums"]["commission_basis"];
          created_at: string;
          id: string;
          match_value: string | null;
          name: string;
          notes: string | null;
          priority: number;
          rule_kind: Database["public"]["Enums"]["commission_rule_kind"];
          rule_value: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          applies_to?: Database["public"]["Enums"]["commission_scope"];
          basis?: Database["public"]["Enums"]["commission_basis"];
          created_at?: string;
          id?: string;
          match_value?: string | null;
          name: string;
          notes?: string | null;
          priority?: number;
          rule_kind?: Database["public"]["Enums"]["commission_rule_kind"];
          rule_value: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          applies_to?: Database["public"]["Enums"]["commission_scope"];
          basis?: Database["public"]["Enums"]["commission_basis"];
          created_at?: string;
          id?: string;
          match_value?: string | null;
          name?: string;
          notes?: string | null;
          priority?: number;
          rule_kind?: Database["public"]["Enums"]["commission_rule_kind"];
          rule_value?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      cost_estimates: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          vehicle_opportunity_id: string | null;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          vehicle_opportunity_id?: string | null;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          vehicle_opportunity_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cost_estimates_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      demand_opportunities: {
        Row: {
          assigned_group: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id: string | null;
          assigned_sales_agent_id: string | null;
          body_type: string | null;
          brand: string | null;
          buyer_lead_id: string;
          city: string | null;
          client_id: string | null;
          closed_at: string | null;
          country: string | null;
          created_at: string;
          fuel_type: string | null;
          gearbox: string | null;
          id: string;
          lost_reason: string | null;
          matched_vehicle_opportunity_id: string | null;
          max_budget_ht: number | null;
          max_mileage: number | null;
          min_euro_norm: string | null;
          model: string | null;
          notes: string | null;
          reference_number: string | null;
          stage: Database["public"]["Enums"]["demand_stage"];
          status: Database["public"]["Enums"]["demand_opportunity_status"];
          submitted_at: string | null;
          updated_at: string;
          vehicle_category: string | null;
          vehicle_type: string | null;
          year_max: number | null;
          year_min: number | null;
        };
        Insert: {
          assigned_group?: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id?: string | null;
          assigned_sales_agent_id?: string | null;
          body_type?: string | null;
          brand?: string | null;
          buyer_lead_id: string;
          city?: string | null;
          client_id?: string | null;
          closed_at?: string | null;
          country?: string | null;
          created_at?: string;
          fuel_type?: string | null;
          gearbox?: string | null;
          id?: string;
          lost_reason?: string | null;
          matched_vehicle_opportunity_id?: string | null;
          max_budget_ht?: number | null;
          max_mileage?: number | null;
          min_euro_norm?: string | null;
          model?: string | null;
          notes?: string | null;
          reference_number?: string | null;
          stage?: Database["public"]["Enums"]["demand_stage"];
          status?: Database["public"]["Enums"]["demand_opportunity_status"];
          submitted_at?: string | null;
          updated_at?: string;
          vehicle_category?: string | null;
          vehicle_type?: string | null;
          year_max?: number | null;
          year_min?: number | null;
        };
        Update: {
          assigned_group?: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id?: string | null;
          assigned_sales_agent_id?: string | null;
          body_type?: string | null;
          brand?: string | null;
          buyer_lead_id?: string;
          city?: string | null;
          client_id?: string | null;
          closed_at?: string | null;
          country?: string | null;
          created_at?: string;
          fuel_type?: string | null;
          gearbox?: string | null;
          id?: string;
          lost_reason?: string | null;
          matched_vehicle_opportunity_id?: string | null;
          max_budget_ht?: number | null;
          max_mileage?: number | null;
          min_euro_norm?: string | null;
          model?: string | null;
          notes?: string | null;
          reference_number?: string | null;
          stage?: Database["public"]["Enums"]["demand_stage"];
          status?: Database["public"]["Enums"]["demand_opportunity_status"];
          submitted_at?: string | null;
          updated_at?: string;
          vehicle_category?: string | null;
          vehicle_type?: string | null;
          year_max?: number | null;
          year_min?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "demand_opportunities_assigned_group_id_fkey";
            columns: ["assigned_group_id"];
            isOneToOne: false;
            referencedRelation: "staff_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "demand_opportunities_buyer_lead_id_fkey";
            columns: ["buyer_lead_id"];
            isOneToOne: false;
            referencedRelation: "buyer_leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "demand_opportunities_matched_vehicle_opportunity_id_fkey";
            columns: ["matched_vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      demand_opportunity_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          demand_opportunity_id: string;
          id: string;
          message: string | null;
          new_status: Database["public"]["Enums"]["demand_opportunity_status"];
          old_status: Database["public"]["Enums"]["demand_opportunity_status"] | null;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          demand_opportunity_id: string;
          id?: string;
          message?: string | null;
          new_status: Database["public"]["Enums"]["demand_opportunity_status"];
          old_status?: Database["public"]["Enums"]["demand_opportunity_status"] | null;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          demand_opportunity_id?: string;
          id?: string;
          message?: string | null;
          new_status?: Database["public"]["Enums"]["demand_opportunity_status"];
          old_status?: Database["public"]["Enums"]["demand_opportunity_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "demand_opportunity_status_history_demand_opportunity_id_fkey";
            columns: ["demand_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "demand_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      information_requests: {
        Row: {
          admin_id: string | null;
          answered_at: string | null;
          created_at: string;
          id: string;
          message: string;
          response: string | null;
          response_at: string | null;
          status: Database["public"]["Enums"]["info_request_status"];
          vehicle_opportunity_id: string;
        };
        Insert: {
          admin_id?: string | null;
          answered_at?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          response?: string | null;
          response_at?: string | null;
          status?: Database["public"]["Enums"]["info_request_status"];
          vehicle_opportunity_id: string;
        };
        Update: {
          admin_id?: string | null;
          answered_at?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          response?: string | null;
          response_at?: string | null;
          status?: Database["public"]["Enums"]["info_request_status"];
          vehicle_opportunity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "information_requests_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      internal_notes: {
        Row: {
          admin_id: string;
          created_at: string;
          id: string;
          note: string;
          vehicle_opportunity_id: string;
        };
        Insert: {
          admin_id: string;
          created_at?: string;
          id?: string;
          note: string;
          vehicle_opportunity_id: string;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          id?: string;
          note?: string;
          vehicle_opportunity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "internal_notes_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_inquiries: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
        };
        Relationships: [];
      };
      match_candidates: {
        Row: {
          ai_rationale: string | null;
          ai_score: number | null;
          created_at: string;
          criteria_breakdown: Json;
          id: string;
          notified_at: string | null;
          profile_id: string | null;
          rule_score: number | null;
          run_id: string | null;
          score: number;
          source_id: string;
          source_kind: Database["public"]["Enums"]["match_source_kind"];
          status: Database["public"]["Enums"]["match_status"];
          target_id: string;
          target_kind: Database["public"]["Enums"]["match_source_kind"];
          updated_at: string;
          verdict: string | null;
        };
        Insert: {
          ai_rationale?: string | null;
          ai_score?: number | null;
          created_at?: string;
          criteria_breakdown?: Json;
          id?: string;
          notified_at?: string | null;
          profile_id?: string | null;
          rule_score?: number | null;
          run_id?: string | null;
          score: number;
          source_id: string;
          source_kind: Database["public"]["Enums"]["match_source_kind"];
          status?: Database["public"]["Enums"]["match_status"];
          target_id: string;
          target_kind: Database["public"]["Enums"]["match_source_kind"];
          updated_at?: string;
          verdict?: string | null;
        };
        Update: {
          ai_rationale?: string | null;
          ai_score?: number | null;
          created_at?: string;
          criteria_breakdown?: Json;
          id?: string;
          notified_at?: string | null;
          profile_id?: string | null;
          rule_score?: number | null;
          run_id?: string | null;
          score?: number;
          source_id?: string;
          source_kind?: Database["public"]["Enums"]["match_source_kind"];
          status?: Database["public"]["Enums"]["match_status"];
          target_id?: string;
          target_kind?: Database["public"]["Enums"]["match_source_kind"];
          updated_at?: string;
          verdict?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "match_candidates_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "matching_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_candidates_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "match_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      match_feedback: {
        Row: {
          admin_id: string;
          created_at: string;
          id: string;
          match_candidate_id: string;
          note: string | null;
          vote: number;
        };
        Insert: {
          admin_id: string;
          created_at?: string;
          id?: string;
          match_candidate_id: string;
          note?: string | null;
          vote: number;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          id?: string;
          match_candidate_id?: string;
          note?: string | null;
          vote?: number;
        };
        Relationships: [
          {
            foreignKeyName: "match_feedback_match_candidate_id_fkey";
            columns: ["match_candidate_id"];
            isOneToOne: false;
            referencedRelation: "match_candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      match_runs: {
        Row: {
          candidates_returned: number;
          candidates_scored: number;
          completion_tokens: number | null;
          created_at: string;
          error: string | null;
          id: string;
          latency_ms: number | null;
          model_id: string | null;
          profile_id: string | null;
          prompt_tokens: number | null;
          ran_by: string | null;
          source_id: string;
          source_kind: Database["public"]["Enums"]["match_source_kind"];
          target_kinds: Database["public"]["Enums"]["match_source_kind"][];
        };
        Insert: {
          candidates_returned?: number;
          candidates_scored?: number;
          completion_tokens?: number | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          latency_ms?: number | null;
          model_id?: string | null;
          profile_id?: string | null;
          prompt_tokens?: number | null;
          ran_by?: string | null;
          source_id: string;
          source_kind: Database["public"]["Enums"]["match_source_kind"];
          target_kinds?: Database["public"]["Enums"]["match_source_kind"][];
        };
        Update: {
          candidates_returned?: number;
          candidates_scored?: number;
          completion_tokens?: number | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          latency_ms?: number | null;
          model_id?: string | null;
          profile_id?: string | null;
          prompt_tokens?: number | null;
          ran_by?: string | null;
          source_id?: string;
          source_kind?: Database["public"]["Enums"]["match_source_kind"];
          target_kinds?: Database["public"]["Enums"]["match_source_kind"][];
        };
        Relationships: [
          {
            foreignKeyName: "match_runs_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "matching_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      matching_profiles: {
        Row: {
          ai_blend: number;
          auto_notify: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          hard_filters: Json;
          id: string;
          is_default: boolean;
          max_results: number;
          min_score: number;
          model_id: string;
          name: string;
          updated_at: string;
          weights: Json;
        };
        Insert: {
          ai_blend?: number;
          auto_notify?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          hard_filters?: Json;
          id?: string;
          is_default?: boolean;
          max_results?: number;
          min_score?: number;
          model_id?: string;
          name: string;
          updated_at?: string;
          weights?: Json;
        };
        Update: {
          ai_blend?: number;
          auto_notify?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          hard_filters?: Json;
          id?: string;
          is_default?: boolean;
          max_results?: number;
          min_score?: number;
          model_id?: string;
          name?: string;
          updated_at?: string;
          weights?: Json;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
          vehicle_opportunity_id: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
          vehicle_opportunity_id?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
          vehicle_opportunity_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      ocr_field_detections: {
        Row: {
          action: Database["public"]["Enums"]["ocr_field_action"];
          confidence: number | null;
          created_at: string;
          detected_value: string | null;
          field_name: string;
          final_value: string | null;
          id: string;
          scan_id: string;
          source_image_path: string | null;
          updated_at: string;
        };
        Insert: {
          action?: Database["public"]["Enums"]["ocr_field_action"];
          confidence?: number | null;
          created_at?: string;
          detected_value?: string | null;
          field_name: string;
          final_value?: string | null;
          id?: string;
          scan_id: string;
          source_image_path?: string | null;
          updated_at?: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["ocr_field_action"];
          confidence?: number | null;
          created_at?: string;
          detected_value?: string | null;
          field_name?: string;
          final_value?: string | null;
          id?: string;
          scan_id?: string;
          source_image_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ocr_field_detections_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "ocr_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      ocr_scan_sources: {
        Row: {
          created_at: string;
          id: string;
          scan_id: string;
          source_type: Database["public"]["Enums"]["ocr_source_type"];
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          scan_id: string;
          source_type?: Database["public"]["Enums"]["ocr_source_type"];
          storage_path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          scan_id?: string;
          source_type?: Database["public"]["Enums"]["ocr_source_type"];
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ocr_scan_sources_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "ocr_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      ocr_scans: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          raw_result: Json | null;
          status: Database["public"]["Enums"]["ocr_status"];
          updated_at: string;
          uploader_id: string;
          vehicle_opportunity_id: string | null;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          raw_result?: Json | null;
          status?: Database["public"]["Enums"]["ocr_status"];
          updated_at?: string;
          uploader_id: string;
          vehicle_opportunity_id?: string | null;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          raw_result?: Json | null;
          status?: Database["public"]["Enums"]["ocr_status"];
          updated_at?: string;
          uploader_id?: string;
          vehicle_opportunity_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ocr_scans_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_activities: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          done_at: string | null;
          due_at: string | null;
          id: string;
          kind: string;
          updated_at: string;
          vehicle_opportunity_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          done_at?: string | null;
          due_at?: string | null;
          id?: string;
          kind: string;
          updated_at?: string;
          vehicle_opportunity_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          done_at?: string | null;
          due_at?: string | null;
          id?: string;
          kind?: string;
          updated_at?: string;
          vehicle_opportunity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_commissions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          basis: Database["public"]["Enums"]["commission_basis"];
          basis_amount_eur: number;
          computed_amount_eur: number;
          created_at: string;
          id: string;
          notes: string | null;
          paid_at: string | null;
          partenaire_id: string | null;
          rule_id: string | null;
          rule_kind: Database["public"]["Enums"]["commission_rule_kind"];
          rule_value: number;
          status: Database["public"]["Enums"]["commission_status"];
          updated_at: string;
          vehicle_opportunity_id: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          basis: Database["public"]["Enums"]["commission_basis"];
          basis_amount_eur: number;
          computed_amount_eur: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          partenaire_id?: string | null;
          rule_id?: string | null;
          rule_kind: Database["public"]["Enums"]["commission_rule_kind"];
          rule_value: number;
          status?: Database["public"]["Enums"]["commission_status"];
          updated_at?: string;
          vehicle_opportunity_id: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          basis?: Database["public"]["Enums"]["commission_basis"];
          basis_amount_eur?: number;
          computed_amount_eur?: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          partenaire_id?: string | null;
          rule_id?: string | null;
          rule_kind?: Database["public"]["Enums"]["commission_rule_kind"];
          rule_value?: number;
          status?: Database["public"]["Enums"]["commission_status"];
          updated_at?: string;
          vehicle_opportunity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_commissions_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "commission_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunity_commissions_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: true;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_decisions: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          notes: string | null;
          scores: Json;
          total_score: number | null;
          updated_at: string;
          vehicle_opportunity_id: string;
          verdict: string | null;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          notes?: string | null;
          scores?: Json;
          total_score?: number | null;
          updated_at?: string;
          vehicle_opportunity_id: string;
          verdict?: string | null;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          notes?: string | null;
          scores?: Json;
          total_score?: number | null;
          updated_at?: string;
          vehicle_opportunity_id?: string;
          verdict?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_decisions_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: true;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_documents: {
        Row: {
          created_at: string;
          doc_type: string;
          id: string;
          notes: string | null;
          status: string;
          storage_path: string | null;
          updated_at: string;
          vehicle_opportunity_id: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          doc_type: string;
          id?: string;
          notes?: string | null;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
          vehicle_opportunity_id: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          doc_type?: string;
          id?: string;
          notes?: string | null;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
          vehicle_opportunity_id?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_documents_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_status_history: {
        Row: {
          changed_by_user_id: string | null;
          created_at: string;
          id: string;
          message: string | null;
          new_status: Database["public"]["Enums"]["opportunity_status"];
          old_status: Database["public"]["Enums"]["opportunity_status"] | null;
          vehicle_opportunity_id: string;
        };
        Insert: {
          changed_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          new_status: Database["public"]["Enums"]["opportunity_status"];
          old_status?: Database["public"]["Enums"]["opportunity_status"] | null;
          vehicle_opportunity_id: string;
        };
        Update: {
          changed_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          new_status?: Database["public"]["Enums"]["opportunity_status"];
          old_status?: Database["public"]["Enums"]["opportunity_status"] | null;
          vehicle_opportunity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_status_history_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      options_prioritaires: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          city: string | null;
          commission_rate: number | null;
          company_name: string | null;
          country: string | null;
          created_at: string;
          email: string;
          first_name: string;
          id: string;
          is_active: boolean;
          is_external: boolean;
          last_name: string;
          partner_kind: Database["public"]["Enums"]["partner_kind"] | null;
          phone: string | null;
          preferred_locale: string | null;
          provider_type: Database["public"]["Enums"]["provider_type"] | null;
          referral_code: string | null;
          referred_by: string | null;
          staff_scope: Database["public"]["Enums"]["staff_scope"] | null;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          commission_rate?: number | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string;
          first_name?: string;
          id: string;
          is_active?: boolean;
          is_external?: boolean;
          last_name?: string;
          partner_kind?: Database["public"]["Enums"]["partner_kind"] | null;
          phone?: string | null;
          preferred_locale?: string | null;
          provider_type?: Database["public"]["Enums"]["provider_type"] | null;
          referral_code?: string | null;
          referred_by?: string | null;
          staff_scope?: Database["public"]["Enums"]["staff_scope"] | null;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          commission_rate?: number | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string;
          first_name?: string;
          id?: string;
          is_active?: boolean;
          is_external?: boolean;
          last_name?: string;
          partner_kind?: Database["public"]["Enums"]["partner_kind"] | null;
          phone?: string | null;
          preferred_locale?: string | null;
          provider_type?: Database["public"]["Enums"]["provider_type"] | null;
          referral_code?: string | null;
          referred_by?: string | null;
          staff_scope?: Database["public"]["Enums"]["staff_scope"] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_evaluations: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          vehicle_opportunity_id: string | null;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          vehicle_opportunity_id?: string | null;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          vehicle_opportunity_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_evaluations_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_events: {
        Row: {
          bucket: string;
          created_at: string;
          id: number;
          key_hash: string;
        };
        Insert: {
          bucket: string;
          created_at?: string;
          id?: number;
          key_hash: string;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          id?: number;
          key_hash?: string;
        };
        Relationships: [];
      };
      ref_body_types: {
        Row: {
          applies_to: string[];
          is_active: boolean;
          label_en: string | null;
          label_fr: string;
          slug: string;
        };
        Insert: {
          applies_to?: string[];
          is_active?: boolean;
          label_en?: string | null;
          label_fr: string;
          slug: string;
        };
        Update: {
          applies_to?: string[];
          is_active?: boolean;
          label_en?: string | null;
          label_fr?: string;
          slug?: string;
        };
        Relationships: [];
      };
      ref_category_brands: {
        Row: {
          brand_slug: string;
          category_slug: string;
        };
        Insert: {
          brand_slug: string;
          category_slug: string;
        };
        Update: {
          brand_slug?: string;
          category_slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ref_category_brands_brand_slug_fkey";
            columns: ["brand_slug"];
            isOneToOne: false;
            referencedRelation: "ref_vehicle_brands";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "ref_category_brands_category_slug_fkey";
            columns: ["category_slug"];
            isOneToOne: false;
            referencedRelation: "ref_vehicle_categories";
            referencedColumns: ["slug"];
          },
        ];
      };
      ref_countries: {
        Row: {
          code: string;
          created_at: string;
          is_active: boolean;
          name_en: string;
          name_fr: string;
          priority: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          is_active?: boolean;
          name_en: string;
          name_fr: string;
          priority?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          is_active?: boolean;
          name_en?: string;
          name_fr?: string;
          priority?: number;
        };
        Relationships: [];
      };
      ref_equipment: {
        Row: {
          is_active: boolean;
          label_en: string | null;
          label_fr: string;
          slug: string;
        };
        Insert: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr: string;
          slug: string;
        };
        Update: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr?: string;
          slug?: string;
        };
        Relationships: [];
      };
      ref_euro_standards: {
        Row: {
          is_active: boolean;
          label: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          is_active?: boolean;
          label: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          is_active?: boolean;
          label?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      ref_fuel_types: {
        Row: {
          is_active: boolean;
          label_en: string | null;
          label_fr: string;
          slug: string;
        };
        Insert: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr: string;
          slug: string;
        };
        Update: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr?: string;
          slug?: string;
        };
        Relationships: [];
      };
      ref_gearbox_types: {
        Row: {
          is_active: boolean;
          label_en: string | null;
          label_fr: string;
          slug: string;
        };
        Insert: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr: string;
          slug: string;
        };
        Update: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr?: string;
          slug?: string;
        };
        Relationships: [];
      };
      ref_vehicle_brands: {
        Row: {
          is_active: boolean;
          label: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          is_active?: boolean;
          label: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          is_active?: boolean;
          label?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      ref_vehicle_categories: {
        Row: {
          is_active: boolean;
          label_en: string | null;
          label_fr: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      ref_vehicle_models: {
        Row: {
          brand_slug: string;
          id: string;
          is_active: boolean;
          label: string;
        };
        Insert: {
          brand_slug: string;
          id?: string;
          is_active?: boolean;
          label: string;
        };
        Update: {
          brand_slug?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ref_vehicle_models_brand_slug_fkey";
            columns: ["brand_slug"];
            isOneToOne: false;
            referencedRelation: "ref_vehicle_brands";
            referencedColumns: ["slug"];
          },
        ];
      };
      ref_vehicle_types: {
        Row: {
          is_active: boolean;
          label_en: string | null;
          label_fr: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          is_active?: boolean;
          label_en?: string | null;
          label_fr?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      resale_listings: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          vehicle_opportunity_id: string | null;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          vehicle_opportunity_id?: string | null;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          vehicle_opportunity_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "resale_listings_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_listings: {
        Row: {
          assigned_group: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id: string | null;
          assigned_sales_agent_id: string | null;
          availability: Database["public"]["Enums"]["availability_type"] | null;
          city: string | null;
          country: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          notes: string | null;
          photo_ids: string[];
          published_at: string | null;
          purchase_price_snapshot: number | null;
          reference_number: string | null;
          sale_price_excl_tax: number | null;
          sold_at: string | null;
          sold_price_excl_tax: number | null;
          sold_to: string | null;
          status: Database["public"]["Enums"]["sale_listing_status"];
          title: string;
          updated_at: string;
          vat_regime: string | null;
          vehicle_opportunity_id: string;
        };
        Insert: {
          assigned_group?: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id?: string | null;
          assigned_sales_agent_id?: string | null;
          availability?: Database["public"]["Enums"]["availability_type"] | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          notes?: string | null;
          photo_ids?: string[];
          published_at?: string | null;
          purchase_price_snapshot?: number | null;
          reference_number?: string | null;
          sale_price_excl_tax?: number | null;
          sold_at?: string | null;
          sold_price_excl_tax?: number | null;
          sold_to?: string | null;
          status?: Database["public"]["Enums"]["sale_listing_status"];
          title: string;
          updated_at?: string;
          vat_regime?: string | null;
          vehicle_opportunity_id: string;
        };
        Update: {
          assigned_group?: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id?: string | null;
          assigned_sales_agent_id?: string | null;
          availability?: Database["public"]["Enums"]["availability_type"] | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          notes?: string | null;
          photo_ids?: string[];
          published_at?: string | null;
          purchase_price_snapshot?: number | null;
          reference_number?: string | null;
          sale_price_excl_tax?: number | null;
          sold_at?: string | null;
          sold_price_excl_tax?: number | null;
          sold_to?: string | null;
          status?: Database["public"]["Enums"]["sale_listing_status"];
          title?: string;
          updated_at?: string;
          vat_regime?: string | null;
          vehicle_opportunity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sale_listings_assigned_group_id_fkey";
            columns: ["assigned_group_id"];
            isOneToOne: false;
            referencedRelation: "staff_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_listings_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: true;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      site_content: {
        Row: {
          key: string;
          locale: string;
          updated_at: string;
          updated_by: string | null;
          value: string;
        };
        Insert: {
          key: string;
          locale?: string;
          updated_at?: string;
          updated_by?: string | null;
          value: string;
        };
        Update: {
          key?: string;
          locale?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: string;
        };
        Relationships: [];
      };
      staff_group_members: {
        Row: {
          created_at: string;
          group_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "staff_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_groups: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          is_default: boolean;
          is_external: boolean;
          name: string;
          side: Database["public"]["Enums"]["staff_scope"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          is_external?: boolean;
          name: string;
          side?: Database["public"]["Enums"]["staff_scope"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          is_external?: boolean;
          name?: string;
          side?: Database["public"]["Enums"]["staff_scope"];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          locale: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          locale?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          locale?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vehicle_opportunities: {
        Row: {
          additional_comments: string | null;
          assigned_group: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id: string | null;
          assigned_sales_agent_id: string | null;
          availability: Database["public"]["Enums"]["availability_type"] | null;
          axle_configuration: string | null;
          benchmark_comment: string | null;
          body_type: string | null;
          body_type_other: string | null;
          box_depth_mm: number | null;
          box_height_mm: number | null;
          box_width_mm: number | null;
          brand: string | null;
          cabin_type: Database["public"]["Enums"]["cabin_type"] | null;
          city: string | null;
          close_reason: string | null;
          country: string | null;
          crane_details: string | null;
          created_at: string;
          defects_and_comments: string | null;
          delivered_at: string | null;
          delivery_notes: string | null;
          desired_price_excl_tax: number | null;
          embedded_at: string | null;
          embedding: string | null;
          embedding_source_hash: string | null;
          equipment: string[] | null;
          euro_standard: string | null;
          expected_close_date: string | null;
          expected_repairs: string | null;
          final_sale_price_eur: number | null;
          first_registration_date: string | null;
          free_of_commitment: Database["public"]["Enums"]["tri_state"] | null;
          free_of_pledge: string | null;
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null;
          gearbox: Database["public"]["Enums"]["gearbox"] | null;
          general_condition: Database["public"]["Enums"]["general_condition"] | null;
          gross_vehicle_weight: string | null;
          handover_message: string | null;
          has_accident: string | null;
          has_air_conditioning: string | null;
          has_breakdown: string | null;
          has_crane: string | null;
          has_heating: string | null;
          has_hydraulic_hook: string | null;
          has_service_book: string | null;
          id: string;
          inspection_valid_until: string | null;
          key_code: string | null;
          keys_count: number | null;
          known_defects: string | null;
          location_url: string | null;
          lost_at: string | null;
          maintenance_history: string | null;
          maintenance_status: Database["public"]["Enums"]["tri_state"] | null;
          market_price_estimate_eur: number | null;
          market_price_gap_pct: number | null;
          mileage: number | null;
          model: string | null;
          not_running_reason: string | null;
          onsite_contact_email: string | null;
          onsite_contact_name: string | null;
          onsite_contact_phone: string | null;
          other_equipment_details: string | null;
          owner_side: Database["public"]["Enums"]["opportunity_owner_side"];
          partenaire_id: string;
          payload: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          payment_received_at: string | null;
          postal_code: string | null;
          power: string | null;
          price_attractive: string | null;
          price_negotiable: Database["public"]["Enums"]["negotiable_state"] | null;
          purchase_price_excl_tax: number | null;
          purchase_reference: string | null;
          purchased_at: string | null;
          qualified_at: string | null;
          quality_score: Database["public"]["Enums"]["opportunity_quality"] | null;
          reference_number: string | null;
          referral_code: string | null;
          referred_by: string | null;
          registration_number: string | null;
          special_conditions: string | null;
          status: Database["public"]["Enums"]["opportunity_status"];
          submitted_at: string | null;
          suspension_type: string | null;
          tail_lift_comment: string | null;
          tail_lift_condition: string | null;
          tail_lift_homologated: string | null;
          tail_lift_homologation_book: string | null;
          tail_lift_maintenance_book: string | null;
          tail_lift_present: string | null;
          technical_inspection_status: Database["public"]["Enums"]["tri_state"] | null;
          total_contract_value_eur: number | null;
          tyre_size: string | null;
          updated_at: string;
          vat_recoverable: string | null;
          vehicle_category: string | null;
          vehicle_runs: Database["public"]["Enums"]["tri_state"] | null;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null;
          version: string | null;
          vin: string | null;
          visible_on_site: Database["public"]["Enums"]["visibility_state"] | null;
          wheelbase_mm: number | null;
          withdrawn_at: string | null;
          won_at: string | null;
          year: number | null;
        };
        Insert: {
          additional_comments?: string | null;
          assigned_group?: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id?: string | null;
          assigned_sales_agent_id?: string | null;
          availability?: Database["public"]["Enums"]["availability_type"] | null;
          axle_configuration?: string | null;
          benchmark_comment?: string | null;
          body_type?: string | null;
          body_type_other?: string | null;
          box_depth_mm?: number | null;
          box_height_mm?: number | null;
          box_width_mm?: number | null;
          brand?: string | null;
          cabin_type?: Database["public"]["Enums"]["cabin_type"] | null;
          city?: string | null;
          close_reason?: string | null;
          country?: string | null;
          crane_details?: string | null;
          created_at?: string;
          defects_and_comments?: string | null;
          delivered_at?: string | null;
          delivery_notes?: string | null;
          desired_price_excl_tax?: number | null;
          embedded_at?: string | null;
          embedding?: string | null;
          embedding_source_hash?: string | null;
          equipment?: string[] | null;
          euro_standard?: string | null;
          expected_close_date?: string | null;
          expected_repairs?: string | null;
          final_sale_price_eur?: number | null;
          first_registration_date?: string | null;
          free_of_commitment?: Database["public"]["Enums"]["tri_state"] | null;
          free_of_pledge?: string | null;
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null;
          gearbox?: Database["public"]["Enums"]["gearbox"] | null;
          general_condition?: Database["public"]["Enums"]["general_condition"] | null;
          gross_vehicle_weight?: string | null;
          handover_message?: string | null;
          has_accident?: string | null;
          has_air_conditioning?: string | null;
          has_breakdown?: string | null;
          has_crane?: string | null;
          has_heating?: string | null;
          has_hydraulic_hook?: string | null;
          has_service_book?: string | null;
          id?: string;
          inspection_valid_until?: string | null;
          key_code?: string | null;
          keys_count?: number | null;
          known_defects?: string | null;
          location_url?: string | null;
          lost_at?: string | null;
          maintenance_history?: string | null;
          maintenance_status?: Database["public"]["Enums"]["tri_state"] | null;
          market_price_estimate_eur?: number | null;
          market_price_gap_pct?: number | null;
          mileage?: number | null;
          model?: string | null;
          not_running_reason?: string | null;
          onsite_contact_email?: string | null;
          onsite_contact_name?: string | null;
          onsite_contact_phone?: string | null;
          other_equipment_details?: string | null;
          owner_side?: Database["public"]["Enums"]["opportunity_owner_side"];
          partenaire_id: string;
          payload?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          payment_received_at?: string | null;
          postal_code?: string | null;
          power?: string | null;
          price_attractive?: string | null;
          price_negotiable?: Database["public"]["Enums"]["negotiable_state"] | null;
          purchase_price_excl_tax?: number | null;
          purchase_reference?: string | null;
          purchased_at?: string | null;
          qualified_at?: string | null;
          quality_score?: Database["public"]["Enums"]["opportunity_quality"] | null;
          reference_number?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          registration_number?: string | null;
          special_conditions?: string | null;
          status?: Database["public"]["Enums"]["opportunity_status"];
          submitted_at?: string | null;
          suspension_type?: string | null;
          tail_lift_comment?: string | null;
          tail_lift_condition?: string | null;
          tail_lift_homologated?: string | null;
          tail_lift_homologation_book?: string | null;
          tail_lift_maintenance_book?: string | null;
          tail_lift_present?: string | null;
          technical_inspection_status?: Database["public"]["Enums"]["tri_state"] | null;
          total_contract_value_eur?: number | null;
          tyre_size?: string | null;
          updated_at?: string;
          vat_recoverable?: string | null;
          vehicle_category?: string | null;
          vehicle_runs?: Database["public"]["Enums"]["tri_state"] | null;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null;
          version?: string | null;
          vin?: string | null;
          visible_on_site?: Database["public"]["Enums"]["visibility_state"] | null;
          wheelbase_mm?: number | null;
          withdrawn_at?: string | null;
          won_at?: string | null;
          year?: number | null;
        };
        Update: {
          additional_comments?: string | null;
          assigned_group?: Database["public"]["Enums"]["staff_group"] | null;
          assigned_group_id?: string | null;
          assigned_sales_agent_id?: string | null;
          availability?: Database["public"]["Enums"]["availability_type"] | null;
          axle_configuration?: string | null;
          benchmark_comment?: string | null;
          body_type?: string | null;
          body_type_other?: string | null;
          box_depth_mm?: number | null;
          box_height_mm?: number | null;
          box_width_mm?: number | null;
          brand?: string | null;
          cabin_type?: Database["public"]["Enums"]["cabin_type"] | null;
          city?: string | null;
          close_reason?: string | null;
          country?: string | null;
          crane_details?: string | null;
          created_at?: string;
          defects_and_comments?: string | null;
          delivered_at?: string | null;
          delivery_notes?: string | null;
          desired_price_excl_tax?: number | null;
          embedded_at?: string | null;
          embedding?: string | null;
          embedding_source_hash?: string | null;
          equipment?: string[] | null;
          euro_standard?: string | null;
          expected_close_date?: string | null;
          expected_repairs?: string | null;
          final_sale_price_eur?: number | null;
          first_registration_date?: string | null;
          free_of_commitment?: Database["public"]["Enums"]["tri_state"] | null;
          free_of_pledge?: string | null;
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null;
          gearbox?: Database["public"]["Enums"]["gearbox"] | null;
          general_condition?: Database["public"]["Enums"]["general_condition"] | null;
          gross_vehicle_weight?: string | null;
          handover_message?: string | null;
          has_accident?: string | null;
          has_air_conditioning?: string | null;
          has_breakdown?: string | null;
          has_crane?: string | null;
          has_heating?: string | null;
          has_hydraulic_hook?: string | null;
          has_service_book?: string | null;
          id?: string;
          inspection_valid_until?: string | null;
          key_code?: string | null;
          keys_count?: number | null;
          known_defects?: string | null;
          location_url?: string | null;
          lost_at?: string | null;
          maintenance_history?: string | null;
          maintenance_status?: Database["public"]["Enums"]["tri_state"] | null;
          market_price_estimate_eur?: number | null;
          market_price_gap_pct?: number | null;
          mileage?: number | null;
          model?: string | null;
          not_running_reason?: string | null;
          onsite_contact_email?: string | null;
          onsite_contact_name?: string | null;
          onsite_contact_phone?: string | null;
          other_equipment_details?: string | null;
          owner_side?: Database["public"]["Enums"]["opportunity_owner_side"];
          partenaire_id?: string;
          payload?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          payment_received_at?: string | null;
          postal_code?: string | null;
          power?: string | null;
          price_attractive?: string | null;
          price_negotiable?: Database["public"]["Enums"]["negotiable_state"] | null;
          purchase_price_excl_tax?: number | null;
          purchase_reference?: string | null;
          purchased_at?: string | null;
          qualified_at?: string | null;
          quality_score?: Database["public"]["Enums"]["opportunity_quality"] | null;
          reference_number?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          registration_number?: string | null;
          special_conditions?: string | null;
          status?: Database["public"]["Enums"]["opportunity_status"];
          submitted_at?: string | null;
          suspension_type?: string | null;
          tail_lift_comment?: string | null;
          tail_lift_condition?: string | null;
          tail_lift_homologated?: string | null;
          tail_lift_homologation_book?: string | null;
          tail_lift_maintenance_book?: string | null;
          tail_lift_present?: string | null;
          technical_inspection_status?: Database["public"]["Enums"]["tri_state"] | null;
          total_contract_value_eur?: number | null;
          tyre_size?: string | null;
          updated_at?: string;
          vat_recoverable?: string | null;
          vehicle_category?: string | null;
          vehicle_runs?: Database["public"]["Enums"]["tri_state"] | null;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null;
          version?: string | null;
          vin?: string | null;
          visible_on_site?: Database["public"]["Enums"]["visibility_state"] | null;
          wheelbase_mm?: number | null;
          withdrawn_at?: string | null;
          won_at?: string | null;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_opportunities_assigned_group_id_fkey";
            columns: ["assigned_group_id"];
            isOneToOne: false;
            referencedRelation: "staff_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_photos: {
        Row: {
          category: Database["public"]["Enums"]["photo_category"] | null;
          created_at: string;
          id: string;
          is_main_photo: boolean;
          sort_order: number;
          storage_path: string;
          vehicle_opportunity_id: string;
        };
        Insert: {
          category?: Database["public"]["Enums"]["photo_category"] | null;
          created_at?: string;
          id?: string;
          is_main_photo?: boolean;
          sort_order?: number;
          storage_path: string;
          vehicle_opportunity_id: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["photo_category"] | null;
          created_at?: string;
          id?: string;
          is_main_photo?: boolean;
          sort_order?: number;
          storage_path?: string;
          vehicle_opportunity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_vehicle_opportunity_id_fkey";
            columns: ["vehicle_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_handover_to_partner: {
        Args: { p_message: string; p_opportunity_id: string };
        Returns: string;
      };
      admin_request_information: {
        Args: { p_message: string; p_opportunity_id: string };
        Returns: string;
      };
      answer_information_request: {
        Args: { p_request_id: string; p_response?: string };
        Returns: undefined;
      };
      buyer_lead_reference: { Args: { p_id: string }; Returns: string };
      rate_limit_check: {
        Args: {
          _bucket: string;
          _key_hash: string;
          _max_events: number;
          _window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          current_count: number;
          retry_after_seconds: number;
        }[];
      };
      reorder_vehicle_photos: { Args: { p_orders: Json }; Returns: undefined };
      set_main_vehicle_photo: {
        Args: { p_opportunity_id: string; p_photo_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role:
        | "apporteur"
        | "admin"
        | "commercial_future"
        | "client_future"
        | "buyer"
        | "sales_agent"
        | "sales_manager"
        | "company_management"
        | "platform_admin"
        | "partenaire"
        | "external_agent";
      availability_type: "immediate" | "sous_7_jours" | "sous_30_jours" | "a_confirmer";
      buyer_lead_status:
        | "nouveau"
        | "a_qualifier"
        | "match_possible"
        | "en_recherche"
        | "offre_envoyee"
        | "option_posee"
        | "gagne"
        | "perdu"
        | "archive"
        | "converted";
      cabin_type: "courte" | "approfondie" | "double_cabine" | "cabine_couchette" | "autre";
      commission_basis: "purchase" | "sale";
      commission_rule_kind: "pct_of_purchase" | "pct_of_margin" | "flat";
      commission_scope: "all" | "partner" | "country" | "vehicle_type";
      commission_status: "draft" | "approved" | "paid" | "cancelled";
      demand_opportunity_status:
        | "nouvelle"
        | "qualifiee"
        | "en_recherche"
        | "proposition_envoyee"
        | "negociation"
        | "gagnee"
        | "perdue"
        | "archivee";
      demand_stage: "qualification" | "sourcing" | "proposition" | "negociation" | "cloture";
      fuel_type: "diesel" | "essence" | "electrique" | "hybride" | "gnv" | "autre";
      gearbox: "manuelle" | "automatique" | "robotisee";
      general_condition: "tres_bon" | "bon" | "moyen" | "a_reparer" | "accidente";
      info_request_status: "open" | "answered" | "closed";
      match_score: "tres_fort" | "interessant" | "partiel" | "faible";
      match_source_kind: "buyer_lead" | "opportunity" | "resale_listing";
      match_status: "suggested" | "pinned" | "excluded" | "confirmed" | "dismissed";
      negotiable_state: "oui" | "non" | "a_discuter";
      ocr_field_action: "pending" | "confirmed" | "edited" | "rejected";
      ocr_source_type:
        | "vehicle_exterior"
        | "dashboard"
        | "registration"
        | "vin_plate"
        | "manufacturer_plate"
        | "technical_doc"
        | "other";
      ocr_status:
        | "non_commence"
        | "en_cours"
        | "termine"
        | "a_verifier"
        | "confirme"
        | "rejete"
        | "echec";
      opportunity_owner_side: "apporteur" | "wilmet" | "partenaire";
      opportunity_quality: "incomplet" | "correct" | "bon" | "excellent";
      opportunity_status:
        | "brouillon"
        | "envoyee"
        | "en_cours_analyse"
        | "informations_demandees"
        | "acceptee"
        | "refusee"
        | "archivee"
        | "achetee"
        | "offre_envoyee"
        | "en_negociation"
        | "paiement_en_attente"
        | "paiement_recu"
        | "livraison_planifiee"
        | "livree"
        | "closed_won"
        | "closed_lost"
        | "qualifiee";
      partner_kind: "client" | "seller";
      payment_method: "virement" | "cheque" | "paycifi" | "autre";
      photo_category:
        | "vue_avant"
        | "vue_arriere"
        | "cote_gauche"
        | "cote_droit"
        | "interieur_cabine"
        | "tableau_de_bord"
        | "pneus"
        | "moteur"
        | "coffre"
        | "plaque_vin"
        | "defauts"
        | "documents"
        | "tableau_de_bord_moteur";
      provider_type:
        | "garage"
        | "transporteur"
        | "loueur"
        | "concessionnaire"
        | "courtier"
        | "particulier_professionnel"
        | "autre";
      sale_listing_status: "brouillon" | "publiee" | "reservee" | "vendue" | "retiree";
      staff_group: "purchase" | "sales";
      staff_scope: "purchase" | "sales" | "both";
      tri_state: "oui" | "non" | "a_verifier" | "non_applicable" | "partiellement";
      vehicle_type:
        | "utilitaire"
        | "camion_porteur"
        | "tracteur_routier"
        | "semi_remorque"
        | "remorque"
        | "benne"
        | "frigorifique"
        | "plateau"
        | "fourgon"
        | "autre";
      visibility_state: "oui" | "non" | "sur_rendez_vous";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "apporteur",
        "admin",
        "commercial_future",
        "client_future",
        "buyer",
        "sales_agent",
        "sales_manager",
        "company_management",
        "platform_admin",
        "partenaire",
        "external_agent",
      ],
      availability_type: ["immediate", "sous_7_jours", "sous_30_jours", "a_confirmer"],
      buyer_lead_status: [
        "nouveau",
        "a_qualifier",
        "match_possible",
        "en_recherche",
        "offre_envoyee",
        "option_posee",
        "gagne",
        "perdu",
        "archive",
        "converted",
      ],
      cabin_type: ["courte", "approfondie", "double_cabine", "cabine_couchette", "autre"],
      commission_basis: ["purchase", "sale"],
      commission_rule_kind: ["pct_of_purchase", "pct_of_margin", "flat"],
      commission_scope: ["all", "partner", "country", "vehicle_type"],
      commission_status: ["draft", "approved", "paid", "cancelled"],
      demand_opportunity_status: [
        "nouvelle",
        "qualifiee",
        "en_recherche",
        "proposition_envoyee",
        "negociation",
        "gagnee",
        "perdue",
        "archivee",
      ],
      demand_stage: ["qualification", "sourcing", "proposition", "negociation", "cloture"],
      fuel_type: ["diesel", "essence", "electrique", "hybride", "gnv", "autre"],
      gearbox: ["manuelle", "automatique", "robotisee"],
      general_condition: ["tres_bon", "bon", "moyen", "a_reparer", "accidente"],
      info_request_status: ["open", "answered", "closed"],
      match_score: ["tres_fort", "interessant", "partiel", "faible"],
      match_source_kind: ["buyer_lead", "opportunity", "resale_listing"],
      match_status: ["suggested", "pinned", "excluded", "confirmed", "dismissed"],
      negotiable_state: ["oui", "non", "a_discuter"],
      ocr_field_action: ["pending", "confirmed", "edited", "rejected"],
      ocr_source_type: [
        "vehicle_exterior",
        "dashboard",
        "registration",
        "vin_plate",
        "manufacturer_plate",
        "technical_doc",
        "other",
      ],
      ocr_status: [
        "non_commence",
        "en_cours",
        "termine",
        "a_verifier",
        "confirme",
        "rejete",
        "echec",
      ],
      opportunity_owner_side: ["apporteur", "wilmet", "partenaire"],
      opportunity_quality: ["incomplet", "correct", "bon", "excellent"],
      opportunity_status: [
        "brouillon",
        "envoyee",
        "en_cours_analyse",
        "informations_demandees",
        "acceptee",
        "refusee",
        "archivee",
        "achetee",
        "offre_envoyee",
        "en_negociation",
        "paiement_en_attente",
        "paiement_recu",
        "livraison_planifiee",
        "livree",
        "closed_won",
        "closed_lost",
        "qualifiee",
      ],
      partner_kind: ["client", "seller"],
      payment_method: ["virement", "cheque", "paycifi", "autre"],
      photo_category: [
        "vue_avant",
        "vue_arriere",
        "cote_gauche",
        "cote_droit",
        "interieur_cabine",
        "tableau_de_bord",
        "pneus",
        "moteur",
        "coffre",
        "plaque_vin",
        "defauts",
        "documents",
        "tableau_de_bord_moteur",
      ],
      provider_type: [
        "garage",
        "transporteur",
        "loueur",
        "concessionnaire",
        "courtier",
        "particulier_professionnel",
        "autre",
      ],
      sale_listing_status: ["brouillon", "publiee", "reservee", "vendue", "retiree"],
      staff_group: ["purchase", "sales"],
      staff_scope: ["purchase", "sales", "both"],
      tri_state: ["oui", "non", "a_verifier", "non_applicable", "partiellement"],
      vehicle_type: [
        "utilitaire",
        "camion_porteur",
        "tracteur_routier",
        "semi_remorque",
        "remorque",
        "benne",
        "frigorifique",
        "plateau",
        "fourgon",
        "autre",
      ],
      visibility_state: ["oui", "non", "sur_rendez_vous"],
    },
  },
} as const;
