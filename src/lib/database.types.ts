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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_scores: {
        Row: {
          access_type: string
          created_at: string
          id: string
          notes: string | null
          surcharge: number | null
        }
        Insert: {
          access_type: string
          created_at?: string
          id?: string
          notes?: string | null
          surcharge?: number | null
        }
        Update: {
          access_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          surcharge?: number | null
        }
        Relationships: []
      }
      addons: {
        Row: {
          active: boolean | null
          applicable_service_types: string[]
          created_at: string | null
          description: string | null
          display_order: number | null
          excluded_tiers: string[] | null
          id: string
          is_popular: boolean | null
          name: string
          percent_value: number | null
          price: number
          price_type: string
          show_on_admin_form: boolean | null
          show_on_quote_page: boolean | null
          slug: string
          tiers: Json | null
          unit_label: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          applicable_service_types: string[]
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          excluded_tiers?: string[] | null
          id?: string
          is_popular?: boolean | null
          name: string
          percent_value?: number | null
          price: number
          price_type: string
          show_on_admin_form?: boolean | null
          show_on_quote_page?: boolean | null
          slug: string
          tiers?: Json | null
          unit_label?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          applicable_service_types?: string[]
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          excluded_tiers?: string[] | null
          id?: string
          is_popular?: boolean | null
          name?: string
          percent_value?: number | null
          price?: number
          price_type?: string
          show_on_admin_form?: boolean | null
          show_on_quote_page?: boolean | null
          slug?: string
          tiers?: Json | null
          unit_label?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      address_intelligence: {
        Row: {
          address: string
          avg_hours_variance: number | null
          avg_loading_time_minutes: number | null
          avg_unloading_time_minutes: number | null
          building_name: string | null
          building_notes: string | null
          created_at: string
          elevator_count: number | null
          has_loading_dock: boolean | null
          id: string
          last_updated: string | null
          move_count: number | null
          move_elevator_available: boolean | null
          parking_difficulty: string | null
          postal_code: string | null
        }
        Insert: {
          address: string
          avg_hours_variance?: number | null
          avg_loading_time_minutes?: number | null
          avg_unloading_time_minutes?: number | null
          building_name?: string | null
          building_notes?: string | null
          created_at?: string
          elevator_count?: number | null
          has_loading_dock?: boolean | null
          id?: string
          last_updated?: string | null
          move_count?: number | null
          move_elevator_available?: boolean | null
          parking_difficulty?: string | null
          postal_code?: string | null
        }
        Update: {
          address?: string
          avg_hours_variance?: number | null
          avg_loading_time_minutes?: number | null
          avg_unloading_time_minutes?: number | null
          building_name?: string | null
          building_notes?: string | null
          created_at?: string
          elevator_count?: number | null
          has_loading_dock?: boolean | null
          id?: string
          last_updated?: string | null
          move_count?: number | null
          move_elevator_available?: boolean | null
          parking_difficulty?: string | null
          postal_code?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          icon: string | null
          id: string
          link: string | null
          read: boolean | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_analysis_log: {
        Row: {
          analyzed_by: string | null
          created_at: string
          id: string
          photo_count: number | null
          suggestion_count: number | null
          suggestions: Json | null
          survey_id: string
        }
        Insert: {
          analyzed_by?: string | null
          created_at?: string
          id?: string
          photo_count?: number | null
          suggestion_count?: number | null
          suggestions?: Json | null
          survey_id: string
        }
        Update: {
          analyzed_by?: string | null
          created_at?: string
          id?: string
          photo_count?: number | null
          suggestion_count?: number | null
          suggestions?: Json | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_log_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "photo_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      base_rates: {
        Row: {
          base_price: number
          created_at: string
          estimated_hours: number | null
          id: string
          min_crew: number | null
          move_size: string
          updated_at: string | null
        }
        Insert: {
          base_price: number
          created_at?: string
          estimated_hours?: number | null
          id?: string
          min_crew?: number | null
          move_size: string
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string
          estimated_hours?: number | null
          id?: string
          min_crew?: number | null
          move_size?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bin_orders: {
        Row: {
          bin_count: number
          bins_missing: number | null
          bins_returned: number | null
          bundle_price: number
          bundle_type: string
          client_email: string
          client_name: string
          client_phone: string
          created_at: string | null
          delivery_access: string | null
          delivery_address: string
          delivery_notes: string | null
          delivery_postal: string | null
          delivery_surcharge: number | null
          drop_off_completed_at: string | null
          drop_off_crew: string | null
          drop_off_date: string
          drop_off_photos: Json | null
          hst: number
          id: string
          includes_paper: boolean | null
          includes_zip_ties: boolean | null
          late_return_fees: number | null
          missing_bin_charge: number | null
          move_date: string
          move_id: string | null
          order_number: string
          overdue_days: number | null
          overdue_last_charged_at: string | null
          overdue_notified_day1: boolean | null
          overdue_notified_day2: boolean | null
          paid_total_cents: number | null
          payment_status: string | null
          pickup_address: string | null
          pickup_completed_at: string | null
          pickup_condition: string | null
          pickup_crew: string | null
          pickup_date: string
          pickup_photos: Json | null
          source: string | null
          square_card_id: string | null
          square_customer_id: string | null
          square_payment_id: string | null
          status: string | null
          subtotal: number
          total: number
          updated_at: string | null
          wardrobe_boxes_provided: number | null
          wardrobe_boxes_returned: number | null
        }
        Insert: {
          bin_count: number
          bins_missing?: number | null
          bins_returned?: number | null
          bundle_price: number
          bundle_type: string
          client_email: string
          client_name: string
          client_phone: string
          created_at?: string | null
          delivery_access?: string | null
          delivery_address: string
          delivery_notes?: string | null
          delivery_postal?: string | null
          delivery_surcharge?: number | null
          drop_off_completed_at?: string | null
          drop_off_crew?: string | null
          drop_off_date: string
          drop_off_photos?: Json | null
          hst: number
          id?: string
          includes_paper?: boolean | null
          includes_zip_ties?: boolean | null
          late_return_fees?: number | null
          missing_bin_charge?: number | null
          move_date: string
          move_id?: string | null
          order_number: string
          overdue_days?: number | null
          overdue_last_charged_at?: string | null
          overdue_notified_day1?: boolean | null
          overdue_notified_day2?: boolean | null
          paid_total_cents?: number | null
          payment_status?: string | null
          pickup_address?: string | null
          pickup_completed_at?: string | null
          pickup_condition?: string | null
          pickup_crew?: string | null
          pickup_date: string
          pickup_photos?: Json | null
          source?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_payment_id?: string | null
          status?: string | null
          subtotal: number
          total: number
          updated_at?: string | null
          wardrobe_boxes_provided?: number | null
          wardrobe_boxes_returned?: number | null
        }
        Update: {
          bin_count?: number
          bins_missing?: number | null
          bins_returned?: number | null
          bundle_price?: number
          bundle_type?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string | null
          delivery_access?: string | null
          delivery_address?: string
          delivery_notes?: string | null
          delivery_postal?: string | null
          delivery_surcharge?: number | null
          drop_off_completed_at?: string | null
          drop_off_crew?: string | null
          drop_off_date?: string
          drop_off_photos?: Json | null
          hst?: number
          id?: string
          includes_paper?: boolean | null
          includes_zip_ties?: boolean | null
          late_return_fees?: number | null
          missing_bin_charge?: number | null
          move_date?: string
          move_id?: string | null
          order_number?: string
          overdue_days?: number | null
          overdue_last_charged_at?: string | null
          overdue_notified_day1?: boolean | null
          overdue_notified_day2?: boolean | null
          paid_total_cents?: number | null
          payment_status?: string | null
          pickup_address?: string | null
          pickup_completed_at?: string | null
          pickup_condition?: string | null
          pickup_crew?: string | null
          pickup_date?: string
          pickup_photos?: Json | null
          source?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_payment_id?: string | null
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string | null
          wardrobe_boxes_provided?: number | null
          wardrobe_boxes_returned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bin_orders_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      building_profiles: {
        Row: {
          access_archetype: string | null
          address: string
          building_name: string | null
          building_type: string
          carry_band: string | null
          coi_deposit: number | null
          coi_required: boolean | null
          commercial_floors: string | null
          commercial_tenants: string[] | null
          complexity_rating: number
          coordinator_notes: string | null
          created_at: string
          crew_notes: string | null
          doorway_dimensions: string | null
          elevator_booking_required: boolean
          elevator_max_hours: number | null
          elevator_shared: boolean
          elevator_system: string
          elevator_type: string | null
          elevator_window_minutes: number | null
          entrance_steps_band: string | null
          estimated_extra_minutes_per_trip: number
          freight_elevator: boolean
          freight_elevator_dimensions: string | null
          freight_elevator_location: string | null
          hallway_width: string | null
          has_commercial_tenants: boolean
          id: string
          interior_levels: number | null
          last_move_date: string | null
          latitude: number | null
          loading_dock: boolean
          loading_dock_booking_required: boolean
          loading_dock_location: string | null
          loading_dock_restrictions: string | null
          lobby_walk_band: string | null
          longitude: number | null
          management_company: string | null
          max_item_length: string | null
          move_hours: string | null
          one_move_per_day: boolean | null
          parking_notes: string | null
          parking_type: string | null
          photo_urls: string[] | null
          postal_code: string | null
          residential_elevator_location: string | null
          residential_floors: string | null
          source: string | null
          stair_flights: number | null
          stair_type: string | null
          stair_width_band: string | null
          staircase_type: string | null
          times_moved_here: number
          total_elevator_transfers: number
          total_floors: number | null
          total_units: number | null
          transfer_floors: string[] | null
          truck_spot: string | null
          two_stage_transfer: boolean | null
          unit_floor: number | null
          updated_at: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          access_archetype?: string | null
          address: string
          building_name?: string | null
          building_type?: string
          carry_band?: string | null
          coi_deposit?: number | null
          coi_required?: boolean | null
          commercial_floors?: string | null
          commercial_tenants?: string[] | null
          complexity_rating?: number
          coordinator_notes?: string | null
          created_at?: string
          crew_notes?: string | null
          doorway_dimensions?: string | null
          elevator_booking_required?: boolean
          elevator_max_hours?: number | null
          elevator_shared?: boolean
          elevator_system?: string
          elevator_type?: string | null
          elevator_window_minutes?: number | null
          entrance_steps_band?: string | null
          estimated_extra_minutes_per_trip?: number
          freight_elevator?: boolean
          freight_elevator_dimensions?: string | null
          freight_elevator_location?: string | null
          hallway_width?: string | null
          has_commercial_tenants?: boolean
          id?: string
          interior_levels?: number | null
          last_move_date?: string | null
          latitude?: number | null
          loading_dock?: boolean
          loading_dock_booking_required?: boolean
          loading_dock_location?: string | null
          loading_dock_restrictions?: string | null
          lobby_walk_band?: string | null
          longitude?: number | null
          management_company?: string | null
          max_item_length?: string | null
          move_hours?: string | null
          one_move_per_day?: boolean | null
          parking_notes?: string | null
          parking_type?: string | null
          photo_urls?: string[] | null
          postal_code?: string | null
          residential_elevator_location?: string | null
          residential_floors?: string | null
          source?: string | null
          stair_flights?: number | null
          stair_type?: string | null
          stair_width_band?: string | null
          staircase_type?: string | null
          times_moved_here?: number
          total_elevator_transfers?: number
          total_floors?: number | null
          total_units?: number | null
          transfer_floors?: string[] | null
          truck_spot?: string | null
          two_stage_transfer?: boolean | null
          unit_floor?: number | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          access_archetype?: string | null
          address?: string
          building_name?: string | null
          building_type?: string
          carry_band?: string | null
          coi_deposit?: number | null
          coi_required?: boolean | null
          commercial_floors?: string | null
          commercial_tenants?: string[] | null
          complexity_rating?: number
          coordinator_notes?: string | null
          created_at?: string
          crew_notes?: string | null
          doorway_dimensions?: string | null
          elevator_booking_required?: boolean
          elevator_max_hours?: number | null
          elevator_shared?: boolean
          elevator_system?: string
          elevator_type?: string | null
          elevator_window_minutes?: number | null
          entrance_steps_band?: string | null
          estimated_extra_minutes_per_trip?: number
          freight_elevator?: boolean
          freight_elevator_dimensions?: string | null
          freight_elevator_location?: string | null
          hallway_width?: string | null
          has_commercial_tenants?: boolean
          id?: string
          interior_levels?: number | null
          last_move_date?: string | null
          latitude?: number | null
          loading_dock?: boolean
          loading_dock_booking_required?: boolean
          loading_dock_location?: string | null
          loading_dock_restrictions?: string | null
          lobby_walk_band?: string | null
          longitude?: number | null
          management_company?: string | null
          max_item_length?: string | null
          move_hours?: string | null
          one_move_per_day?: boolean | null
          parking_notes?: string | null
          parking_type?: string | null
          photo_urls?: string[] | null
          postal_code?: string | null
          residential_elevator_location?: string | null
          residential_floors?: string | null
          source?: string | null
          stair_flights?: number | null
          stair_type?: string | null
          stair_width_band?: string | null
          staircase_type?: string | null
          times_moved_here?: number
          total_elevator_transfers?: number
          total_floors?: number | null
          total_units?: number | null
          transfer_floors?: string[] | null
          truck_spot?: string | null
          two_stage_transfer?: boolean | null
          unit_floor?: number | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      calibration_data: {
        Row: {
          actual_crew: number | null
          actual_hours: number | null
          actual_score: number | null
          actual_start_time: string | null
          actual_truck: string | null
          arrival_window: string | null
          cost: number | null
          created_at: string | null
          crew_lead_id: string | null
          crew_member_ids: string[] | null
          crew_variance: number | null
          damage_reported: boolean | null
          day_of_week: string | null
          delivery_id: string | null
          distance_km: number | null
          estimated_hours: number | null
          from_building: string | null
          from_postal: string | null
          handling_type: string | null
          hours_variance: number | null
          id: string
          inventory_variance: number | null
          margin_percent: number | null
          month: number | null
          move_id: string | null
          move_size: string | null
          quoted_score: number | null
          recommended_crew: number | null
          recommended_truck: string | null
          revenue: number | null
          satisfaction_rating: number | null
          service_type: string | null
          tier: string | null
          to_building: string | null
          to_postal: string | null
          truck_match: boolean | null
          vertical_code: string | null
        }
        Insert: {
          actual_crew?: number | null
          actual_hours?: number | null
          actual_score?: number | null
          actual_start_time?: string | null
          actual_truck?: string | null
          arrival_window?: string | null
          cost?: number | null
          created_at?: string | null
          crew_lead_id?: string | null
          crew_member_ids?: string[] | null
          crew_variance?: number | null
          damage_reported?: boolean | null
          day_of_week?: string | null
          delivery_id?: string | null
          distance_km?: number | null
          estimated_hours?: number | null
          from_building?: string | null
          from_postal?: string | null
          handling_type?: string | null
          hours_variance?: number | null
          id?: string
          inventory_variance?: number | null
          margin_percent?: number | null
          month?: number | null
          move_id?: string | null
          move_size?: string | null
          quoted_score?: number | null
          recommended_crew?: number | null
          recommended_truck?: string | null
          revenue?: number | null
          satisfaction_rating?: number | null
          service_type?: string | null
          tier?: string | null
          to_building?: string | null
          to_postal?: string | null
          truck_match?: boolean | null
          vertical_code?: string | null
        }
        Update: {
          actual_crew?: number | null
          actual_hours?: number | null
          actual_score?: number | null
          actual_start_time?: string | null
          actual_truck?: string | null
          arrival_window?: string | null
          cost?: number | null
          created_at?: string | null
          crew_lead_id?: string | null
          crew_member_ids?: string[] | null
          crew_variance?: number | null
          damage_reported?: boolean | null
          day_of_week?: string | null
          delivery_id?: string | null
          distance_km?: number | null
          estimated_hours?: number | null
          from_building?: string | null
          from_postal?: string | null
          handling_type?: string | null
          hours_variance?: number | null
          id?: string
          inventory_variance?: number | null
          margin_percent?: number | null
          month?: number | null
          move_id?: string | null
          move_size?: string | null
          quoted_score?: number | null
          recommended_crew?: number | null
          recommended_truck?: string | null
          revenue?: number | null
          satisfaction_rating?: number | null
          service_type?: string | null
          tier?: string | null
          to_building?: string | null
          to_postal?: string | null
          truck_match?: boolean | null
          vertical_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calibration_data_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_data_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_suggestions: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          confidence: string | null
          created_at: string | null
          current_value: string | null
          dismissed_reason: string | null
          id: string
          move_size: string | null
          reason: string | null
          sample_size: number | null
          service_type: string | null
          status: string | null
          suggested_value: string | null
          type: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          confidence?: string | null
          created_at?: string | null
          current_value?: string | null
          dismissed_reason?: string | null
          id?: string
          move_size?: string | null
          reason?: string | null
          sample_size?: number | null
          service_type?: string | null
          status?: string | null
          suggested_value?: string | null
          type: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          confidence?: string | null
          created_at?: string | null
          current_value?: string | null
          dismissed_reason?: string | null
          id?: string
          move_size?: string | null
          reason?: string | null
          sample_size?: number | null
          service_type?: string | null
          status?: string | null
          suggested_value?: string | null
          type?: string
        }
        Relationships: []
      }
      change_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          description: string
          id: string
          move_id: string
          status: string
          type: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          description: string
          id?: string
          move_id: string
          status?: string
          type: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          description?: string
          id?: string
          move_id?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      claim_photos: {
        Row: {
          caption: string | null
          claim_id: string
          created_at: string | null
          id: string
          photo_type: string | null
          photo_url: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          claim_id: string
          created_at?: string | null
          id?: string
          photo_type?: string | null
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          claim_id?: string
          created_at?: string | null
          id?: string
          photo_type?: string | null
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_photos_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_timeline: {
        Row: {
          claim_id: string
          created_at: string | null
          event_description: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          event_description: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          event_description?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_timeline_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          approved_amount: number | null
          assessed_at: string | null
          assessed_by: string | null
          assessment_notes: string | null
          claim_number: string
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string | null
          crew_members: string[] | null
          crew_notified: boolean | null
          crew_team: string | null
          delivery_id: string | null
          id: string
          items: Json
          move_id: string | null
          payout_date: string | null
          payout_method: string | null
          payout_reference: string | null
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          status: string
          submitted_at: string | null
          total_claimed_value: number
          updated_at: string | null
          valuation_tier: string
          was_upgraded: boolean | null
        }
        Insert: {
          approved_amount?: number | null
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_notes?: string | null
          claim_number: string
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string | null
          crew_members?: string[] | null
          crew_notified?: boolean | null
          crew_team?: string | null
          delivery_id?: string | null
          id?: string
          items?: Json
          move_id?: string | null
          payout_date?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          status?: string
          submitted_at?: string | null
          total_claimed_value?: number
          updated_at?: string | null
          valuation_tier: string
          was_upgraded?: boolean | null
        }
        Update: {
          approved_amount?: number | null
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_notes?: string | null
          claim_number?: string
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string | null
          crew_members?: string[] | null
          crew_notified?: boolean | null
          crew_team?: string | null
          delivery_id?: string | null
          id?: string
          items?: Json
          move_id?: string | null
          payout_date?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          status?: string
          submitted_at?: string | null
          total_claimed_value?: number
          updated_at?: string | null
          valuation_tier?: string
          was_upgraded?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          created_at: string
          id: string
          move_id: string | null
          organization_id: string | null
          storage_path: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          move_id?: string | null
          organization_id?: string | null
          storage_path?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          move_id?: string | null
          organization_id?: string | null
          storage_path?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_referrals: {
        Row: {
          created_at: string | null
          credited_at: string | null
          expires_at: string | null
          id: string
          referral_code: string
          referred_discount: number | null
          referred_email: string | null
          referred_move_id: string | null
          referred_name: string | null
          referrer_credit: number | null
          referrer_email: string
          referrer_move_id: string | null
          referrer_name: string
          referrer_phone: string | null
          status: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          credited_at?: string | null
          expires_at?: string | null
          id?: string
          referral_code: string
          referred_discount?: number | null
          referred_email?: string | null
          referred_move_id?: string | null
          referred_name?: string | null
          referrer_credit?: number | null
          referrer_email: string
          referrer_move_id?: string | null
          referrer_name: string
          referrer_phone?: string | null
          status?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          credited_at?: string | null
          expires_at?: string | null
          id?: string
          referral_code?: string
          referred_discount?: number | null
          referred_email?: string | null
          referred_move_id?: string | null
          referred_name?: string | null
          referrer_credit?: number | null
          referrer_email?: string
          referrer_move_id?: string | null
          referrer_name?: string
          referrer_phone?: string | null
          status?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_referrals_referred_move_id_fkey"
            columns: ["referred_move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_referrals_referrer_move_id_fkey"
            columns: ["referrer_move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sign_offs: {
        Row: {
          all_items_received: boolean
          claims_process_explained: boolean | null
          client_present_during_unloading: boolean | null
          condition_accepted: boolean
          created_at: string | null
          crew_conducted_professionally: boolean | null
          crew_wore_protection: boolean | null
          damage_report_deadline: string | null
          discrepancy_flags: Json | null
          escalation_reason: string | null
          escalation_triggered: boolean | null
          exceptions: string | null
          feedback_note: string | null
          furniture_reassembled: boolean | null
          id: string
          item_conditions: Json | null
          items_placed_correctly: boolean | null
          job_id: string
          job_type: string
          no_damages: boolean | null
          no_issues_during_move: boolean | null
          no_property_damage: boolean | null
          nps_score: number | null
          pdf_url: string | null
          photos_reviewed_by_client: boolean | null
          pre_existing_conditions_noted: boolean | null
          property_left_clean: boolean | null
          satisfaction_rating: number | null
          signature_data_url: string
          signed_at: string | null
          signed_by: string
          signed_lat: number | null
          signed_lng: number | null
          walkthrough_completed: boolean | null
          walkthrough_conducted_by_client: boolean | null
          would_recommend: boolean | null
        }
        Insert: {
          all_items_received?: boolean
          claims_process_explained?: boolean | null
          client_present_during_unloading?: boolean | null
          condition_accepted?: boolean
          created_at?: string | null
          crew_conducted_professionally?: boolean | null
          crew_wore_protection?: boolean | null
          damage_report_deadline?: string | null
          discrepancy_flags?: Json | null
          escalation_reason?: string | null
          escalation_triggered?: boolean | null
          exceptions?: string | null
          feedback_note?: string | null
          furniture_reassembled?: boolean | null
          id?: string
          item_conditions?: Json | null
          items_placed_correctly?: boolean | null
          job_id: string
          job_type: string
          no_damages?: boolean | null
          no_issues_during_move?: boolean | null
          no_property_damage?: boolean | null
          nps_score?: number | null
          pdf_url?: string | null
          photos_reviewed_by_client?: boolean | null
          pre_existing_conditions_noted?: boolean | null
          property_left_clean?: boolean | null
          satisfaction_rating?: number | null
          signature_data_url: string
          signed_at?: string | null
          signed_by: string
          signed_lat?: number | null
          signed_lng?: number | null
          walkthrough_completed?: boolean | null
          walkthrough_conducted_by_client?: boolean | null
          would_recommend?: boolean | null
        }
        Update: {
          all_items_received?: boolean
          claims_process_explained?: boolean | null
          client_present_during_unloading?: boolean | null
          condition_accepted?: boolean
          created_at?: string | null
          crew_conducted_professionally?: boolean | null
          crew_wore_protection?: boolean | null
          damage_report_deadline?: string | null
          discrepancy_flags?: Json | null
          escalation_reason?: string | null
          escalation_triggered?: boolean | null
          exceptions?: string | null
          feedback_note?: string | null
          furniture_reassembled?: boolean | null
          id?: string
          item_conditions?: Json | null
          items_placed_correctly?: boolean | null
          job_id?: string
          job_type?: string
          no_damages?: boolean | null
          no_issues_during_move?: boolean | null
          no_property_damage?: boolean | null
          nps_score?: number | null
          pdf_url?: string | null
          photos_reviewed_by_client?: boolean | null
          pre_existing_conditions_noted?: boolean | null
          property_left_clean?: boolean | null
          satisfaction_rating?: number | null
          signature_data_url?: string
          signed_at?: string | null
          signed_by?: string
          signed_lat?: number | null
          signed_lng?: number | null
          walkthrough_completed?: boolean | null
          walkthrough_conducted_by_client?: boolean | null
          would_recommend?: boolean | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string | null
          email: string | null
          hubspot_contact_id: string | null
          id: string
          lead_source: string | null
          lifetime_value: number | null
          name: string
          neighbourhood: string | null
          phone: string | null
          postal_code: string | null
          referral_count: number | null
          square_card_id: string | null
          square_customer_id: string | null
          updated_at: string | null
          vip_status: boolean | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          hubspot_contact_id?: string | null
          id?: string
          lead_source?: string | null
          lifetime_value?: number | null
          name: string
          neighbourhood?: string | null
          phone?: string | null
          postal_code?: string | null
          referral_count?: number | null
          square_card_id?: string | null
          square_customer_id?: string | null
          updated_at?: string | null
          vip_status?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          hubspot_contact_id?: string | null
          id?: string
          lead_source?: string | null
          lifetime_value?: number | null
          name?: string
          neighbourhood?: string | null
          phone?: string | null
          postal_code?: string | null
          referral_count?: number | null
          square_card_id?: string | null
          square_customer_id?: string | null
          updated_at?: string | null
          vip_status?: boolean | null
        }
        Relationships: []
      }
      crew_expenses: {
        Row: {
          amount_cents: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string | null
          description: string
          id: string
          job_id: string | null
          receipt_storage_path: string | null
          status: Database["public"]["Enums"]["expense_status"]
          submitted_at: string | null
          submitted_by: string
          team_id: string
        }
        Insert: {
          amount_cents: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string | null
          description: string
          id?: string
          job_id?: string | null
          receipt_storage_path?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          submitted_by: string
          team_id: string
        }
        Update: {
          amount_cents?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string | null
          description?: string
          id?: string
          job_id?: string | null
          receipt_storage_path?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          submitted_by?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_expenses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_expenses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_location_history: {
        Row: {
          created_at: string
          crew_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          move_id: string | null
          recorded_at: string | null
          speed: number | null
        }
        Insert: {
          created_at?: string
          crew_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          move_id?: string | null
          recorded_at?: string | null
          speed?: number | null
        }
        Update: {
          created_at?: string
          crew_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          move_id?: string | null
          recorded_at?: string | null
          speed?: number | null
        }
        Relationships: []
      }
      crew_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          crew_id: string
          crew_name: string | null
          current_client_name: string | null
          current_from_address: string | null
          current_move_id: string | null
          current_to_address: string | null
          heading: number | null
          id: string
          is_navigating: boolean | null
          lat: number
          lng: number
          nav_distance_remaining_m: number | null
          nav_eta_seconds: number | null
          speed: number | null
          status: string | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          crew_id: string
          crew_name?: string | null
          current_client_name?: string | null
          current_from_address?: string | null
          current_move_id?: string | null
          current_to_address?: string | null
          heading?: number | null
          id?: string
          is_navigating?: boolean | null
          lat: number
          lng: number
          nav_distance_remaining_m?: number | null
          nav_eta_seconds?: number | null
          speed?: number | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          crew_id?: string
          crew_name?: string | null
          current_client_name?: string | null
          current_from_address?: string | null
          current_move_id?: string | null
          current_to_address?: string | null
          heading?: number | null
          id?: string
          is_navigating?: boolean | null
          lat?: number
          lng?: number
          nav_distance_remaining_m?: number | null
          nav_eta_seconds?: number | null
          speed?: number | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_locations_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_lockout_attempts: {
        Row: {
          created_at: string | null
          failed_attempts: number
          id: string
          key: string
          locked_until: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          failed_attempts?: number
          id?: string
          key: string
          locked_until?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          failed_attempts?: number
          id?: string
          key?: string
          locked_until?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crew_members: {
        Row: {
          avatar_initials: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string
          pin_hash: string
          pin_length: number | null
          role: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          avatar_initials?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone: string
          pin_hash: string
          pin_length?: number | null
          role: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          avatar_initials?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          pin_hash?: string
          pin_length?: number | null
          role?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_profile_job_completion: {
        Row: {
          job_id: string
          job_type: string
          processed_at: string
        }
        Insert: {
          job_id: string
          job_type: string
          processed_at?: string
        }
        Update: {
          job_id?: string
          job_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      crew_profile_tip_applied: {
        Row: {
          processed_at: string
          tip_id: string
        }
        Insert: {
          processed_at?: string
          tip_id: string
        }
        Update: {
          processed_at?: string
          tip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_profile_tip_applied_tip_id_fkey"
            columns: ["tip_id"]
            isOneToOne: true
            referencedRelation: "tips"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_profiles: {
        Row: {
          art_damage: number | null
          art_jobs: number | null
          avg_hours_vs_estimate: number | null
          avg_satisfaction: number | null
          avg_tip_per_job: number | null
          badges: Json | null
          can_drive_26ft: boolean | null
          can_handle_piano: boolean | null
          consecutive_5stars: number | null
          created_at: string
          damage_incidents: number | null
          damage_rate: number | null
          highest_tip: number | null
          id: string
          last_updated: string | null
          max_floor_walkup: number | null
          monthly_jobs: Json | null
          monthly_ratings: Json | null
          monthly_tips: Json | null
          name: string | null
          on_time_rate: number | null
          piano_damage: number | null
          piano_jobs: number | null
          role: string | null
          score_art_handling: number | null
          score_events: number | null
          score_heavy_items: number | null
          score_high_value: number | null
          score_office: number | null
          score_piano: number | null
          score_residential: number | null
          score_white_glove: number | null
          total_jobs: number | null
          total_tips_earned: number | null
          user_id: string | null
        }
        Insert: {
          art_damage?: number | null
          art_jobs?: number | null
          avg_hours_vs_estimate?: number | null
          avg_satisfaction?: number | null
          avg_tip_per_job?: number | null
          badges?: Json | null
          can_drive_26ft?: boolean | null
          can_handle_piano?: boolean | null
          consecutive_5stars?: number | null
          created_at?: string
          damage_incidents?: number | null
          damage_rate?: number | null
          highest_tip?: number | null
          id?: string
          last_updated?: string | null
          max_floor_walkup?: number | null
          monthly_jobs?: Json | null
          monthly_ratings?: Json | null
          monthly_tips?: Json | null
          name?: string | null
          on_time_rate?: number | null
          piano_damage?: number | null
          piano_jobs?: number | null
          role?: string | null
          score_art_handling?: number | null
          score_events?: number | null
          score_heavy_items?: number | null
          score_high_value?: number | null
          score_office?: number | null
          score_piano?: number | null
          score_residential?: number | null
          score_white_glove?: number | null
          total_jobs?: number | null
          total_tips_earned?: number | null
          user_id?: string | null
        }
        Update: {
          art_damage?: number | null
          art_jobs?: number | null
          avg_hours_vs_estimate?: number | null
          avg_satisfaction?: number | null
          avg_tip_per_job?: number | null
          badges?: Json | null
          can_drive_26ft?: boolean | null
          can_handle_piano?: boolean | null
          consecutive_5stars?: number | null
          created_at?: string
          damage_incidents?: number | null
          damage_rate?: number | null
          highest_tip?: number | null
          id?: string
          last_updated?: string | null
          max_floor_walkup?: number | null
          monthly_jobs?: Json | null
          monthly_ratings?: Json | null
          monthly_tips?: Json | null
          name?: string | null
          on_time_rate?: number | null
          piano_damage?: number | null
          piano_jobs?: number | null
          role?: string | null
          score_art_handling?: number | null
          score_events?: number | null
          score_heavy_items?: number | null
          score_high_value?: number | null
          score_office?: number | null
          score_piano?: number | null
          score_residential?: number | null
          score_white_glove?: number | null
          total_jobs?: number | null
          total_tips_earned?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_schedule_blocks: {
        Row: {
          block_date: string
          block_end: string
          block_start: string
          block_type: string
          created_at: string | null
          created_by: string | null
          crew_id: string
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          updated_at: string | null
        }
        Insert: {
          block_date: string
          block_end: string
          block_start: string
          block_type: string
          created_at?: string | null
          created_by?: string | null
          crew_id: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string | null
        }
        Update: {
          block_date?: string
          block_end?: string
          block_start?: string
          block_type?: string
          created_at?: string | null
          created_by?: string | null
          crew_id?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_schedule_blocks_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          active: boolean
          created_at: string | null
          current_job: string | null
          current_lat: number | null
          current_lng: number | null
          delay_minutes: number | null
          id: string
          members: string[] | null
          name: string
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          current_job?: string | null
          current_lat?: number | null
          current_lng?: number | null
          delay_minutes?: number | null
          id?: string
          members?: string[] | null
          name: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          current_job?: string | null
          current_lat?: number | null
          current_lng?: number | null
          delay_minutes?: number | null
          id?: string
          members?: string[] | null
          name?: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      date_factors: {
        Row: {
          created_at: string
          factor_type: string
          factor_value: string
          id: string
          multiplier: number | null
        }
        Insert: {
          created_at?: string
          factor_type: string
          factor_value: string
          id?: string
          multiplier?: number | null
        }
        Update: {
          created_at?: string
          factor_type?: string
          factor_value?: string
          id?: string
          multiplier?: number | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          access_surcharge: number | null
          actual_crew_count: number | null
          actual_hours: number | null
          admin_adjusted_price: number | null
          admin_notes: string | null
          after_hours_surcharge: number | null
          approved_at: string | null
          approved_by: string | null
          assigned_crew_name: string | null
          assigned_members: Json | null
          assigned_truck_id: string | null
          b2b_assembly_required: boolean | null
          b2b_business_notify_delivered_sent_at: string | null
          b2b_business_notify_en_route_sent_at: string | null
          b2b_debris_removal: boolean | null
          b2b_handling_type: string | null
          b2b_line_items: Json | null
          base_price: number | null
          booking_type: string | null
          business_name: string | null
          calculated_price: number | null
          calendar_color: string | null
          calendar_status: string | null
          category: string | null
          client_name: string
          completed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by_source: string | null
          created_by_user: string | null
          crew_id: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          day_type: string | null
          delivery_access: string | null
          delivery_address: string
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_number: string
          delivery_score: number | null
          delivery_type: string | null
          delivery_window: string | null
          end_client_name: string | null
          end_client_phone: string | null
          end_customer_email: string | null
          end_customer_name: string | null
          end_customer_phone: string | null
          estimated_duration_hours: number | null
          estimated_duration_minutes: number | null
          estimated_internal_cost: number | null
          eta_current_minutes: number | null
          eta_last_checked_at: string | null
          eta_tracking_active: boolean | null
          final_price: number | null
          gcal_event_id: string | null
          hubspot_deal_id: string | null
          id: string
          instructions: string | null
          is_multi_stop: boolean | null
          item_weight_category: string | null
          items: string[] | null
          last_notified_tracking_at: string | null
          last_notified_tracking_status: string | null
          margin_alert_minutes: number | null
          notes: string | null
          num_stops: number | null
          operational_margin_alert_notified_at: string | null
          operational_schedule_alert_notified_at: string | null
          org_id: string | null
          organization_id: string | null
          overage_price: number | null
          override_price: number | null
          override_reason: string | null
          payment_received_at: string | null
          phase_count: number | null
          phase_id: string | null
          photo_count: number | null
          pickup_access: string | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          preferred_time: string | null
          pricing_breakdown: Json | null
          project_id: string | null
          project_name: string | null
          quoted_price: number | null
          rate_card_id: string | null
          recipient_tracking_token: string | null
          recommended_day_type: string | null
          recommended_vehicle: string | null
          route_optimized: boolean | null
          scheduled_date: string
          scheduled_end: string | null
          scheduled_start: string | null
          score_arrived_late: boolean | null
          score_damage_reported: boolean | null
          score_end_customer_rating: number | null
          score_scope_change: boolean | null
          services_price: number | null
          services_selected: Json | null
          source_quote_id: string | null
          source_recurring_delivery_schedule_id: string | null
          special_handling: boolean
          stage: string | null
          staged_delivery: boolean | null
          statement_id: string | null
          status: string | null
          stops_completed: number | null
          stops_detail: Json | null
          time_slot: string | null
          total_price: number | null
          total_stops: number | null
          tracking_code: string | null
          tracking_token: string | null
          updated_at: string | null
          vehicle_type: string | null
          vertical_code: string | null
          weight_surcharge: number | null
          zone: number | null
          zone_surcharge: number | null
        }
        Insert: {
          access_surcharge?: number | null
          actual_crew_count?: number | null
          actual_hours?: number | null
          admin_adjusted_price?: number | null
          admin_notes?: string | null
          after_hours_surcharge?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_crew_name?: string | null
          assigned_members?: Json | null
          assigned_truck_id?: string | null
          b2b_assembly_required?: boolean | null
          b2b_business_notify_delivered_sent_at?: string | null
          b2b_business_notify_en_route_sent_at?: string | null
          b2b_debris_removal?: boolean | null
          b2b_handling_type?: string | null
          b2b_line_items?: Json | null
          base_price?: number | null
          booking_type?: string | null
          business_name?: string | null
          calculated_price?: number | null
          calendar_color?: string | null
          calendar_status?: string | null
          category?: string | null
          client_name: string
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by_source?: string | null
          created_by_user?: string | null
          crew_id?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          day_type?: string | null
          delivery_access?: string | null
          delivery_address: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_number: string
          delivery_score?: number | null
          delivery_type?: string | null
          delivery_window?: string | null
          end_client_name?: string | null
          end_client_phone?: string | null
          end_customer_email?: string | null
          end_customer_name?: string | null
          end_customer_phone?: string | null
          estimated_duration_hours?: number | null
          estimated_duration_minutes?: number | null
          estimated_internal_cost?: number | null
          eta_current_minutes?: number | null
          eta_last_checked_at?: string | null
          eta_tracking_active?: boolean | null
          final_price?: number | null
          gcal_event_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          instructions?: string | null
          is_multi_stop?: boolean | null
          item_weight_category?: string | null
          items?: string[] | null
          last_notified_tracking_at?: string | null
          last_notified_tracking_status?: string | null
          margin_alert_minutes?: number | null
          notes?: string | null
          num_stops?: number | null
          operational_margin_alert_notified_at?: string | null
          operational_schedule_alert_notified_at?: string | null
          org_id?: string | null
          organization_id?: string | null
          overage_price?: number | null
          override_price?: number | null
          override_reason?: string | null
          payment_received_at?: string | null
          phase_count?: number | null
          phase_id?: string | null
          photo_count?: number | null
          pickup_access?: string | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          preferred_time?: string | null
          pricing_breakdown?: Json | null
          project_id?: string | null
          project_name?: string | null
          quoted_price?: number | null
          rate_card_id?: string | null
          recipient_tracking_token?: string | null
          recommended_day_type?: string | null
          recommended_vehicle?: string | null
          route_optimized?: boolean | null
          scheduled_date: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          score_arrived_late?: boolean | null
          score_damage_reported?: boolean | null
          score_end_customer_rating?: number | null
          score_scope_change?: boolean | null
          services_price?: number | null
          services_selected?: Json | null
          source_quote_id?: string | null
          source_recurring_delivery_schedule_id?: string | null
          special_handling?: boolean
          stage?: string | null
          staged_delivery?: boolean | null
          statement_id?: string | null
          status?: string | null
          stops_completed?: number | null
          stops_detail?: Json | null
          time_slot?: string | null
          total_price?: number | null
          total_stops?: number | null
          tracking_code?: string | null
          tracking_token?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
          vertical_code?: string | null
          weight_surcharge?: number | null
          zone?: number | null
          zone_surcharge?: number | null
        }
        Update: {
          access_surcharge?: number | null
          actual_crew_count?: number | null
          actual_hours?: number | null
          admin_adjusted_price?: number | null
          admin_notes?: string | null
          after_hours_surcharge?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_crew_name?: string | null
          assigned_members?: Json | null
          assigned_truck_id?: string | null
          b2b_assembly_required?: boolean | null
          b2b_business_notify_delivered_sent_at?: string | null
          b2b_business_notify_en_route_sent_at?: string | null
          b2b_debris_removal?: boolean | null
          b2b_handling_type?: string | null
          b2b_line_items?: Json | null
          base_price?: number | null
          booking_type?: string | null
          business_name?: string | null
          calculated_price?: number | null
          calendar_color?: string | null
          calendar_status?: string | null
          category?: string | null
          client_name?: string
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by_source?: string | null
          created_by_user?: string | null
          crew_id?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          day_type?: string | null
          delivery_access?: string | null
          delivery_address?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_number?: string
          delivery_score?: number | null
          delivery_type?: string | null
          delivery_window?: string | null
          end_client_name?: string | null
          end_client_phone?: string | null
          end_customer_email?: string | null
          end_customer_name?: string | null
          end_customer_phone?: string | null
          estimated_duration_hours?: number | null
          estimated_duration_minutes?: number | null
          estimated_internal_cost?: number | null
          eta_current_minutes?: number | null
          eta_last_checked_at?: string | null
          eta_tracking_active?: boolean | null
          final_price?: number | null
          gcal_event_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          instructions?: string | null
          is_multi_stop?: boolean | null
          item_weight_category?: string | null
          items?: string[] | null
          last_notified_tracking_at?: string | null
          last_notified_tracking_status?: string | null
          margin_alert_minutes?: number | null
          notes?: string | null
          num_stops?: number | null
          operational_margin_alert_notified_at?: string | null
          operational_schedule_alert_notified_at?: string | null
          org_id?: string | null
          organization_id?: string | null
          overage_price?: number | null
          override_price?: number | null
          override_reason?: string | null
          payment_received_at?: string | null
          phase_count?: number | null
          phase_id?: string | null
          photo_count?: number | null
          pickup_access?: string | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          preferred_time?: string | null
          pricing_breakdown?: Json | null
          project_id?: string | null
          project_name?: string | null
          quoted_price?: number | null
          rate_card_id?: string | null
          recipient_tracking_token?: string | null
          recommended_day_type?: string | null
          recommended_vehicle?: string | null
          route_optimized?: boolean | null
          scheduled_date?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          score_arrived_late?: boolean | null
          score_damage_reported?: boolean | null
          score_end_customer_rating?: number | null
          score_scope_change?: boolean | null
          services_price?: number | null
          services_selected?: Json | null
          source_quote_id?: string | null
          source_recurring_delivery_schedule_id?: string | null
          special_handling?: boolean
          stage?: string | null
          staged_delivery?: boolean | null
          statement_id?: string | null
          status?: string | null
          stops_completed?: number | null
          stops_detail?: Json | null
          time_slot?: string | null
          total_price?: number | null
          total_stops?: number | null
          tracking_code?: string | null
          tracking_token?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
          vertical_code?: string | null
          weight_surcharge?: number | null
          zone?: number | null
          zone_surcharge?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_assigned_truck_id_fkey"
            columns: ["assigned_truck_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_source_recurring_delivery_schedule_id_fkey"
            columns: ["source_recurring_delivery_schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_delivery_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "partner_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_stop_items: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string | null
          description: string
          id: string
          is_fragile: boolean | null
          is_high_value: boolean | null
          notes: string | null
          photo_url: string | null
          quantity: number
          requires_assembly: boolean | null
          status: string | null
          stop_id: string
          weight_range: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          description: string
          id?: string
          is_fragile?: boolean | null
          is_high_value?: boolean | null
          notes?: string | null
          photo_url?: string | null
          quantity?: number
          requires_assembly?: boolean | null
          status?: string | null
          stop_id: string
          weight_range?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          description?: string
          id?: string
          is_fragile?: boolean | null
          is_high_value?: boolean | null
          notes?: string | null
          photo_url?: string | null
          quantity?: number
          requires_assembly?: boolean | null
          status?: string | null
          stop_id?: string
          weight_range?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stop_items_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "delivery_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_stops: {
        Row: {
          access_notes: string | null
          access_type: string | null
          address: string
          arrived_at: string | null
          client_phone: string | null
          completed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_id: string
          delivery_phase: number | null
          estimated_duration_minutes: number | null
          id: string
          is_final_destination: boolean | null
          items_description: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          readiness: string | null
          readiness_notes: string | null
          sequence_locked: boolean | null
          services_selected: Json | null
          special_instructions: string | null
          status: string | null
          stop_number: number
          stop_status: string | null
          stop_type: string | null
          vendor_name: string | null
          zone: number | null
        }
        Insert: {
          access_notes?: string | null
          access_type?: string | null
          address: string
          arrived_at?: string | null
          client_phone?: string | null
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_id: string
          delivery_phase?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          is_final_destination?: boolean | null
          items_description?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          readiness?: string | null
          readiness_notes?: string | null
          sequence_locked?: boolean | null
          services_selected?: Json | null
          special_instructions?: string | null
          status?: string | null
          stop_number: number
          stop_status?: string | null
          stop_type?: string | null
          vendor_name?: string | null
          zone?: number | null
        }
        Update: {
          access_notes?: string | null
          access_type?: string | null
          address?: string
          arrived_at?: string | null
          client_phone?: string | null
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_id?: string
          delivery_phase?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          is_final_destination?: boolean | null
          items_description?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          readiness?: string | null
          readiness_notes?: string | null
          sequence_locked?: boolean | null
          services_selected?: Json | null
          special_instructions?: string | null
          status?: string | null
          stop_number?: number
          stop_status?: string | null
          stop_type?: string | null
          vendor_name?: string | null
          zone?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stops_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_verticals: {
        Row: {
          active: boolean
          base_rate: number
          code: string
          created_at: string
          default_config: Json
          description: string | null
          icon: string | null
          id: string
          items_included_in_base: number | null
          name: string
          per_item_rate_after_base: number | null
          pricing_method: string
          sort_order: number
          stops_included_in_base: number | null
        }
        Insert: {
          active?: boolean
          base_rate?: number
          code: string
          created_at?: string
          default_config?: Json
          description?: string | null
          icon?: string | null
          id?: string
          items_included_in_base?: number | null
          name: string
          per_item_rate_after_base?: number | null
          pricing_method?: string
          sort_order?: number
          stops_included_in_base?: number | null
        }
        Update: {
          active?: boolean
          base_rate?: number
          code?: string
          created_at?: string
          default_config?: Json
          description?: string | null
          icon?: string | null
          id?: string
          items_included_in_base?: number | null
          name?: string
          per_item_rate_after_base?: number | null
          pricing_method?: string
          sort_order?: number
          stops_included_in_base?: number | null
        }
        Relationships: []
      }
      deposit_rules: {
        Row: {
          amount_bracket: string
          created_at: string
          deposit_type: string
          deposit_value: number
          id: string
          service_type: string
        }
        Insert: {
          amount_bracket: string
          created_at?: string
          deposit_type: string
          deposit_value?: number
          id?: string
          service_type: string
        }
        Update: {
          amount_bracket?: string
          created_at?: string
          deposit_type?: string
          deposit_value?: number
          id?: string
          service_type?: string
        }
        Relationships: []
      }
      device_setup_codes: {
        Row: {
          code: string
          created_at: string | null
          default_team_id: string | null
          device_name: string | null
          expires_at: string
          id: string
          truck_id: string | null
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          default_team_id?: string | null
          device_name?: string | null
          expires_at: string
          id?: string
          truck_id?: string | null
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          default_team_id?: string | null
          device_name?: string | null
          expires_at?: string
          id?: string
          truck_id?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_setup_codes_default_team_id_fkey"
            columns: ["default_team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_setup_codes_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      duration_defaults: {
        Row: {
          created_at: string
          default_hours: number
          id: string
          job_type: string
          max_hours: number | null
          min_hours: number | null
          notes: string | null
          sub_type: string | null
        }
        Insert: {
          created_at?: string
          default_hours: number
          id?: string
          job_type: string
          max_hours?: number | null
          min_hours?: number | null
          notes?: string | null
          sub_type?: string | null
        }
        Update: {
          created_at?: string
          default_hours?: number
          id?: string
          job_type?: string
          max_hours?: number | null
          min_hours?: number | null
          notes?: string | null
          sub_type?: string | null
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          recipient: string
          resend_id: string | null
          status: string | null
          subject: string | null
          template: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient: string
          resend_id?: string | null
          status?: string | null
          subject?: string | null
          template?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient?: string
          resend_id?: string | null
          status?: string | null
          subject?: string | null
          template?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          is_active: boolean | null
          merge_variables: string[]
          subject: string
          template_slug: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          body_html: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          merge_variables?: string[]
          subject: string
          template_slug: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          merge_variables?: string[]
          subject?: string
          template_slug?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      email_verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          new_email: string | null
          purpose: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          new_email?: string | null
          purpose: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          new_email?: string | null
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      end_of_day_reports: {
        Row: {
          created_at: string | null
          crew_lead_id: string
          crew_note: string | null
          expenses: Json | null
          generated_at: string | null
          id: string
          jobs: Json
          readiness: Json | null
          report_date: string
          summary: Json
          team_id: string
        }
        Insert: {
          created_at?: string | null
          crew_lead_id: string
          crew_note?: string | null
          expenses?: Json | null
          generated_at?: string | null
          id?: string
          jobs?: Json
          readiness?: Json | null
          report_date: string
          summary?: Json
          team_id: string
        }
        Update: {
          created_at?: string | null
          crew_lead_id?: string
          crew_note?: string | null
          expenses?: Json | null
          generated_at?: string | null
          id?: string
          jobs?: Json
          readiness?: Json | null
          report_date?: string
          summary?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "end_of_day_reports_crew_lead_id_fkey"
            columns: ["crew_lead_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "end_of_day_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_check_lines: {
        Row: {
          actual_quantity: number
          check_id: string
          equipment_id: string
          expected_quantity: number
          id: string
        }
        Insert: {
          actual_quantity: number
          check_id: string
          equipment_id: string
          expected_quantity: number
          id?: string
        }
        Update: {
          actual_quantity?: number
          check_id?: string
          equipment_id?: string
          expected_quantity?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_check_lines_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "equipment_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_check_lines_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_checks: {
        Row: {
          created_at: string | null
          crew_lead_id: string | null
          id: string
          job_id: string
          job_type: string
          left_at_client_will_retrieve: boolean | null
          shortage_batch_reason: string | null
          skip_notes: string | null
          skip_reason: string | null
          truck_id: string | null
        }
        Insert: {
          created_at?: string | null
          crew_lead_id?: string | null
          id?: string
          job_id: string
          job_type: string
          left_at_client_will_retrieve?: boolean | null
          shortage_batch_reason?: string | null
          skip_notes?: string | null
          skip_reason?: string | null
          truck_id?: string | null
        }
        Update: {
          created_at?: string | null
          crew_lead_id?: string | null
          id?: string
          job_id?: string
          job_type?: string
          left_at_client_will_retrieve?: boolean | null
          shortage_batch_reason?: string | null
          skip_notes?: string | null
          skip_reason?: string | null
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_checks_crew_lead_id_fkey"
            columns: ["crew_lead_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_checks_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_incidents: {
        Row: {
          actual_quantity: number
          created_at: string | null
          crew_lead_id: string | null
          delivery_id: string | null
          equipment_check_id: string | null
          equipment_id: string
          expected_quantity: number
          id: string
          move_id: string | null
          reason: string
          replacement_cost: number | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_notes: string | null
          shortage: number
          truck_id: string | null
        }
        Insert: {
          actual_quantity: number
          created_at?: string | null
          crew_lead_id?: string | null
          delivery_id?: string | null
          equipment_check_id?: string | null
          equipment_id: string
          expected_quantity: number
          id?: string
          move_id?: string | null
          reason: string
          replacement_cost?: number | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_notes?: string | null
          shortage: number
          truck_id?: string | null
        }
        Update: {
          actual_quantity?: number
          created_at?: string | null
          crew_lead_id?: string | null
          delivery_id?: string | null
          equipment_check_id?: string | null
          equipment_id?: string
          expected_quantity?: number
          id?: string
          move_id?: string | null
          reason?: string
          replacement_cost?: number | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_notes?: string | null
          shortage?: number
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_incidents_crew_lead_id_fkey"
            columns: ["crew_lead_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_incidents_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_incidents_equipment_check_id_fkey"
            columns: ["equipment_check_id"]
            isOneToOne: false
            referencedRelation: "equipment_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_incidents_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_incidents_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_incidents_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_inventory: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          default_quantity: number
          icon: string | null
          id: string
          is_consumable: boolean | null
          name: string
          replacement_cost: number | null
        }
        Insert: {
          active?: boolean | null
          category: string
          created_at?: string | null
          default_quantity?: number
          icon?: string | null
          id?: string
          is_consumable?: boolean | null
          name: string
          replacement_cost?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          default_quantity?: number
          icon?: string | null
          id?: string
          is_consumable?: boolean | null
          name?: string
          replacement_cost?: number | null
        }
        Relationships: []
      }
      eta_sms_log: {
        Row: {
          created_at: string | null
          crew_lat: number | null
          crew_lng: number | null
          delivery_id: string | null
          delivery_stop_index: number | null
          destination_lat: number | null
          destination_lng: number | null
          eta_minutes: number | null
          id: string
          message_body: string
          message_type: string
          move_id: string | null
          recipient_name: string
          recipient_phone: string
          sent_at: string | null
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string | null
          crew_lat?: number | null
          crew_lng?: number | null
          delivery_id?: string | null
          delivery_stop_index?: number | null
          destination_lat?: number | null
          destination_lng?: number | null
          eta_minutes?: number | null
          id?: string
          message_body: string
          message_type: string
          move_id?: string | null
          recipient_name: string
          recipient_phone: string
          sent_at?: string | null
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string | null
          crew_lat?: number | null
          crew_lng?: number | null
          delivery_id?: string | null
          delivery_stop_index?: number | null
          destination_lat?: number | null
          destination_lng?: number | null
          eta_minutes?: number | null
          id?: string
          message_body?: string
          message_type?: string
          move_id?: string | null
          recipient_name?: string
          recipient_phone?: string
          sent_at?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eta_sms_log_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eta_sms_log_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_items: {
        Row: {
          added_at: string | null
          added_by: string | null
          charged_at: string | null
          created_at: string | null
          description: string
          fee_cents: number | null
          id: string
          job_id: string
          job_type: string | null
          payment_charged: boolean
          photo_storage_path: string | null
          quantity: number | null
          requested_by: string
          room: string | null
          square_payment_id: string | null
          status: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          charged_at?: string | null
          created_at?: string | null
          description: string
          fee_cents?: number | null
          id?: string
          job_id: string
          job_type?: string | null
          payment_charged?: boolean
          photo_storage_path?: string | null
          quantity?: number | null
          requested_by?: string
          room?: string | null
          square_payment_id?: string | null
          status?: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          charged_at?: string | null
          created_at?: string | null
          description?: string
          fee_cents?: number | null
          id?: string
          job_id?: string
          job_type?: string | null
          payment_charged?: boolean
          photo_storage_path?: string | null
          quantity?: number | null
          requested_by?: string
          room?: string | null
          square_payment_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          capacity_cuft: number | null
          capacity_lbs: number | null
          created_at: string | null
          current_mileage: number | null
          default_team_id: string | null
          display_name: string
          id: string
          license_plate: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string | null
          vehicle_type: string
        }
        Insert: {
          capacity_cuft?: number | null
          capacity_lbs?: number | null
          created_at?: string | null
          current_mileage?: number | null
          default_team_id?: string | null
          display_name: string
          id?: string
          license_plate: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string | null
          vehicle_type: string
        }
        Update: {
          capacity_cuft?: number | null
          capacity_lbs?: number | null
          created_at?: string | null
          current_mileage?: number | null
          default_team_id?: string | null
          display_name?: string
          id?: string
          license_plate?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      gallery_project_items: {
        Row: {
          artist: string | null
          climate_sensitive: boolean
          condition_discrepancy: boolean | null
          crating_required: boolean
          created_at: string
          dimensions: string | null
          fragile: boolean
          handling_notes: string | null
          id: string
          insurance_value: string | null
          medium: string | null
          post_condition: string | null
          post_condition_at: string | null
          post_condition_by: string | null
          post_condition_notes: string | null
          post_condition_photos: string[] | null
          pre_condition: string | null
          pre_condition_at: string | null
          pre_condition_by: string | null
          pre_condition_notes: string | null
          pre_condition_photos: string[] | null
          project_id: string
          serial_number: string | null
          sort_order: number
          title: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          artist?: string | null
          climate_sensitive?: boolean
          condition_discrepancy?: boolean | null
          crating_required?: boolean
          created_at?: string
          dimensions?: string | null
          fragile?: boolean
          handling_notes?: string | null
          id?: string
          insurance_value?: string | null
          medium?: string | null
          post_condition?: string | null
          post_condition_at?: string | null
          post_condition_by?: string | null
          post_condition_notes?: string | null
          post_condition_photos?: string[] | null
          pre_condition?: string | null
          pre_condition_at?: string | null
          pre_condition_by?: string | null
          pre_condition_notes?: string | null
          pre_condition_photos?: string[] | null
          project_id: string
          serial_number?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          artist?: string | null
          climate_sensitive?: boolean
          condition_discrepancy?: boolean | null
          crating_required?: boolean
          created_at?: string
          dimensions?: string | null
          fragile?: boolean
          handling_notes?: string | null
          id?: string
          insurance_value?: string | null
          medium?: string | null
          post_condition?: string | null
          post_condition_at?: string | null
          post_condition_by?: string | null
          post_condition_notes?: string | null
          post_condition_photos?: string[] | null
          pre_condition?: string | null
          pre_condition_at?: string | null
          pre_condition_by?: string | null
          pre_condition_notes?: string | null
          pre_condition_photos?: string[] | null
          project_id?: string
          serial_number?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "gallery_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_projects: {
        Row: {
          created_at: string
          details: string | null
          gallery: string | null
          id: string
          name: string
          requires_condition_report: boolean
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          gallery?: string | null
          id?: string
          name: string
          requires_condition_report?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          gallery?: string | null
          id?: string
          name?: string
          requires_condition_report?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      high_value_declarations: {
        Row: {
          created_at: string | null
          declared_value: number
          description: string | null
          fee: number
          id: string
          item_name: string
          move_id: string | null
          photo_url: string | null
          quote_id: string | null
          weight_lbs: number | null
        }
        Insert: {
          created_at?: string | null
          declared_value: number
          description?: string | null
          fee: number
          id?: string
          item_name: string
          move_id?: string | null
          photo_url?: string | null
          quote_id?: string | null
          weight_lbs?: number | null
        }
        Update: {
          created_at?: string | null
          declared_value?: number
          description?: string | null
          fee?: number
          id?: string
          item_name?: string
          move_id?: string | null
          photo_url?: string | null
          quote_id?: string | null
          weight_lbs?: number | null
        }
        Relationships: []
      }
      in_app_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          event_slug: string | null
          icon: string | null
          id: string
          is_read: boolean | null
          link: string | null
          read_at: string | null
          source_id: string | null
          source_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          event_slug?: string | null
          icon?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          read_at?: string | null
          source_id?: string | null
          source_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          event_slug?: string | null
          icon?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          read_at?: string | null
          source_id?: string | null
          source_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      inbound_shipments: {
        Row: {
          assembly_complexity: string | null
          assembly_price: number | null
          billing_method: string | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          carrier_eta: string | null
          carrier_name: string | null
          carrier_tracking_number: string | null
          completed_at: string | null
          created_at: string | null
          customer_access: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_postal: string | null
          customer_provided_at: string | null
          delivery_crew: string | null
          delivery_id: string | null
          delivery_price: number | null
          delivery_scheduled_date: string | null
          delivery_window: string | null
          id: string
          inspection_items: Json | null
          inspection_notes: string | null
          inspection_photos: Json | null
          inspection_status: string | null
          invoice_id: string | null
          invoice_sent: boolean | null
          items: Json
          organization_id: string | null
          partner_contact_email: string | null
          partner_contact_name: string | null
          partner_contact_phone: string | null
          partner_issue_phone: string | null
          partner_name: string | null
          partner_resolution_choice: string | null
          partner_resolution_notes: string | null
          pod_captured: boolean | null
          pod_photo_url: string | null
          pod_signature: string | null
          pod_signed_at: string | null
          received_at: string | null
          received_by: string | null
          receiving_fee: number | null
          receiving_inspection_tier: string | null
          requires_assembly: boolean | null
          requires_debris_removal: boolean | null
          requires_move_inside: boolean | null
          requires_pod: boolean | null
          requires_unboxing: boolean | null
          service_level: string | null
          shipment_number: string
          special_instructions: string | null
          status: string | null
          storage_days: number | null
          storage_fee_per_day: number | null
          storage_location: string | null
          storage_price: number | null
          storage_start_date: string | null
          storage_total: number | null
          total_pieces: number | null
          total_price: number | null
          updated_at: string | null
          vertical_code: string | null
        }
        Insert: {
          assembly_complexity?: string | null
          assembly_price?: number | null
          billing_method?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          carrier_eta?: string | null
          carrier_name?: string | null
          carrier_tracking_number?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_access?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_postal?: string | null
          customer_provided_at?: string | null
          delivery_crew?: string | null
          delivery_id?: string | null
          delivery_price?: number | null
          delivery_scheduled_date?: string | null
          delivery_window?: string | null
          id?: string
          inspection_items?: Json | null
          inspection_notes?: string | null
          inspection_photos?: Json | null
          inspection_status?: string | null
          invoice_id?: string | null
          invoice_sent?: boolean | null
          items?: Json
          organization_id?: string | null
          partner_contact_email?: string | null
          partner_contact_name?: string | null
          partner_contact_phone?: string | null
          partner_issue_phone?: string | null
          partner_name?: string | null
          partner_resolution_choice?: string | null
          partner_resolution_notes?: string | null
          pod_captured?: boolean | null
          pod_photo_url?: string | null
          pod_signature?: string | null
          pod_signed_at?: string | null
          received_at?: string | null
          received_by?: string | null
          receiving_fee?: number | null
          receiving_inspection_tier?: string | null
          requires_assembly?: boolean | null
          requires_debris_removal?: boolean | null
          requires_move_inside?: boolean | null
          requires_pod?: boolean | null
          requires_unboxing?: boolean | null
          service_level?: string | null
          shipment_number: string
          special_instructions?: string | null
          status?: string | null
          storage_days?: number | null
          storage_fee_per_day?: number | null
          storage_location?: string | null
          storage_price?: number | null
          storage_start_date?: string | null
          storage_total?: number | null
          total_pieces?: number | null
          total_price?: number | null
          updated_at?: string | null
          vertical_code?: string | null
        }
        Update: {
          assembly_complexity?: string | null
          assembly_price?: number | null
          billing_method?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          carrier_eta?: string | null
          carrier_name?: string | null
          carrier_tracking_number?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_access?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_postal?: string | null
          customer_provided_at?: string | null
          delivery_crew?: string | null
          delivery_id?: string | null
          delivery_price?: number | null
          delivery_scheduled_date?: string | null
          delivery_window?: string | null
          id?: string
          inspection_items?: Json | null
          inspection_notes?: string | null
          inspection_photos?: Json | null
          inspection_status?: string | null
          invoice_id?: string | null
          invoice_sent?: boolean | null
          items?: Json
          organization_id?: string | null
          partner_contact_email?: string | null
          partner_contact_name?: string | null
          partner_contact_phone?: string | null
          partner_issue_phone?: string | null
          partner_name?: string | null
          partner_resolution_choice?: string | null
          partner_resolution_notes?: string | null
          pod_captured?: boolean | null
          pod_photo_url?: string | null
          pod_signature?: string | null
          pod_signed_at?: string | null
          received_at?: string | null
          received_by?: string | null
          receiving_fee?: number | null
          receiving_inspection_tier?: string | null
          requires_assembly?: boolean | null
          requires_debris_removal?: boolean | null
          requires_move_inside?: boolean | null
          requires_pod?: boolean | null
          requires_unboxing?: boolean | null
          service_level?: string | null
          shipment_number?: string
          special_instructions?: string | null
          status?: string | null
          storage_days?: number | null
          storage_fee_per_day?: number | null
          storage_location?: string | null
          storage_price?: number | null
          storage_start_date?: string | null
          storage_total?: number | null
          total_pieces?: number | null
          total_price?: number | null
          updated_at?: string | null
          vertical_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_shipments_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_shipments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string | null
          crew_member_id: string | null
          description: string | null
          id: string
          issue_type: string
          job_id: string
          job_type: string
          photo_url: string | null
          photo_urls: string[] | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          status: string
          urgency: string
        }
        Insert: {
          created_at?: string | null
          crew_member_id?: string | null
          description?: string | null
          id?: string
          issue_type: string
          job_id: string
          job_type: string
          photo_url?: string | null
          photo_urls?: string[] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          status?: string
          urgency?: string
        }
        Update: {
          created_at?: string | null
          crew_member_id?: string | null
          description?: string | null
          id?: string
          issue_type?: string
          job_id?: string
          job_type?: string
          photo_url?: string | null
          photo_urls?: string[] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          status?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_change_requests: {
        Row: {
          additional_deposit_required: number
          admin_adjusted_delta: number | null
          admin_notes: string | null
          auto_calculated_delta: number
          client_id: string | null
          client_responded_at: string | null
          client_response: string | null
          confirmed_at: string | null
          created_at: string
          crew_notes: string | null
          crew_walkthrough_completed: boolean | null
          decline_reason: string | null
          extras_declined_note: string | null
          id: string
          items_added: Json
          items_extra: number | null
          items_matched: number | null
          items_missing: number | null
          items_removed: Json
          move_id: string
          move_phase: string | null
          new_subtotal: number | null
          original_subtotal: number | null
          payment_amount: number | null
          payment_charged: boolean | null
          payment_transaction_id: string | null
          quote_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          status: string
          submitted_at: string
          truck_assessment: Json | null
          walkthrough_photos: Json | null
        }
        Insert: {
          additional_deposit_required?: number
          admin_adjusted_delta?: number | null
          admin_notes?: string | null
          auto_calculated_delta?: number
          client_id?: string | null
          client_responded_at?: string | null
          client_response?: string | null
          confirmed_at?: string | null
          created_at?: string
          crew_notes?: string | null
          crew_walkthrough_completed?: boolean | null
          decline_reason?: string | null
          extras_declined_note?: string | null
          id?: string
          items_added?: Json
          items_extra?: number | null
          items_matched?: number | null
          items_missing?: number | null
          items_removed?: Json
          move_id: string
          move_phase?: string | null
          new_subtotal?: number | null
          original_subtotal?: number | null
          payment_amount?: number | null
          payment_charged?: boolean | null
          payment_transaction_id?: string | null
          quote_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string
          submitted_at?: string
          truck_assessment?: Json | null
          walkthrough_photos?: Json | null
        }
        Update: {
          additional_deposit_required?: number
          admin_adjusted_delta?: number | null
          admin_notes?: string | null
          auto_calculated_delta?: number
          client_id?: string | null
          client_responded_at?: string | null
          client_response?: string | null
          confirmed_at?: string | null
          created_at?: string
          crew_notes?: string | null
          crew_walkthrough_completed?: boolean | null
          decline_reason?: string | null
          extras_declined_note?: string | null
          id?: string
          items_added?: Json
          items_extra?: number | null
          items_matched?: number | null
          items_missing?: number | null
          items_removed?: Json
          move_id?: string
          move_phase?: string | null
          new_subtotal?: number | null
          original_subtotal?: number | null
          payment_amount?: number | null
          payment_charged?: boolean | null
          payment_transaction_id?: string | null
          quote_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string
          submitted_at?: string
          truck_assessment?: Json | null
          walkthrough_photos?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_change_requests_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_change_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_verifications: {
        Row: {
          created_at: string | null
          id: string
          item_name: string | null
          job_id: string
          job_type: string
          move_inventory_id: string | null
          room: string | null
          stage: string
          verified_at: string | null
          verified_by: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name?: string | null
          job_id: string
          job_type: string
          move_inventory_id?: string | null
          room?: string | null
          stage: string
          verified_at?: string | null
          verified_by: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string | null
          job_id?: string
          job_type?: string
          move_inventory_id?: string | null
          room?: string | null
          stage?: string
          verified_at?: string | null
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_verifications_move_inventory_id_fkey"
            columns: ["move_inventory_id"]
            isOneToOne: false
            referencedRelation: "move_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_user_id: string | null
          must_change_password: boolean
          name: string | null
          role: string
          status: string
          temp_password: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_user_id?: string | null
          must_change_password?: boolean
          name?: string | null
          role?: string
          status?: string
          temp_password?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_user_id?: string | null
          must_change_password?: boolean
          name?: string | null
          role?: string
          status?: string
          temp_password?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_name: string
          created_at: string | null
          delivery_id: string | null
          due_date: string | null
          file_path: string | null
          id: string
          invoice_number: string
          line_items: Json | null
          move_id: string | null
          org_id: string | null
          organization_id: string | null
          square_invoice_id: string | null
          square_invoice_url: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          client_name: string
          created_at?: string | null
          delivery_id?: string | null
          due_date?: string | null
          file_path?: string | null
          id?: string
          invoice_number: string
          line_items?: Json | null
          move_id?: string | null
          org_id?: string | null
          organization_id?: string | null
          square_invoice_id?: string | null
          square_invoice_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          client_name?: string
          created_at?: string | null
          delivery_id?: string | null
          due_date?: string | null
          file_path?: string | null
          id?: string
          invoice_number?: string
          line_items?: Json | null
          move_id?: string | null
          org_id?: string | null
          organization_id?: string | null
          square_invoice_id?: string | null
          square_invoice_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      item_packages: {
        Row: {
          crate_type: string | null
          created_at: string
          fragile: boolean
          hazmat: boolean
          height_cm: number | null
          id: string
          length_cm: number | null
          notes: string | null
          package_index: number
          parent_id: string
          parent_table: string
          updated_at: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          crate_type?: string | null
          created_at?: string
          fragile?: boolean
          hazmat?: boolean
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          notes?: string | null
          package_index: number
          parent_id: string
          parent_table: string
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          crate_type?: string | null
          created_at?: string
          fragile?: boolean
          hazmat?: boolean
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          notes?: string | null
          package_index?: number
          parent_id?: string
          parent_table?: string
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      item_weights: {
        Row: {
          active: boolean | null
          assembly_complexity: string | null
          assembly_notes: string | null
          category: string
          created_at: string | null
          disassembly_required: boolean | null
          display_order: number | null
          id: string
          is_common: boolean | null
          is_fragile: boolean | null
          item_name: string
          num_people_min: number | null
          requires_specialist: boolean | null
          room: string | null
          slug: string
          weight_score: number
        }
        Insert: {
          active?: boolean | null
          assembly_complexity?: string | null
          assembly_notes?: string | null
          category?: string
          created_at?: string | null
          disassembly_required?: boolean | null
          display_order?: number | null
          id?: string
          is_common?: boolean | null
          is_fragile?: boolean | null
          item_name: string
          num_people_min?: number | null
          requires_specialist?: boolean | null
          room?: string | null
          slug: string
          weight_score?: number
        }
        Update: {
          active?: boolean | null
          assembly_complexity?: string | null
          assembly_notes?: string | null
          category?: string
          created_at?: string | null
          disassembly_required?: boolean | null
          display_order?: number | null
          id?: string
          is_common?: boolean | null
          is_fragile?: boolean | null
          item_name?: string
          num_people_min?: number | null
          requires_specialist?: boolean | null
          room?: string | null
          slug?: string
          weight_score?: number
        }
        Relationships: []
      }
      job_cost_overrides: {
        Row: {
          created_at: string
          fuel: number | null
          id: string
          job_id: string
          job_type: string
          labour: number | null
          processing: number | null
          supplies: number | null
          truck: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fuel?: number | null
          id?: string
          job_id: string
          job_type: string
          labour?: number | null
          processing?: number | null
          supplies?: number | null
          truck?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fuel?: number | null
          id?: string
          job_id?: string
          job_type?: string
          labour?: number | null
          processing?: number | null
          supplies?: number | null
          truck?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      job_final_price_edits: {
        Row: {
          created_at: string
          difference: number
          edited_by: string
          edited_by_name: string
          id: string
          invoice_may_need_reissue: boolean
          job_id: string
          job_type: string
          new_price: number
          original_price: number
          reason: string
        }
        Insert: {
          created_at?: string
          difference: number
          edited_by: string
          edited_by_name: string
          id?: string
          invoice_may_need_reissue?: boolean
          job_id: string
          job_type: string
          new_price: number
          original_price: number
          reason: string
        }
        Update: {
          created_at?: string
          difference?: number
          edited_by?: string
          edited_by_name?: string
          id?: string
          invoice_may_need_reissue?: boolean
          job_id?: string
          job_type?: string
          new_price?: number
          original_price?: number
          reason?: string
        }
        Relationships: []
      }
      job_photos: {
        Row: {
          category: Database["public"]["Enums"]["photo_category"]
          checkpoint: string | null
          created_at: string | null
          id: string
          is_client_visible: boolean
          job_id: string
          job_type: string
          lat: number | null
          lng: number | null
          note: string | null
          session_id: string | null
          storage_path: string
          taken_at: string | null
          taken_by: string
          thumbnail_path: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["photo_category"]
          checkpoint?: string | null
          created_at?: string | null
          id?: string
          is_client_visible?: boolean
          job_id: string
          job_type: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          session_id?: string | null
          storage_path: string
          taken_at?: string | null
          taken_by: string
          thumbnail_path?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["photo_category"]
          checkpoint?: string | null
          created_at?: string | null
          id?: string
          is_client_visible?: boolean
          job_id?: string
          job_type?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          session_id?: string | null
          storage_path?: string
          taken_at?: string | null
          taken_by?: string
          thumbnail_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_taken_by_fkey"
            columns: ["taken_by"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stops: {
        Row: {
          address: string
          created_at: string
          id: string
          job_id: string
          job_type: string
          lat: number | null
          lng: number | null
          notes: string | null
          sort_order: number
          status: string
          status_updated_at: string | null
          stop_type: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          job_id: string
          job_type: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          sort_order?: number
          status?: string
          status_updated_at?: string | null
          stop_type: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          job_id?: string
          job_type?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          sort_order?: number
          status?: string
          status_updated_at?: string | null
          stop_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          performed_by: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          performed_by?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assembly_needed: string | null
          assigned_at: string | null
          assigned_to: string | null
          clarifications_needed: Json
          completeness_path: string
          completeness_score: number
          complexity_score: number
          created_at: string
          detected_dates: Json
          detected_service_type: string | null
          email: string | null
          estimated_value: number | null
          external_platform: string | null
          external_reference: string | null
          fields_missing: Json
          fields_present: Json
          first_name: string | null
          first_response_at: string | null
          follow_up_questions: Json
          follow_up_sent_at: string | null
          from_access: string | null
          from_address: string | null
          has_specialty: boolean
          how_heard: string | null
          hubspot_contact_id: string | null
          hubspot_deal_id: string | null
          id: string
          insurance_preference: string | null
          intelligence_summary: string | null
          inventory_parse_confidence: string | null
          last_name: string | null
          lead_number: string
          lost_reason: string | null
          message: string | null
          move_id: string | null
          move_size: string | null
          packing_help: string | null
          parsed_box_count: number | null
          parsed_dimensions_text: string | null
          parsed_inventory: Json
          parsed_weight_lbs_max: number | null
          phone: string | null
          photo_count: number
          photo_survey_token: string | null
          photos_requested_at: string | null
          photos_uploaded_at: string | null
          preferred_date: string | null
          preferred_time: string | null
          priority: string
          priority_reasons: Json
          quote_uuid: string | null
          raw_inquiry_text: string | null
          raw_inventory_text: string | null
          recommended_tier: string | null
          referral_detail: string | null
          referral_source_id: string | null
          requires_specialty_quote: boolean
          response_method: string | null
          response_time_seconds: number | null
          service_type: string | null
          source: string
          source_detail: string | null
          specialty_items_detected: Json
          stale_escalation_sent_at: string | null
          status: string
          to_access: string | null
          to_address: string | null
          updated_at: string
          urgency_score: number
          wrapping_needed: string | null
        }
        Insert: {
          assembly_needed?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          clarifications_needed?: Json
          completeness_path?: string
          completeness_score?: number
          complexity_score?: number
          created_at?: string
          detected_dates?: Json
          detected_service_type?: string | null
          email?: string | null
          estimated_value?: number | null
          external_platform?: string | null
          external_reference?: string | null
          fields_missing?: Json
          fields_present?: Json
          first_name?: string | null
          first_response_at?: string | null
          follow_up_questions?: Json
          follow_up_sent_at?: string | null
          from_access?: string | null
          from_address?: string | null
          has_specialty?: boolean
          how_heard?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          insurance_preference?: string | null
          intelligence_summary?: string | null
          inventory_parse_confidence?: string | null
          last_name?: string | null
          lead_number: string
          lost_reason?: string | null
          message?: string | null
          move_id?: string | null
          move_size?: string | null
          packing_help?: string | null
          parsed_box_count?: number | null
          parsed_dimensions_text?: string | null
          parsed_inventory?: Json
          parsed_weight_lbs_max?: number | null
          phone?: string | null
          photo_count?: number
          photo_survey_token?: string | null
          photos_requested_at?: string | null
          photos_uploaded_at?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          priority?: string
          priority_reasons?: Json
          quote_uuid?: string | null
          raw_inquiry_text?: string | null
          raw_inventory_text?: string | null
          recommended_tier?: string | null
          referral_detail?: string | null
          referral_source_id?: string | null
          requires_specialty_quote?: boolean
          response_method?: string | null
          response_time_seconds?: number | null
          service_type?: string | null
          source: string
          source_detail?: string | null
          specialty_items_detected?: Json
          stale_escalation_sent_at?: string | null
          status?: string
          to_access?: string | null
          to_address?: string | null
          updated_at?: string
          urgency_score?: number
          wrapping_needed?: string | null
        }
        Update: {
          assembly_needed?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          clarifications_needed?: Json
          completeness_path?: string
          completeness_score?: number
          complexity_score?: number
          created_at?: string
          detected_dates?: Json
          detected_service_type?: string | null
          email?: string | null
          estimated_value?: number | null
          external_platform?: string | null
          external_reference?: string | null
          fields_missing?: Json
          fields_present?: Json
          first_name?: string | null
          first_response_at?: string | null
          follow_up_questions?: Json
          follow_up_sent_at?: string | null
          from_access?: string | null
          from_address?: string | null
          has_specialty?: boolean
          how_heard?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          insurance_preference?: string | null
          intelligence_summary?: string | null
          inventory_parse_confidence?: string | null
          last_name?: string | null
          lead_number?: string
          lost_reason?: string | null
          message?: string | null
          move_id?: string | null
          move_size?: string | null
          packing_help?: string | null
          parsed_box_count?: number | null
          parsed_dimensions_text?: string | null
          parsed_inventory?: Json
          parsed_weight_lbs_max?: number | null
          phone?: string | null
          photo_count?: number
          photo_survey_token?: string | null
          photos_requested_at?: string | null
          photos_uploaded_at?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          priority?: string
          priority_reasons?: Json
          quote_uuid?: string | null
          raw_inquiry_text?: string | null
          raw_inventory_text?: string | null
          recommended_tier?: string | null
          referral_detail?: string | null
          referral_source_id?: string | null
          requires_specialty_quote?: boolean
          response_method?: string | null
          response_time_seconds?: number | null
          service_type?: string | null
          source?: string
          source_detail?: string | null
          specialty_items_detected?: Json
          stale_escalation_sent_at?: string | null
          status?: string
          to_access?: string | null
          to_address?: string | null
          updated_at?: string
          urgency_score?: number
          wrapping_needed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_quote_uuid_fkey"
            columns: ["quote_uuid"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referral_source_id_fkey"
            columns: ["referral_source_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_updates: {
        Row: {
          accuracy: number | null
          created_at: string | null
          distance_remaining_meters: number | null
          eta_seconds: number | null
          heading: number | null
          id: string
          is_navigating: boolean | null
          lat: number
          lng: number
          session_id: string
          source: string | null
          speed: number | null
          timestamp: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string | null
          distance_remaining_meters?: number | null
          eta_seconds?: number | null
          heading?: number | null
          id?: string
          is_navigating?: boolean | null
          lat: number
          lng: number
          session_id: string
          source?: string | null
          speed?: number | null
          timestamp?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string | null
          distance_remaining_meters?: number | null
          eta_seconds?: number | null
          heading?: number | null
          id?: string
          is_navigating?: boolean | null
          lat?: number
          lng?: number
          session_id?: string
          source?: string | null
          speed?: number | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_updates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          created_at: string | null
          device: string | null
          id: string
          ip_address: string | null
          location: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_name: string
          sender_type: string | null
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_name: string
          sender_type?: string | null
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_name?: string
          sender_type?: string | null
          thread_id?: string
        }
        Relationships: []
      }
      move_change_requests: {
        Row: {
          charged_at: string | null
          created_at: string
          description: string
          fee_cents: number | null
          id: string
          move_id: string
          payment_charged: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          square_payment_id: string | null
          status: string
          submitted_by: string
          type: string
          urgency: string
        }
        Insert: {
          charged_at?: string | null
          created_at?: string
          description: string
          fee_cents?: number | null
          id?: string
          move_id: string
          payment_charged?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          square_payment_id?: string | null
          status?: string
          submitted_by?: string
          type: string
          urgency?: string
        }
        Update: {
          charged_at?: string | null
          created_at?: string
          description?: string
          fee_cents?: number | null
          id?: string
          move_id?: string
          payment_charged?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          square_payment_id?: string | null
          status?: string
          submitted_by?: string
          type?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_change_requests_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      move_documents: {
        Row: {
          created_at: string
          external_url: string | null
          id: string
          move_id: string
          storage_path: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          id?: string
          move_id: string
          storage_path?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          external_url?: string | null
          id?: string
          move_id?: string
          storage_path?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_documents_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      move_files: {
        Row: {
          category: string | null
          created_at: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          move_id: string
          notes: string | null
          source: string | null
          stage: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          file_name: string
          file_type: string
          file_url: string
          id?: string
          move_id: string
          notes?: string | null
          source?: string | null
          stage?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          move_id?: string
          notes?: string | null
          source?: string | null
          stage?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_files_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      move_inventory: {
        Row: {
          actual_weight_lbs: number | null
          box_number: string | null
          created_at: string
          id: string
          item_name: string
          move_id: string
          room: string
          sort_order: number
          weight_tier_code: string | null
        }
        Insert: {
          actual_weight_lbs?: number | null
          box_number?: string | null
          created_at?: string
          id?: string
          item_name: string
          move_id: string
          room: string
          sort_order?: number
          weight_tier_code?: string | null
        }
        Update: {
          actual_weight_lbs?: number | null
          box_number?: string | null
          created_at?: string
          id?: string
          item_name?: string
          move_id?: string
          room?: string
          sort_order?: number
          weight_tier_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_inventory_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      move_modifications: {
        Row: {
          applied_at: string | null
          approved_at: string | null
          changes: Json
          client_approval_token: string | null
          created_at: string
          id: string
          move_id: string
          new_price: number | null
          original_price: number | null
          price_difference: number | null
          requested_by: string | null
          status: string
          type: string
        }
        Insert: {
          applied_at?: string | null
          approved_at?: string | null
          changes?: Json
          client_approval_token?: string | null
          created_at?: string
          id?: string
          move_id: string
          new_price?: number | null
          original_price?: number | null
          price_difference?: number | null
          requested_by?: string | null
          status?: string
          type: string
        }
        Update: {
          applied_at?: string | null
          approved_at?: string | null
          changes?: Json
          client_approval_token?: string | null
          created_at?: string
          id?: string
          move_id?: string
          new_price?: number | null
          original_price?: number | null
          price_difference?: number | null
          requested_by?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_modifications_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      move_payment_ledger: {
        Row: {
          created_at: string
          entry_type: string
          hst_amount: number
          id: string
          inventory_change_request_id: string | null
          label: string
          move_id: string
          paid_at: string
          pre_tax_amount: number
          settlement_method: string
          square_payment_id: string | null
          square_receipt_url: string | null
        }
        Insert: {
          created_at?: string
          entry_type: string
          hst_amount?: number
          id?: string
          inventory_change_request_id?: string | null
          label: string
          move_id: string
          paid_at?: string
          pre_tax_amount?: number
          settlement_method?: string
          square_payment_id?: string | null
          square_receipt_url?: string | null
        }
        Update: {
          created_at?: string
          entry_type?: string
          hst_amount?: number
          id?: string
          inventory_change_request_id?: string | null
          label?: string
          move_id?: string
          paid_at?: string
          pre_tax_amount?: number
          settlement_method?: string
          square_payment_id?: string | null
          square_receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_payment_ledger_inventory_change_request_id_fkey"
            columns: ["inventory_change_request_id"]
            isOneToOne: false
            referencedRelation: "inventory_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_payment_ledger_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      move_photos: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string | null
          id: string
          move_id: string
          sort_order: number
          source: string
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          move_id: string
          sort_order?: number
          source?: string
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          move_id?: string
          sort_order?: number
          source?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_photos_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      move_project_communications: {
        Row: {
          body_preview: string | null
          channel: string
          comm_type: string
          id: string
          metadata: Json | null
          project_id: string
          recipient_kind: string | null
          sent_at: string
          subject: string | null
        }
        Insert: {
          body_preview?: string | null
          channel?: string
          comm_type: string
          id?: string
          metadata?: Json | null
          project_id: string
          recipient_kind?: string | null
          sent_at?: string
          subject?: string | null
        }
        Update: {
          body_preview?: string | null
          channel?: string
          comm_type?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          recipient_kind?: string | null
          sent_at?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_project_communications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "move_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      move_project_days: {
        Row: {
          arrival_notice_sent: boolean
          arrival_window: string | null
          completed_at: string | null
          completion_notes: string | null
          completion_notice_sent: boolean
          completion_photos: Json
          created_at: string
          crew_assigned: Json
          crew_day_state: Json
          crew_ids: string[] | null
          crew_size: number
          current_stage: string | null
          date: string
          day_cost_estimate: number | null
          day_number: number
          day_type: string
          description: string | null
          destination_address: string | null
          end_time: string | null
          estimated_hours: number | null
          id: string
          issues: string | null
          label: string
          location_address: string | null
          move_id: string | null
          origin_address: string | null
          phase_id: string
          project_id: string
          requires_pod: boolean
          stages: Json
          start_time: string | null
          started_at: string | null
          status: string
          truck_count: number
          truck_type: string | null
        }
        Insert: {
          arrival_notice_sent?: boolean
          arrival_window?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_notice_sent?: boolean
          completion_photos?: Json
          created_at?: string
          crew_assigned?: Json
          crew_day_state?: Json
          crew_ids?: string[] | null
          crew_size?: number
          current_stage?: string | null
          date: string
          day_cost_estimate?: number | null
          day_number: number
          day_type: string
          description?: string | null
          destination_address?: string | null
          end_time?: string | null
          estimated_hours?: number | null
          id?: string
          issues?: string | null
          label: string
          location_address?: string | null
          move_id?: string | null
          origin_address?: string | null
          phase_id: string
          project_id: string
          requires_pod?: boolean
          stages?: Json
          start_time?: string | null
          started_at?: string | null
          status?: string
          truck_count?: number
          truck_type?: string | null
        }
        Update: {
          arrival_notice_sent?: boolean
          arrival_window?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_notice_sent?: boolean
          completion_photos?: Json
          created_at?: string
          crew_assigned?: Json
          crew_day_state?: Json
          crew_ids?: string[] | null
          crew_size?: number
          current_stage?: string | null
          date?: string
          day_cost_estimate?: number | null
          day_number?: number
          day_type?: string
          description?: string | null
          destination_address?: string | null
          end_time?: string | null
          estimated_hours?: number | null
          id?: string
          issues?: string | null
          label?: string
          location_address?: string | null
          move_id?: string | null
          origin_address?: string | null
          phase_id?: string
          project_id?: string
          requires_pod?: boolean
          stages?: Json
          start_time?: string | null
          started_at?: string | null
          status?: string
          truck_count?: number
          truck_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_project_days_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_project_days_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "move_project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_project_days_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "move_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      move_project_phases: {
        Row: {
          created_at: string
          description: string | null
          destination_index: number | null
          end_date: string | null
          id: string
          origin_index: number | null
          phase_name: string
          phase_number: number
          phase_type: string
          project_id: string
          sort_order: number
          start_date: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          destination_index?: number | null
          end_date?: string | null
          id?: string
          origin_index?: number | null
          phase_name: string
          phase_number: number
          phase_type: string
          project_id: string
          sort_order?: number
          start_date?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          destination_index?: number | null
          end_date?: string | null
          id?: string
          origin_index?: number | null
          phase_name?: string
          phase_number?: number
          phase_type?: string
          project_id?: string
          sort_order?: number
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "move_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      move_projects: {
        Row: {
          contact_id: string | null
          coordinator_id: string | null
          coordinator_name: string | null
          created_at: string
          current_day: number
          deposit: number | null
          destinations: Json
          end_date: string | null
          id: string
          internal_notes: string | null
          move_id: string | null
          multi_home_move_type: string | null
          office_profile: Json | null
          origins: Json
          partner_id: string | null
          payment_schedule: Json | null
          project_name: string
          project_type: string
          quote_id: string | null
          special_instructions: string | null
          start_date: string
          status: string
          total_days: number
          total_price: number | null
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          coordinator_id?: string | null
          coordinator_name?: string | null
          created_at?: string
          current_day?: number
          deposit?: number | null
          destinations?: Json
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          move_id?: string | null
          multi_home_move_type?: string | null
          office_profile?: Json | null
          origins?: Json
          partner_id?: string | null
          payment_schedule?: Json | null
          project_name: string
          project_type?: string
          quote_id?: string | null
          special_instructions?: string | null
          start_date: string
          status?: string
          total_days?: number
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          coordinator_id?: string | null
          coordinator_name?: string | null
          created_at?: string
          current_day?: number
          deposit?: number | null
          destinations?: Json
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          move_id?: string | null
          multi_home_move_type?: string | null
          office_profile?: Json | null
          origins?: Json
          partner_id?: string | null
          payment_schedule?: Json | null
          project_name?: string
          project_type?: string
          quote_id?: string | null
          special_instructions?: string | null
          start_date?: string
          status?: string
          total_days?: number
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_projects_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_projects_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_projects_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_projects_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      move_survey_photos: {
        Row: {
          id: string
          move_id: string
          notes: string | null
          photo_url: string
          room: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          move_id: string
          notes?: string | null
          photo_url: string
          room: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          move_id?: string
          notes?: string | null
          photo_url?: string
          room?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_survey_photos_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      move_timeline_events: {
        Row: {
          created_at: string
          event_type: string
          icon: string
          id: string
          label: string
          metadata: Json | null
          move_id: string
          occurred_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          icon?: string
          id?: string
          label: string
          metadata?: Json | null
          move_id: string
          occurred_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          icon?: string
          id?: string
          label?: string
          metadata?: Json | null
          move_id?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_timeline_events_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      move_waivers: {
        Row: {
          category: string
          created_at: string
          crew_recommendation: string | null
          description: string
          id: string
          item_name: string
          move_id: string
          photo_urls: string[]
          reported_by: string | null
          reported_by_name: string | null
          signature_data: string | null
          signed_at: string | null
          signed_by: string | null
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          crew_recommendation?: string | null
          description: string
          id?: string
          item_name: string
          move_id: string
          photo_urls?: string[]
          reported_by?: string | null
          reported_by_name?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          crew_recommendation?: string | null
          description?: string
          id?: string
          item_name?: string
          move_id?: string
          photo_urls?: string[]
          reported_by?: string | null
          reported_by_name?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_waivers_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_waivers_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      moves: {
        Row: {
          access: string | null
          access_notes: string | null
          actual_distance_km: number | null
          actual_fuel_cost: number | null
          actual_labour_cost: number | null
          actual_supplies_cost: number | null
          actual_truck_cost: number | null
          addons: Json | null
          amount: number | null
          anniversary_email_sent: string | null
          arrival_window: string | null
          arrived_on_time: boolean | null
          assembly_items: Json | null
          assembly_minutes: number | null
          assembly_needed: string | null
          assembly_override: boolean | null
          assembly_required: boolean | null
          assigned_crew_name: string | null
          assigned_members: Json | null
          assigned_truck_id: string | null
          auto_scheduled: boolean | null
          auto_scheduled_at: string | null
          balance_amount: number | null
          balance_auto_charged: boolean | null
          balance_method: string | null
          balance_paid_at: string | null
          balance_reminder_48hr_sent: string | null
          balance_reminder_72hr_sent: string | null
          booked_via: string | null
          booking_notes: string | null
          box_estimate: string | null
          building_report_submitted_at: string | null
          business_type: string | null
          calendar_color: string | null
          calendar_status: string | null
          card_last4: string | null
          checklist_token: string | null
          client_box_count: number | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_room_photos: Json | null
          climate_control: boolean | null
          company_name: string | null
          completed_at: string | null
          complexity_indicators: Json | null
          contract_id: string | null
          contract_pdf_url: string | null
          contract_signed: boolean | null
          contract_signed_at: string | null
          coordinator_email: string | null
          coordinator_name: string | null
          coordinator_phone: string | null
          created_at: string | null
          crew_id: string | null
          crew_label: string | null
          crew_members: string | null
          crew_size: number | null
          custom_crating: boolean | null
          declaration_total: number | null
          declared_value: number | null
          dedicated_coordinator: string | null
          delivery_address: string | null
          deposit: string | null
          deposit_amount: number | null
          deposit_method: string | null
          deposit_note: string | null
          deposit_paid: boolean | null
          deposit_paid_at: string | null
          distance_km: number | null
          drive_time_min: number | null
          elevator_reminder_sent_at: string | null
          enhanced_insurance: boolean | null
          est_cost_total: number | null
          est_crew_size: number | null
          est_hours: number | null
          est_margin_percent: number | null
          est_truck_size: string | null
          estate_30day_checkin_sent_at: string | null
          estate_director_name: string | null
          estate_director_phone: string | null
          estate_service_checklist: Json
          estimate: number | null
          estimated_duration_minutes: number | null
          estimated_fuel_cost: number | null
          estimated_fuel_litres: number | null
          estimated_internal_cost: number | null
          eta_current_minutes: number | null
          eta_last_checked_at: string | null
          eta_tracking_active: boolean | null
          event_group_id: string | null
          event_name: string | null
          event_phase: string | null
          extended_checklist_progress: Json
          externally_booked: boolean | null
          final_amount: number | null
          from_access: string | null
          from_address: string
          from_lat: number | null
          from_lng: number | null
          from_long_carry: boolean | null
          from_parking: string | null
          gcal_event_id: string | null
          gps_alert_sent: boolean | null
          gross_profit: number | null
          has_it_equipment: boolean | null
          holding_unit: string | null
          hubspot_deal_id: string | null
          id: string
          internal_notes: string | null
          inventory: string | null
          inventory_items: Json | null
          inventory_score: number | null
          invoice_id: string | null
          invoice_pdf_url: string | null
          is_pm_move: boolean
          item_category: string | null
          item_description: string | null
          item_dimensions: string | null
          item_photo_url: string | null
          item_source: string | null
          item_weight_class: string | null
          items: Json | null
          lead_source: string | null
          linked_move_code: string | null
          linked_move_id: string | null
          margin_alert_minutes: number | null
          margin_flag: string | null
          margin_percent: number | null
          move_code: string | null
          move_number: string
          move_prep_checklist_email_sent_at: string | null
          move_project_id: string | null
          move_size: string | null
          move_type: string
          neighbourhood_tier: string | null
          next_action: string | null
          notes: string | null
          nps_score: number | null
          operational_margin_alert_notified_at: string | null
          operational_schedule_alert_notified_at: string | null
          organization_id: string | null
          packing_service: string | null
          parking_reminder_sent_at: string | null
          partner_property_id: string | null
          payment_marked_paid: boolean | null
          payment_marked_paid_at: string | null
          payment_marked_paid_by: string | null
          pending_inventory_change_request_id: string | null
          perks_email_sent: string | null
          phasing_notes: string | null
          placement_spec: string | null
          pm_building_code: string | null
          pm_move_kind: string | null
          pm_packing_required: boolean
          pm_parent_move_id: string | null
          pm_pricing_source: string | null
          pm_project_id: string | null
          pm_reason_code: string | null
          pm_urgency: string | null
          pm_zone: string | null
          pod_condition: string | null
          pod_photos: Json | null
          pod_signature_url: string | null
          pod_signed_at: string | null
          pod_signed_by_name: string | null
          pre_move_24hr_sent: string | null
          pre_move_72hr_sent: string | null
          pre_move_checklist: Json | null
          pre_move_checklist_notified_at: string | null
          preferred_contact: string | null
          preferred_time: string | null
          project_description: string | null
          project_type: string | null
          quote_id: string | null
          receipt_pdf_url: string | null
          review_request_sent: string | null
          rooms: number | null
          scheduled_date: string
          scheduled_end: string | null
          scheduled_start: string | null
          scheduled_time: string | null
          service_type: string | null
          setup_instructions: string | null
          setup_required: boolean | null
          source_company: string | null
          special_equipment: Json | null
          specialty_item_description: string | null
          specialty_requirements: string[] | null
          specialty_type: string | null
          specialty_weight_class: string | null
          square_card_id: string | null
          square_customer_id: string | null
          square_footage: number | null
          square_payment_id: string | null
          square_receipt_url: string | null
          stage: string | null
          status: string | null
          summary_pdf_url: string | null
          survey_completed: boolean
          survey_flags: Json | null
          survey_token: string | null
          tenant_email: string | null
          tenant_name: string | null
          tenant_phone: string | null
          tenant_present: boolean
          tier: string | null
          tier_ops_snapshot: Json | null
          tier_selected: string | null
          time: string | null
          timing_preference: string | null
          tip_amount: number | null
          tip_charged_at: string | null
          tip_prompt_shown_at: string | null
          tip_skipped_at: string | null
          to_access: string | null
          to_address: string
          to_lat: number | null
          to_lng: number | null
          to_long_carry: boolean | null
          to_parking: string | null
          total_cost: number | null
          total_paid: number | null
          total_price: number | null
          tracking_code: string | null
          truck_info: string | null
          truck_notes: string | null
          truck_override: boolean | null
          truck_primary: string | null
          truck_secondary: string | null
          unit_number: string | null
          updated_at: string | null
          valuation_tier: string | null
          valuation_upgrade_cost: number | null
          venue_address: string | null
          walkthrough_completed: boolean | null
          walkthrough_completed_at: string | null
          walkthrough_crew_member: string | null
          walkthrough_skip_reason: string | null
          walkthrough_skipped: boolean | null
          weather_alert: string | null
          weather_brief: Json | null
          weather_checked_at: string | null
          welcome_package_token: string | null
          workstation_count: number | null
        }
        Insert: {
          access?: string | null
          access_notes?: string | null
          actual_distance_km?: number | null
          actual_fuel_cost?: number | null
          actual_labour_cost?: number | null
          actual_supplies_cost?: number | null
          actual_truck_cost?: number | null
          addons?: Json | null
          amount?: number | null
          anniversary_email_sent?: string | null
          arrival_window?: string | null
          arrived_on_time?: boolean | null
          assembly_items?: Json | null
          assembly_minutes?: number | null
          assembly_needed?: string | null
          assembly_override?: boolean | null
          assembly_required?: boolean | null
          assigned_crew_name?: string | null
          assigned_members?: Json | null
          assigned_truck_id?: string | null
          auto_scheduled?: boolean | null
          auto_scheduled_at?: string | null
          balance_amount?: number | null
          balance_auto_charged?: boolean | null
          balance_method?: string | null
          balance_paid_at?: string | null
          balance_reminder_48hr_sent?: string | null
          balance_reminder_72hr_sent?: string | null
          booked_via?: string | null
          booking_notes?: string | null
          box_estimate?: string | null
          building_report_submitted_at?: string | null
          business_type?: string | null
          calendar_color?: string | null
          calendar_status?: string | null
          card_last4?: string | null
          checklist_token?: string | null
          client_box_count?: number | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_room_photos?: Json | null
          climate_control?: boolean | null
          company_name?: string | null
          completed_at?: string | null
          complexity_indicators?: Json | null
          contract_id?: string | null
          contract_pdf_url?: string | null
          contract_signed?: boolean | null
          contract_signed_at?: string | null
          coordinator_email?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string | null
          crew_id?: string | null
          crew_label?: string | null
          crew_members?: string | null
          crew_size?: number | null
          custom_crating?: boolean | null
          declaration_total?: number | null
          declared_value?: number | null
          dedicated_coordinator?: string | null
          delivery_address?: string | null
          deposit?: string | null
          deposit_amount?: number | null
          deposit_method?: string | null
          deposit_note?: string | null
          deposit_paid?: boolean | null
          deposit_paid_at?: string | null
          distance_km?: number | null
          drive_time_min?: number | null
          elevator_reminder_sent_at?: string | null
          enhanced_insurance?: boolean | null
          est_cost_total?: number | null
          est_crew_size?: number | null
          est_hours?: number | null
          est_margin_percent?: number | null
          est_truck_size?: string | null
          estate_30day_checkin_sent_at?: string | null
          estate_director_name?: string | null
          estate_director_phone?: string | null
          estate_service_checklist?: Json
          estimate?: number | null
          estimated_duration_minutes?: number | null
          estimated_fuel_cost?: number | null
          estimated_fuel_litres?: number | null
          estimated_internal_cost?: number | null
          eta_current_minutes?: number | null
          eta_last_checked_at?: string | null
          eta_tracking_active?: boolean | null
          event_group_id?: string | null
          event_name?: string | null
          event_phase?: string | null
          extended_checklist_progress?: Json
          externally_booked?: boolean | null
          final_amount?: number | null
          from_access?: string | null
          from_address: string
          from_lat?: number | null
          from_lng?: number | null
          from_long_carry?: boolean | null
          from_parking?: string | null
          gcal_event_id?: string | null
          gps_alert_sent?: boolean | null
          gross_profit?: number | null
          has_it_equipment?: boolean | null
          holding_unit?: string | null
          hubspot_deal_id?: string | null
          id?: string
          internal_notes?: string | null
          inventory?: string | null
          inventory_items?: Json | null
          inventory_score?: number | null
          invoice_id?: string | null
          invoice_pdf_url?: string | null
          is_pm_move?: boolean
          item_category?: string | null
          item_description?: string | null
          item_dimensions?: string | null
          item_photo_url?: string | null
          item_source?: string | null
          item_weight_class?: string | null
          items?: Json | null
          lead_source?: string | null
          linked_move_code?: string | null
          linked_move_id?: string | null
          margin_alert_minutes?: number | null
          margin_flag?: string | null
          margin_percent?: number | null
          move_code?: string | null
          move_number: string
          move_prep_checklist_email_sent_at?: string | null
          move_project_id?: string | null
          move_size?: string | null
          move_type: string
          neighbourhood_tier?: string | null
          next_action?: string | null
          notes?: string | null
          nps_score?: number | null
          operational_margin_alert_notified_at?: string | null
          operational_schedule_alert_notified_at?: string | null
          organization_id?: string | null
          packing_service?: string | null
          parking_reminder_sent_at?: string | null
          partner_property_id?: string | null
          payment_marked_paid?: boolean | null
          payment_marked_paid_at?: string | null
          payment_marked_paid_by?: string | null
          pending_inventory_change_request_id?: string | null
          perks_email_sent?: string | null
          phasing_notes?: string | null
          placement_spec?: string | null
          pm_building_code?: string | null
          pm_move_kind?: string | null
          pm_packing_required?: boolean
          pm_parent_move_id?: string | null
          pm_pricing_source?: string | null
          pm_project_id?: string | null
          pm_reason_code?: string | null
          pm_urgency?: string | null
          pm_zone?: string | null
          pod_condition?: string | null
          pod_photos?: Json | null
          pod_signature_url?: string | null
          pod_signed_at?: string | null
          pod_signed_by_name?: string | null
          pre_move_24hr_sent?: string | null
          pre_move_72hr_sent?: string | null
          pre_move_checklist?: Json | null
          pre_move_checklist_notified_at?: string | null
          preferred_contact?: string | null
          preferred_time?: string | null
          project_description?: string | null
          project_type?: string | null
          quote_id?: string | null
          receipt_pdf_url?: string | null
          review_request_sent?: string | null
          rooms?: number | null
          scheduled_date: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          scheduled_time?: string | null
          service_type?: string | null
          setup_instructions?: string | null
          setup_required?: boolean | null
          source_company?: string | null
          special_equipment?: Json | null
          specialty_item_description?: string | null
          specialty_requirements?: string[] | null
          specialty_type?: string | null
          specialty_weight_class?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_footage?: number | null
          square_payment_id?: string | null
          square_receipt_url?: string | null
          stage?: string | null
          status?: string | null
          summary_pdf_url?: string | null
          survey_completed?: boolean
          survey_flags?: Json | null
          survey_token?: string | null
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          tenant_present?: boolean
          tier?: string | null
          tier_ops_snapshot?: Json | null
          tier_selected?: string | null
          time?: string | null
          timing_preference?: string | null
          tip_amount?: number | null
          tip_charged_at?: string | null
          tip_prompt_shown_at?: string | null
          tip_skipped_at?: string | null
          to_access?: string | null
          to_address: string
          to_lat?: number | null
          to_lng?: number | null
          to_long_carry?: boolean | null
          to_parking?: string | null
          total_cost?: number | null
          total_paid?: number | null
          total_price?: number | null
          tracking_code?: string | null
          truck_info?: string | null
          truck_notes?: string | null
          truck_override?: boolean | null
          truck_primary?: string | null
          truck_secondary?: string | null
          unit_number?: string | null
          updated_at?: string | null
          valuation_tier?: string | null
          valuation_upgrade_cost?: number | null
          venue_address?: string | null
          walkthrough_completed?: boolean | null
          walkthrough_completed_at?: string | null
          walkthrough_crew_member?: string | null
          walkthrough_skip_reason?: string | null
          walkthrough_skipped?: boolean | null
          weather_alert?: string | null
          weather_brief?: Json | null
          weather_checked_at?: string | null
          welcome_package_token?: string | null
          workstation_count?: number | null
        }
        Update: {
          access?: string | null
          access_notes?: string | null
          actual_distance_km?: number | null
          actual_fuel_cost?: number | null
          actual_labour_cost?: number | null
          actual_supplies_cost?: number | null
          actual_truck_cost?: number | null
          addons?: Json | null
          amount?: number | null
          anniversary_email_sent?: string | null
          arrival_window?: string | null
          arrived_on_time?: boolean | null
          assembly_items?: Json | null
          assembly_minutes?: number | null
          assembly_needed?: string | null
          assembly_override?: boolean | null
          assembly_required?: boolean | null
          assigned_crew_name?: string | null
          assigned_members?: Json | null
          assigned_truck_id?: string | null
          auto_scheduled?: boolean | null
          auto_scheduled_at?: string | null
          balance_amount?: number | null
          balance_auto_charged?: boolean | null
          balance_method?: string | null
          balance_paid_at?: string | null
          balance_reminder_48hr_sent?: string | null
          balance_reminder_72hr_sent?: string | null
          booked_via?: string | null
          booking_notes?: string | null
          box_estimate?: string | null
          building_report_submitted_at?: string | null
          business_type?: string | null
          calendar_color?: string | null
          calendar_status?: string | null
          card_last4?: string | null
          checklist_token?: string | null
          client_box_count?: number | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_room_photos?: Json | null
          climate_control?: boolean | null
          company_name?: string | null
          completed_at?: string | null
          complexity_indicators?: Json | null
          contract_id?: string | null
          contract_pdf_url?: string | null
          contract_signed?: boolean | null
          contract_signed_at?: string | null
          coordinator_email?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string | null
          crew_id?: string | null
          crew_label?: string | null
          crew_members?: string | null
          crew_size?: number | null
          custom_crating?: boolean | null
          declaration_total?: number | null
          declared_value?: number | null
          dedicated_coordinator?: string | null
          delivery_address?: string | null
          deposit?: string | null
          deposit_amount?: number | null
          deposit_method?: string | null
          deposit_note?: string | null
          deposit_paid?: boolean | null
          deposit_paid_at?: string | null
          distance_km?: number | null
          drive_time_min?: number | null
          elevator_reminder_sent_at?: string | null
          enhanced_insurance?: boolean | null
          est_cost_total?: number | null
          est_crew_size?: number | null
          est_hours?: number | null
          est_margin_percent?: number | null
          est_truck_size?: string | null
          estate_30day_checkin_sent_at?: string | null
          estate_director_name?: string | null
          estate_director_phone?: string | null
          estate_service_checklist?: Json
          estimate?: number | null
          estimated_duration_minutes?: number | null
          estimated_fuel_cost?: number | null
          estimated_fuel_litres?: number | null
          estimated_internal_cost?: number | null
          eta_current_minutes?: number | null
          eta_last_checked_at?: string | null
          eta_tracking_active?: boolean | null
          event_group_id?: string | null
          event_name?: string | null
          event_phase?: string | null
          extended_checklist_progress?: Json
          externally_booked?: boolean | null
          final_amount?: number | null
          from_access?: string | null
          from_address?: string
          from_lat?: number | null
          from_lng?: number | null
          from_long_carry?: boolean | null
          from_parking?: string | null
          gcal_event_id?: string | null
          gps_alert_sent?: boolean | null
          gross_profit?: number | null
          has_it_equipment?: boolean | null
          holding_unit?: string | null
          hubspot_deal_id?: string | null
          id?: string
          internal_notes?: string | null
          inventory?: string | null
          inventory_items?: Json | null
          inventory_score?: number | null
          invoice_id?: string | null
          invoice_pdf_url?: string | null
          is_pm_move?: boolean
          item_category?: string | null
          item_description?: string | null
          item_dimensions?: string | null
          item_photo_url?: string | null
          item_source?: string | null
          item_weight_class?: string | null
          items?: Json | null
          lead_source?: string | null
          linked_move_code?: string | null
          linked_move_id?: string | null
          margin_alert_minutes?: number | null
          margin_flag?: string | null
          margin_percent?: number | null
          move_code?: string | null
          move_number?: string
          move_prep_checklist_email_sent_at?: string | null
          move_project_id?: string | null
          move_size?: string | null
          move_type?: string
          neighbourhood_tier?: string | null
          next_action?: string | null
          notes?: string | null
          nps_score?: number | null
          operational_margin_alert_notified_at?: string | null
          operational_schedule_alert_notified_at?: string | null
          organization_id?: string | null
          packing_service?: string | null
          parking_reminder_sent_at?: string | null
          partner_property_id?: string | null
          payment_marked_paid?: boolean | null
          payment_marked_paid_at?: string | null
          payment_marked_paid_by?: string | null
          pending_inventory_change_request_id?: string | null
          perks_email_sent?: string | null
          phasing_notes?: string | null
          placement_spec?: string | null
          pm_building_code?: string | null
          pm_move_kind?: string | null
          pm_packing_required?: boolean
          pm_parent_move_id?: string | null
          pm_pricing_source?: string | null
          pm_project_id?: string | null
          pm_reason_code?: string | null
          pm_urgency?: string | null
          pm_zone?: string | null
          pod_condition?: string | null
          pod_photos?: Json | null
          pod_signature_url?: string | null
          pod_signed_at?: string | null
          pod_signed_by_name?: string | null
          pre_move_24hr_sent?: string | null
          pre_move_72hr_sent?: string | null
          pre_move_checklist?: Json | null
          pre_move_checklist_notified_at?: string | null
          preferred_contact?: string | null
          preferred_time?: string | null
          project_description?: string | null
          project_type?: string | null
          quote_id?: string | null
          receipt_pdf_url?: string | null
          review_request_sent?: string | null
          rooms?: number | null
          scheduled_date?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          scheduled_time?: string | null
          service_type?: string | null
          setup_instructions?: string | null
          setup_required?: boolean | null
          source_company?: string | null
          special_equipment?: Json | null
          specialty_item_description?: string | null
          specialty_requirements?: string[] | null
          specialty_type?: string | null
          specialty_weight_class?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_footage?: number | null
          square_payment_id?: string | null
          square_receipt_url?: string | null
          stage?: string | null
          status?: string | null
          summary_pdf_url?: string | null
          survey_completed?: boolean
          survey_flags?: Json | null
          survey_token?: string | null
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          tenant_present?: boolean
          tier?: string | null
          tier_ops_snapshot?: Json | null
          tier_selected?: string | null
          time?: string | null
          timing_preference?: string | null
          tip_amount?: number | null
          tip_charged_at?: string | null
          tip_prompt_shown_at?: string | null
          tip_skipped_at?: string | null
          to_access?: string | null
          to_address?: string
          to_lat?: number | null
          to_lng?: number | null
          to_long_carry?: boolean | null
          to_parking?: string | null
          total_cost?: number | null
          total_paid?: number | null
          total_price?: number | null
          tracking_code?: string | null
          truck_info?: string | null
          truck_notes?: string | null
          truck_override?: boolean | null
          truck_primary?: string | null
          truck_secondary?: string | null
          unit_number?: string | null
          updated_at?: string | null
          valuation_tier?: string | null
          valuation_upgrade_cost?: number | null
          venue_address?: string | null
          walkthrough_completed?: boolean | null
          walkthrough_completed_at?: string | null
          walkthrough_crew_member?: string | null
          walkthrough_skip_reason?: string | null
          walkthrough_skipped?: boolean | null
          weather_alert?: string | null
          weather_brief?: Json | null
          weather_checked_at?: string | null
          welcome_package_token?: string | null
          workstation_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "moves_assigned_truck_id_fkey"
            columns: ["assigned_truck_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "partner_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_linked_move_id_fkey"
            columns: ["linked_move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_move_project_id_fkey"
            columns: ["move_project_id"]
            isOneToOne: false
            referencedRelation: "move_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_partner_property_id_fkey"
            columns: ["partner_property_id"]
            isOneToOne: false
            referencedRelation: "partner_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_pending_inventory_change_request_id_fkey"
            columns: ["pending_inventory_change_request_id"]
            isOneToOne: false
            referencedRelation: "inventory_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_pm_parent_move_id_fkey"
            columns: ["pm_parent_move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_pm_project_id_fkey"
            columns: ["pm_project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      neighbourhood_tiers: {
        Row: {
          avg_income_bracket: string | null
          created_at: string
          id: string
          multiplier: number | null
          neighbourhood_name: string | null
          notes: string | null
          postal_prefix: string
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          avg_income_bracket?: string | null
          created_at?: string
          id?: string
          multiplier?: number | null
          neighbourhood_name?: string | null
          notes?: string | null
          postal_prefix: string
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          avg_income_bracket?: string | null
          created_at?: string
          id?: string
          multiplier?: number | null
          neighbourhood_name?: string | null
          notes?: string | null
          postal_prefix?: string
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          category: string
          created_at: string | null
          description: string
          display_order: number | null
          event_name: string
          event_slug: string
          id: string
          supports_email: boolean | null
          supports_push: boolean | null
          supports_sms: boolean | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          display_order?: number | null
          event_name: string
          event_slug: string
          id?: string
          supports_email?: boolean | null
          supports_push?: boolean | null
          supports_sms?: boolean | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          display_order?: number | null
          event_name?: string
          event_slug?: string
          id?: string
          supports_email?: boolean | null
          supports_push?: boolean | null
          supports_sms?: boolean | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          event: string | null
          id: string
          job_id: string | null
          job_type: string | null
          message: string | null
          recipient_email: string | null
          recipient_phone: string | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          event?: string | null
          id?: string
          job_id?: string | null
          job_type?: string | null
          message?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          event?: string | null
          id?: string
          job_id?: string | null
          job_type?: string | null
          message?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          status?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          event_slug: string
          id: string
          push_enabled: boolean | null
          sms_enabled: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          event_slug: string
          id?: string
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          event_slug?: string
          id?: string
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_event_slug_fkey"
            columns: ["event_slug"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["event_slug"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      office_rates: {
        Row: {
          created_at: string
          id: string
          parameter: string
          unit: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          parameter: string
          unit: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          parameter?: string
          unit?: string
          value?: number
        }
        Relationships: []
      }
      organizations: {
        Row: {
          activated_at: string | null
          address: string | null
          billing_anchor_day: number | null
          billing_email: string | null
          billing_enabled: boolean
          billing_method: string | null
          billing_terms: string | null
          billing_terms_days: number
          card_brand: string | null
          card_last_four: string | null
          card_on_file: boolean
          contact_name: string | null
          contact_title: string | null
          created_at: string | null
          customer_notification_message: string | null
          customer_notifications_enabled: boolean | null
          default_pickup_address: string | null
          default_pickup_lat: number | null
          default_pickup_lng: number | null
          deliveries_per_month: number | null
          delivery_frequency: string | null
          delivery_types: string[] | null
          email: string | null
          global_discount_pct: number | null
          health: string | null
          how_found: string | null
          hubspot_contact_id: string | null
          hubspot_deal_id: string | null
          id: string
          insurance_cert_required: boolean | null
          insurance_cert_url: string | null
          invoice_due_day_of_month: number | null
          invoice_due_days: number | null
          last_delivery_at: string | null
          legal_name: string | null
          name: string
          notes: string | null
          onboarding_status: string | null
          outstanding_balance: number | null
          partner_coordinator_email: string | null
          partner_coordinator_name: string | null
          partner_coordinator_phone: string | null
          payment_term_days: number | null
          payment_terms: string | null
          phone: string | null
          pickup_locations: string[] | null
          portal_features: Json | null
          preferred_windows: string | null
          pricing_tier: string | null
          rates_locked: boolean | null
          referral_source: string | null
          special_requirements: string | null
          square_card_id: string | null
          square_customer_id: string | null
          tax_id: string | null
          template_id: string | null
          type: string
          typical_items: string | null
          updated_at: string | null
          user_id: string | null
          vertical: string | null
        }
        Insert: {
          activated_at?: string | null
          address?: string | null
          billing_anchor_day?: number | null
          billing_email?: string | null
          billing_enabled?: boolean
          billing_method?: string | null
          billing_terms?: string | null
          billing_terms_days?: number
          card_brand?: string | null
          card_last_four?: string | null
          card_on_file?: boolean
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string | null
          customer_notification_message?: string | null
          customer_notifications_enabled?: boolean | null
          default_pickup_address?: string | null
          default_pickup_lat?: number | null
          default_pickup_lng?: number | null
          deliveries_per_month?: number | null
          delivery_frequency?: string | null
          delivery_types?: string[] | null
          email?: string | null
          global_discount_pct?: number | null
          health?: string | null
          how_found?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          insurance_cert_required?: boolean | null
          insurance_cert_url?: string | null
          invoice_due_day_of_month?: number | null
          invoice_due_days?: number | null
          last_delivery_at?: string | null
          legal_name?: string | null
          name: string
          notes?: string | null
          onboarding_status?: string | null
          outstanding_balance?: number | null
          partner_coordinator_email?: string | null
          partner_coordinator_name?: string | null
          partner_coordinator_phone?: string | null
          payment_term_days?: number | null
          payment_terms?: string | null
          phone?: string | null
          pickup_locations?: string[] | null
          portal_features?: Json | null
          preferred_windows?: string | null
          pricing_tier?: string | null
          rates_locked?: boolean | null
          referral_source?: string | null
          special_requirements?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          tax_id?: string | null
          template_id?: string | null
          type: string
          typical_items?: string | null
          updated_at?: string | null
          user_id?: string | null
          vertical?: string | null
        }
        Update: {
          activated_at?: string | null
          address?: string | null
          billing_anchor_day?: number | null
          billing_email?: string | null
          billing_enabled?: boolean
          billing_method?: string | null
          billing_terms?: string | null
          billing_terms_days?: number
          card_brand?: string | null
          card_last_four?: string | null
          card_on_file?: boolean
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string | null
          customer_notification_message?: string | null
          customer_notifications_enabled?: boolean | null
          default_pickup_address?: string | null
          default_pickup_lat?: number | null
          default_pickup_lng?: number | null
          deliveries_per_month?: number | null
          delivery_frequency?: string | null
          delivery_types?: string[] | null
          email?: string | null
          global_discount_pct?: number | null
          health?: string | null
          how_found?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          insurance_cert_required?: boolean | null
          insurance_cert_url?: string | null
          invoice_due_day_of_month?: number | null
          invoice_due_days?: number | null
          last_delivery_at?: string | null
          legal_name?: string | null
          name?: string
          notes?: string | null
          onboarding_status?: string | null
          outstanding_balance?: number | null
          partner_coordinator_email?: string | null
          partner_coordinator_name?: string | null
          partner_coordinator_phone?: string | null
          payment_term_days?: number | null
          payment_terms?: string | null
          phone?: string | null
          pickup_locations?: string[] | null
          portal_features?: Json | null
          preferred_windows?: string | null
          pricing_tier?: string | null
          rates_locked?: boolean | null
          referral_source?: string | null
          special_requirements?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          tax_id?: string | null
          template_id?: string | null
          type?: string
          typical_items?: string | null
          updated_at?: string | null
          user_id?: string | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contracts: {
        Row: {
          auto_renew: boolean
          cancellation_notice_days: number
          contract_number: string
          contract_type: string
          created_at: string
          day_rate: number | null
          days_per_week: number | null
          end_date: string
          estimated_annual_value: number | null
          estimated_total_value: number | null
          id: string
          partner_id: string
          payment_terms: string
          pdf_url: string | null
          rate_card: Json | null
          rate_lock_months: number
          signed_at: string | null
          signed_by: string | null
          start_date: string
          status: string
          tenant_comms_by: string
        }
        Insert: {
          auto_renew?: boolean
          cancellation_notice_days?: number
          contract_number: string
          contract_type: string
          created_at?: string
          day_rate?: number | null
          days_per_week?: number | null
          end_date: string
          estimated_annual_value?: number | null
          estimated_total_value?: number | null
          id?: string
          partner_id: string
          payment_terms?: string
          pdf_url?: string | null
          rate_card?: Json | null
          rate_lock_months?: number
          signed_at?: string | null
          signed_by?: string | null
          start_date: string
          status?: string
          tenant_comms_by?: string
        }
        Update: {
          auto_renew?: boolean
          cancellation_notice_days?: number
          contract_number?: string
          contract_type?: string
          created_at?: string
          day_rate?: number | null
          days_per_week?: number | null
          end_date?: string
          estimated_annual_value?: number | null
          estimated_total_value?: number | null
          id?: string
          partner_id?: string
          payment_terms?: string
          pdf_url?: string | null
          rate_card?: Json | null
          rate_lock_months?: number
          signed_at?: string | null
          signed_by?: string | null
          start_date?: string
          status?: string
          tenant_comms_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_contracts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          square_invoice_id: string | null
          square_invoice_url: string | null
          status: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          square_invoice_id?: string | null
          square_invoice_url?: string | null
          status?: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          square_invoice_id?: string | null
          square_invoice_url?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          delivery_id: string | null
          icon: string | null
          id: string
          link: string | null
          org_id: string
          read: boolean | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          delivery_id?: string | null
          icon?: string | null
          id?: string
          link?: string | null
          org_id: string
          read?: boolean | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          delivery_id?: string | null
          icon?: string | null
          id?: string
          link?: string | null
          org_id?: string
          read?: boolean | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_notifications_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_perks: {
        Row: {
          created_at: string | null
          current_redemptions: number | null
          description: string | null
          discount_value: number | null
          display_order: number | null
          id: string
          is_active: boolean | null
          max_redemptions: number | null
          offer_type: string
          partner_id: string | null
          redemption_code: string | null
          redemption_url: string | null
          title: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          current_redemptions?: number | null
          description?: string | null
          discount_value?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
          offer_type: string
          partner_id?: string | null
          redemption_code?: string | null
          redemption_url?: string | null
          title: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          current_redemptions?: number | null
          description?: string | null
          discount_value?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
          offer_type?: string
          partner_id?: string | null
          redemption_code?: string | null
          redemption_url?: string | null
          title?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_perks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_properties: {
        Row: {
          active: boolean
          address: string
          building_contact_name: string | null
          building_contact_phone: string | null
          building_name: string
          created_at: string
          elevator_type: string | null
          has_loading_dock: boolean
          has_move_elevator: boolean
          id: string
          move_hours: string | null
          notes: string | null
          parking_type: string | null
          partner_id: string
          postal_code: string | null
          service_region: string
          total_units: number | null
          unit_types: string[] | null
        }
        Insert: {
          active?: boolean
          address: string
          building_contact_name?: string | null
          building_contact_phone?: string | null
          building_name: string
          created_at?: string
          elevator_type?: string | null
          has_loading_dock?: boolean
          has_move_elevator?: boolean
          id?: string
          move_hours?: string | null
          notes?: string | null
          parking_type?: string | null
          partner_id: string
          postal_code?: string | null
          service_region?: string
          total_units?: number | null
          unit_types?: string[] | null
        }
        Update: {
          active?: boolean
          address?: string
          building_contact_name?: string | null
          building_contact_phone?: string | null
          building_name?: string
          created_at?: string
          elevator_type?: string | null
          has_loading_dock?: boolean
          has_move_elevator?: boolean
          id?: string
          move_hours?: string | null
          notes?: string | null
          parking_type?: string | null
          partner_id?: string
          postal_code?: string | null
          service_region?: string
          total_units?: number | null
          unit_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_properties_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_rate_cards: {
        Row: {
          card_name: string
          created_at: string | null
          created_by: string | null
          effective_date: string
          expiry_date: string | null
          id: string
          is_active: boolean | null
          organization_id: string
        }
        Insert: {
          card_name?: string
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
        }
        Update: {
          card_name?: string
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_rate_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_rate_overrides: {
        Row: {
          created_at: string | null
          id: string
          is_locked: boolean | null
          notes: string | null
          override_field: string
          override_value: number
          partner_id: string
          rate_record_id: string
          rate_table: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          override_field: string
          override_value: number
          partner_id: string
          rate_record_id: string
          rate_table: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          override_field?: string
          override_value?: number
          partner_id?: string
          rate_record_id?: string
          rate_table?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_rate_overrides_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_statements: {
        Row: {
          created_at: string | null
          deliveries: Json | null
          delivery_count: number | null
          due_date: string
          hst: number | null
          id: string
          paid_amount: number | null
          paid_at: string | null
          partner_id: string
          payment_terms: string
          pdf_url: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          square_invoice_id: string | null
          statement_number: string
          status: string | null
          subtotal: number | null
          total: number | null
        }
        Insert: {
          created_at?: string | null
          deliveries?: Json | null
          delivery_count?: number | null
          due_date: string
          hst?: number | null
          id?: string
          paid_amount?: number | null
          paid_at?: string | null
          partner_id: string
          payment_terms: string
          pdf_url?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          square_invoice_id?: string | null
          statement_number: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
        }
        Update: {
          created_at?: string | null
          deliveries?: Json | null
          delivery_count?: number | null
          due_date?: string
          hst?: number | null
          id?: string
          paid_amount?: number | null
          paid_at?: string | null
          partner_id?: string
          payment_terms?: string
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          square_invoice_id?: string | null
          statement_number?: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_statements_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_users: {
        Row: {
          created_at: string
          first_login_at: string | null
          id: string
          last_login_at: string | null
          login_count: number | null
          org_id: string
          password_changed: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          first_login_at?: string | null
          id?: string
          last_login_at?: string | null
          login_count?: number | null
          org_id: string
          password_changed?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          first_login_at?: string | null
          id?: string
          last_login_at?: string | null
          login_count?: number | null
          org_id?: string
          password_changed?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_vertical_rates: {
        Row: {
          active: boolean
          created_at: string
          custom_rates: Json
          id: string
          organization_id: string
          vertical_code: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          custom_rates?: Json
          id?: string
          organization_id: string
          vertical_code: string
        }
        Update: {
          active?: boolean
          created_at?: string
          custom_rates?: Json
          id?: string
          organization_id?: string
          vertical_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_vertical_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_vertical_rates_vertical_code_fkey"
            columns: ["vertical_code"]
            isOneToOne: false
            referencedRelation: "delivery_verticals"
            referencedColumns: ["code"]
          },
        ]
      }
      perk_redemptions: {
        Row: {
          client_email: string
          created_at: string
          id: string
          move_id: string | null
          perk_id: string
          redeemed_at: string | null
        }
        Insert: {
          client_email: string
          created_at?: string
          id?: string
          move_id?: string | null
          perk_id: string
          redeemed_at?: string | null
        }
        Update: {
          client_email?: string
          created_at?: string
          id?: string
          move_id?: string | null
          perk_id?: string
          redeemed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perk_redemptions_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perk_redemptions_perk_id_fkey"
            columns: ["perk_id"]
            isOneToOne: false
            referencedRelation: "partner_perks"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_surveys: {
        Row: {
          ai_analyzed: boolean
          ai_suggestions: Json | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          coordinator_name: string | null
          coordinator_phone: string | null
          created_at: string
          from_address: string | null
          id: string
          lead_id: string
          move_size: string | null
          photos: Json
          reviewed_at: string | null
          reviewed_by: string | null
          special_notes: string | null
          status: string
          submitted_at: string | null
          token: string
          total_photos: number
        }
        Insert: {
          ai_analyzed?: boolean
          ai_suggestions?: Json | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string
          from_address?: string | null
          id?: string
          lead_id: string
          move_size?: string | null
          photos?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          special_notes?: string | null
          status?: string
          submitted_at?: string | null
          token: string
          total_photos?: number
        }
        Update: {
          ai_analyzed?: boolean
          ai_suggestions?: Json | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string
          from_address?: string | null
          id?: string
          lead_id?: string
          move_size?: string | null
          photos?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          special_notes?: string | null
          status?: string
          submitted_at?: string | null
          token?: string
          total_photos?: number
        }
        Relationships: [
          {
            foreignKeyName: "photo_surveys_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          section: string | null
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          section?: string | null
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          section?: string | null
          value?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          auto_invoicing: boolean
          created_at: string
          crew_tracking: boolean
          id: string
          partner_portal: boolean
          readiness_items: Json | null
          updated_at: string
        }
        Insert: {
          auto_invoicing?: boolean
          created_at?: string
          crew_tracking?: boolean
          id?: string
          partner_portal?: boolean
          readiness_items?: Json | null
          updated_at?: string
        }
        Update: {
          auto_invoicing?: boolean
          created_at?: string
          crew_tracking?: boolean
          id?: string
          partner_portal?: boolean
          readiness_items?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_users: {
        Row: {
          created_at: string
          email: string
          id: string
          max_open_leads: number
          name: string | null
          on_vacation: boolean
          out_of_office: boolean
          phone: string | null
          role: string
          specializations: string[] | null
          two_factor_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          max_open_leads?: number
          name?: string | null
          on_vacation?: boolean
          out_of_office?: boolean
          phone?: string | null
          role?: string
          specializations?: string[] | null
          two_factor_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          max_open_leads?: number
          name?: string | null
          on_vacation?: boolean
          out_of_office?: boolean
          phone?: string | null
          role?: string
          specializations?: string[] | null
          two_factor_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pm_contract_addons: {
        Row: {
          active: boolean
          addon_code: string
          contract_id: string
          id: string
          label: string
          price: number
          price_type: string
        }
        Insert: {
          active?: boolean
          addon_code: string
          contract_id: string
          id?: string
          label: string
          price: number
          price_type?: string
        }
        Update: {
          active?: boolean
          addon_code?: string
          contract_id?: string
          id?: string
          label?: string
          price?: number
          price_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_contract_addons_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_contract_reason_codes: {
        Row: {
          active: boolean
          contract_id: string
          reason_code: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          contract_id: string
          reason_code: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          contract_id?: string
          reason_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pm_contract_reason_codes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_move_reasons: {
        Row: {
          active: boolean
          created_at: string
          default_destination: string
          default_origin: string
          description: string | null
          id: string
          is_round_trip: boolean
          label: string
          partner_id: string | null
          reason_code: string
          requires_return_move: boolean
          sort_order: number
          urgency_default: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_destination?: string
          default_origin?: string
          description?: string | null
          id?: string
          is_round_trip?: boolean
          label: string
          partner_id?: string | null
          reason_code: string
          requires_return_move?: boolean
          sort_order?: number
          urgency_default?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_destination?: string
          default_origin?: string
          description?: string | null
          id?: string
          is_round_trip?: boolean
          label?: string
          partner_id?: string | null
          reason_code?: string
          requires_return_move?: boolean
          sort_order?: number
          urgency_default?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_move_reasons_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_partner_move_reason_disable: {
        Row: {
          created_at: string
          partner_id: string
          reason_code: string
        }
        Insert: {
          created_at?: string
          partner_id: string
          reason_code: string
        }
        Update: {
          created_at?: string
          partner_id?: string
          reason_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_partner_move_reason_disable_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_project_units: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          outbound_date: string | null
          outbound_move_id: string | null
          project_id: string
          return_date: string | null
          return_move_id: string | null
          status: string
          tenant_email: string | null
          tenant_name: string | null
          tenant_phone: string | null
          unit_number: string
          unit_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          outbound_date?: string | null
          outbound_move_id?: string | null
          project_id: string
          return_date?: string | null
          return_move_id?: string | null
          status?: string
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          unit_number: string
          unit_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          outbound_date?: string | null
          outbound_move_id?: string | null
          project_id?: string
          return_date?: string | null
          return_move_id?: string | null
          status?: string
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          unit_number?: string
          unit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_project_units_outbound_move_id_fkey"
            columns: ["outbound_move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_project_units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_project_units_return_move_id_fkey"
            columns: ["return_move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_projects: {
        Row: {
          contract_id: string | null
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          partner_id: string
          project_name: string
          project_type: string
          property_id: string | null
          start_date: string | null
          status: string
          total_units: number | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_id: string
          project_name: string
          project_type?: string
          property_id?: string | null
          start_date?: string | null
          status?: string
          total_units?: number | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_id?: string
          project_name?: string
          project_type?: string
          property_id?: string | null
          start_date?: string | null
          status?: string
          total_units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_projects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "partner_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_rate_cards: {
        Row: {
          active: boolean
          after_hours_premium: number
          base_rate: number
          contract_id: string
          created_at: string
          crew_count: number | null
          estimated_hours: number | null
          holiday_surcharge: number
          id: string
          reason_code: string
          truck_type: string | null
          unit_size: string
          weekend_surcharge: number
          zone: string
        }
        Insert: {
          active?: boolean
          after_hours_premium?: number
          base_rate: number
          contract_id: string
          created_at?: string
          crew_count?: number | null
          estimated_hours?: number | null
          holiday_surcharge?: number
          id?: string
          reason_code: string
          truck_type?: string | null
          unit_size: string
          weekend_surcharge?: number
          zone?: string
        }
        Update: {
          active?: boolean
          after_hours_premium?: number
          base_rate?: number
          contract_id?: string
          created_at?: string
          crew_count?: number | null
          estimated_hours?: number | null
          holiday_surcharge?: number
          id?: string
          reason_code?: string
          truck_type?: string | null
          unit_size?: string
          weekend_surcharge?: number
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_rate_cards_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      project_inventory: {
        Row: {
          condition_on_receipt: string | null
          created_at: string | null
          delivered_date: string | null
          delivery_photo_url: string | null
          description: string | null
          expected_delivery_date: string | null
          handled_by: string | null
          id: string
          inspection_notes: string | null
          item_dimensions: string | null
          item_name: string
          item_status: string | null
          item_value: number | null
          phase_id: string | null
          photo_urls: string[] | null
          pickup_photo_url: string | null
          placement_notes: string | null
          project_id: string
          quantity: number | null
          received_by: string | null
          received_date: string | null
          requires_assembly: boolean | null
          requires_crating: boolean | null
          room_destination: string | null
          special_handling_notes: string | null
          status: string | null
          status_notes: string | null
          status_updated_at: string | null
          storage_location: string | null
          vendor: string | null
          vendor_carrier: string | null
          vendor_contact_email: string | null
          vendor_contact_name: string | null
          vendor_contact_phone: string | null
          vendor_delivery_method: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_order_number: string | null
          vendor_pickup_address: string | null
          vendor_pickup_window: string | null
          vendor_tracking_number: string | null
        }
        Insert: {
          condition_on_receipt?: string | null
          created_at?: string | null
          delivered_date?: string | null
          delivery_photo_url?: string | null
          description?: string | null
          expected_delivery_date?: string | null
          handled_by?: string | null
          id?: string
          inspection_notes?: string | null
          item_dimensions?: string | null
          item_name: string
          item_status?: string | null
          item_value?: number | null
          phase_id?: string | null
          photo_urls?: string[] | null
          pickup_photo_url?: string | null
          placement_notes?: string | null
          project_id: string
          quantity?: number | null
          received_by?: string | null
          received_date?: string | null
          requires_assembly?: boolean | null
          requires_crating?: boolean | null
          room_destination?: string | null
          special_handling_notes?: string | null
          status?: string | null
          status_notes?: string | null
          status_updated_at?: string | null
          storage_location?: string | null
          vendor?: string | null
          vendor_carrier?: string | null
          vendor_contact_email?: string | null
          vendor_contact_name?: string | null
          vendor_contact_phone?: string | null
          vendor_delivery_method?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
          vendor_order_number?: string | null
          vendor_pickup_address?: string | null
          vendor_pickup_window?: string | null
          vendor_tracking_number?: string | null
        }
        Update: {
          condition_on_receipt?: string | null
          created_at?: string | null
          delivered_date?: string | null
          delivery_photo_url?: string | null
          description?: string | null
          expected_delivery_date?: string | null
          handled_by?: string | null
          id?: string
          inspection_notes?: string | null
          item_dimensions?: string | null
          item_name?: string
          item_status?: string | null
          item_value?: number | null
          phase_id?: string | null
          photo_urls?: string[] | null
          pickup_photo_url?: string | null
          placement_notes?: string | null
          project_id?: string
          quantity?: number | null
          received_by?: string | null
          received_date?: string | null
          requires_assembly?: boolean | null
          requires_crating?: boolean | null
          room_destination?: string | null
          special_handling_notes?: string | null
          status?: string | null
          status_notes?: string | null
          status_updated_at?: string | null
          storage_location?: string | null
          vendor?: string | null
          vendor_carrier?: string | null
          vendor_contact_email?: string | null
          vendor_contact_name?: string | null
          vendor_contact_phone?: string | null
          vendor_delivery_method?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
          vendor_order_number?: string | null
          vendor_pickup_address?: string | null
          vendor_pickup_window?: string | null
          vendor_tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_inventory_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_inventory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_inventory_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "project_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          address: string | null
          completed_date: string | null
          created_at: string | null
          description: string | null
          id: string
          notes: string | null
          phase_name: string
          phase_order: number
          project_id: string
          scheduled_date: string | null
          status: string | null
        }
        Insert: {
          address?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          phase_name: string
          phase_order: number
          project_id: string
          scheduled_date?: string | null
          status?: string | null
        }
        Update: {
          address?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          phase_name?: string
          phase_order?: number
          project_id?: string
          scheduled_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_log: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          item_id: string | null
          new_status: string | null
          notes: string | null
          old_status: string | null
          project_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          project_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "project_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_status_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timeline: {
        Row: {
          created_at: string | null
          event_description: string
          event_type: string
          id: string
          phase_id: string | null
          photos: string[] | null
          project_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_description: string
          event_type: string
          id?: string
          phase_id?: string | null
          photos?: string[] | null
          project_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_description?: string
          event_type?: string
          id?: string
          phase_id?: string | null
          photos?: string[] | null
          project_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_timeline_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timeline_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_vendors: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          pickup_date: string | null
          pickup_window: string | null
          project_id: string
          readiness: string
          readiness_notes: string | null
          received_at: string | null
          sort_order: number | null
          updated_at: string | null
          vendor_access: string | null
          vendor_access_notes: string | null
          vendor_address: string | null
          vendor_name: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          pickup_date?: string | null
          pickup_window?: string | null
          project_id: string
          readiness?: string
          readiness_notes?: string | null
          received_at?: string | null
          sort_order?: number | null
          updated_at?: string | null
          vendor_access?: string | null
          vendor_access_notes?: string | null
          vendor_address?: string | null
          vendor_name: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          pickup_date?: string | null
          pickup_window?: string | null
          project_id?: string
          readiness?: string
          readiness_notes?: string | null
          received_at?: string | null
          sort_order?: number | null
          updated_at?: string | null
          vendor_access?: string | null
          vendor_access_notes?: string | null
          vendor_address?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_vendors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          active_phase: string | null
          actual_cost: number | null
          actual_end_date: string | null
          coordinator_id: string | null
          coordinator_name: string | null
          created_at: string | null
          created_by: string | null
          delivery_job_id: string | null
          description: string | null
          designer_phase: string | null
          end_client_contact: string | null
          end_client_name: string | null
          estimated_budget: number | null
          hubspot_deal_id: string | null
          id: string
          install_access: string | null
          install_access_notes: string | null
          install_floor: string | null
          install_unit: string | null
          notes: string | null
          partner_id: string
          placement_spec_url: string | null
          project_lead: string | null
          project_mgmt_fee: number | null
          project_name: string
          project_number: string
          rooms: Json | null
          site_address: string | null
          start_date: string | null
          status: string
          target_end_date: string | null
          updated_at: string | null
        }
        Insert: {
          active_phase?: string | null
          actual_cost?: number | null
          actual_end_date?: string | null
          coordinator_id?: string | null
          coordinator_name?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_job_id?: string | null
          description?: string | null
          designer_phase?: string | null
          end_client_contact?: string | null
          end_client_name?: string | null
          estimated_budget?: number | null
          hubspot_deal_id?: string | null
          id?: string
          install_access?: string | null
          install_access_notes?: string | null
          install_floor?: string | null
          install_unit?: string | null
          notes?: string | null
          partner_id: string
          placement_spec_url?: string | null
          project_lead?: string | null
          project_mgmt_fee?: number | null
          project_name: string
          project_number: string
          rooms?: Json | null
          site_address?: string | null
          start_date?: string | null
          status?: string
          target_end_date?: string | null
          updated_at?: string | null
        }
        Update: {
          active_phase?: string | null
          actual_cost?: number | null
          actual_end_date?: string | null
          coordinator_id?: string | null
          coordinator_name?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_job_id?: string | null
          description?: string | null
          designer_phase?: string | null
          end_client_contact?: string | null
          end_client_name?: string | null
          estimated_budget?: number | null
          hubspot_deal_id?: string | null
          id?: string
          install_access?: string | null
          install_access_notes?: string | null
          install_floor?: string | null
          install_unit?: string | null
          notes?: string | null
          partner_id?: string
          placement_spec_url?: string | null
          project_lead?: string | null
          project_mgmt_fee?: number | null
          project_name?: string
          project_number?: string
          rooms?: Json | null
          site_address?: string | null
          start_date?: string | null
          status?: string
          target_end_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_of_delivery: {
        Row: {
          completed_at: string | null
          created_at: string | null
          crew_members: string[] | null
          delivery_id: string | null
          delivery_stop_index: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          item_conditions: Json | null
          move_id: string | null
          pdf_url: string | null
          photos_delivery: Json | null
          photos_pickup: Json | null
          photos_transit: Json | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          signature_data: string | null
          signed_at: string | null
          signer_name: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          crew_members?: string[] | null
          delivery_id?: string | null
          delivery_stop_index?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          item_conditions?: Json | null
          move_id?: string | null
          pdf_url?: string | null
          photos_delivery?: Json | null
          photos_pickup?: Json | null
          photos_transit?: Json | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          signature_data?: string | null
          signed_at?: string | null
          signer_name?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          crew_members?: string[] | null
          delivery_id?: string | null
          delivery_stop_index?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          item_conditions?: Json | null
          move_id?: string | null
          pdf_url?: string | null
          photos_delivery?: Json | null
          photos_pickup?: Json | null
          photos_transit?: Json | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          signature_data?: string | null
          signed_at?: string | null
          signer_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proof_of_delivery_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_delivery_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_analytics: {
        Row: {
          addon_count: number | null
          addon_revenue: number | null
          addon_slugs: string[] | null
          created_at: string | null
          day_of_week: string | null
          deposit_amount: number | null
          final_amount: number | null
          id: string
          lost_reason: string | null
          move_id: string | null
          move_size: string | null
          neighbourhood_tier: string | null
          outcome: string | null
          quote_id: string | null
          quoted_amount: number | null
          season: string | null
          service_type: string | null
          square_payment_id: string | null
          tier_selected: string | null
        }
        Insert: {
          addon_count?: number | null
          addon_revenue?: number | null
          addon_slugs?: string[] | null
          created_at?: string | null
          day_of_week?: string | null
          deposit_amount?: number | null
          final_amount?: number | null
          id?: string
          lost_reason?: string | null
          move_id?: string | null
          move_size?: string | null
          neighbourhood_tier?: string | null
          outcome?: string | null
          quote_id?: string | null
          quoted_amount?: number | null
          season?: string | null
          service_type?: string | null
          square_payment_id?: string | null
          tier_selected?: string | null
        }
        Update: {
          addon_count?: number | null
          addon_revenue?: number | null
          addon_slugs?: string[] | null
          created_at?: string | null
          day_of_week?: string | null
          deposit_amount?: number | null
          final_amount?: number | null
          id?: string
          lost_reason?: string | null
          move_id?: string | null
          move_size?: string | null
          neighbourhood_tier?: string | null
          outcome?: string | null
          quote_id?: string | null
          quoted_amount?: number | null
          season?: string | null
          service_type?: string | null
          square_payment_id?: string | null
          tier_selected?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_analytics_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_engagement: {
        Row: {
          created_at: string | null
          device_type: string | null
          event_data: Json | null
          event_type: string
          id: string
          quote_id: string | null
          session_duration_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          device_type?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          quote_id?: string | null
          session_duration_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          device_type?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          quote_id?: string | null
          session_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_engagement_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          quote_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          quote_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          quote_id?: string
        }
        Relationships: []
      }
      quote_expiry_policy: {
        Row: {
          days: number
          reason: string | null
          service_type: string
          updated_at: string
        }
        Insert: {
          days: number
          reason?: string | null
          service_type: string
          updated_at?: string
        }
        Update: {
          days?: number
          reason?: string | null
          service_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_followups: {
        Row: {
          email_opened: boolean
          email_opened_at: string | null
          id: string
          link_clicked: boolean
          link_clicked_at: string | null
          quote_id: string
          sent_at: string
          type: string
        }
        Insert: {
          email_opened?: boolean
          email_opened_at?: string | null
          id?: string
          link_clicked?: boolean
          link_clicked_at?: string | null
          quote_id: string
          sent_at?: string
          type: string
        }
        Update: {
          email_opened?: boolean
          email_opened_at?: string | null
          id?: string
          link_clicked?: boolean
          link_clicked_at?: string | null
          quote_id?: string
          sent_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_followups_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          contact_id: string | null
          converted_at: string | null
          created_at: string | null
          email: string
          estimate_factors: string[] | null
          flexible_date: boolean | null
          from_postal: string
          hubspot_deal_id: string | null
          id: string
          lead_number: string
          move_date: string | null
          move_size: string
          name: string
          other_items: Json | null
          phone: string | null
          quote_id: string | null
          source: string
          special_handling: string | null
          status: string
          to_postal: string
          updated_at: string | null
          widget_estimate_high: number | null
          widget_estimate_low: number | null
        }
        Insert: {
          contact_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          email: string
          estimate_factors?: string[] | null
          flexible_date?: boolean | null
          from_postal: string
          hubspot_deal_id?: string | null
          id?: string
          lead_number: string
          move_date?: string | null
          move_size: string
          name: string
          other_items?: Json | null
          phone?: string | null
          quote_id?: string | null
          source?: string
          special_handling?: string | null
          status?: string
          to_postal: string
          updated_at?: string | null
          widget_estimate_high?: number | null
          widget_estimate_low?: number | null
        }
        Update: {
          contact_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string
          estimate_factors?: string[] | null
          flexible_date?: boolean | null
          from_postal?: string
          hubspot_deal_id?: string | null
          id?: string
          lead_number?: string
          move_date?: string | null
          move_size?: string
          name?: string
          other_items?: Json | null
          phone?: string | null
          quote_id?: string | null
          source?: string
          special_handling?: string | null
          status?: string
          to_postal?: string
          updated_at?: string | null
          widget_estimate_high?: number | null
          widget_estimate_low?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_scenarios: {
        Row: {
          conditions_note: string | null
          created_at: string | null
          deposit_amount: number | null
          description: string | null
          hst: number | null
          id: string
          is_recommended: boolean | null
          label: string | null
          price: number | null
          quote_id: string
          scenario_date: string | null
          scenario_number: number
          scenario_time: string | null
          selected_at: string | null
          status: string | null
          total_price: number | null
        }
        Insert: {
          conditions_note?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          hst?: number | null
          id?: string
          is_recommended?: boolean | null
          label?: string | null
          price?: number | null
          quote_id: string
          scenario_date?: string | null
          scenario_number?: number
          scenario_time?: string | null
          selected_at?: string | null
          status?: string | null
          total_price?: number | null
        }
        Update: {
          conditions_note?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          hst?: number | null
          id?: string
          is_recommended?: boolean | null
          label?: string | null
          price?: number | null
          quote_id?: string
          scenario_date?: string | null
          scenario_number?: number
          scenario_time?: string | null
          selected_at?: string | null
          status?: string | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_scenarios_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          created_at: string
          id: string
          quote_id: string
          regenerated_by: string | null
          snapshot: Json
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          quote_id: string
          regenerated_by?: string | null
          snapshot: Json
          version_number?: number
        }
        Update: {
          created_at?: string
          id?: string
          quote_id?: string
          regenerated_by?: string | null
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_scenario_id: string | null
          additional_destinations: Json
          additional_origins: Json
          arrival_window: string | null
          assembly_auto_detected: boolean | null
          assembly_items: Json | null
          assembly_minutes: number | null
          assembly_override: boolean | null
          assembly_required: boolean | null
          auto_followup_active: boolean
          booked_via: string | null
          booking_notes: string | null
          client_box_count: number | null
          cold_reason: string | null
          comparison_alert_sent_at: string | null
          contact_id: string | null
          coordinator_alerted_at: string | null
          crating_pieces: Json | null
          crating_total: number | null
          created_at: string | null
          custom_price: number | null
          day_breakdown: Json
          declaration_total: number | null
          declared_value: number | null
          decline_comment: string | null
          decline_reason: string | null
          declined_at: string | null
          deliver_to_email: string | null
          deliver_to_name: string | null
          deliver_to_notes: string | null
          deliver_to_phone: string | null
          deposit_amount: number | null
          destination_count: number | null
          distance_km: number | null
          drive_time_min: number | null
          duplicated_from: string | null
          essential_addons: Json | null
          est_crew_size: number | null
          est_hours: number | null
          est_truck_size: string | null
          estimated_days: number
          expires_at: string | null
          externally_booked: boolean | null
          factors_applied: Json | null
          followup_1_sent: string | null
          followup_2_sent: string | null
          followup_3_sent: string | null
          followup_expiry_sent: string | null
          followup_urgency_sent: string | null
          from_access: string | null
          from_address: string
          from_long_carry: boolean | null
          from_parking: string | null
          from_postal: string | null
          high_value_declarations: Json
          hubspot_deal_id: string | null
          hubspot_duplicate_detected: boolean
          hubspot_existing_deal_id: string | null
          hubspot_existing_deal_name: string | null
          hubspot_existing_deal_stage: string | null
          id: string
          inbound_shipment_id: string | null
          inventory_items: Json | null
          inventory_modifier: number | null
          inventory_score: number | null
          inventory_warnings: Json | null
          is_multi_scenario: boolean | null
          is_project: boolean
          is_revised: boolean
          junk_items_count: number | null
          junk_items_description: string | null
          junk_pickup_from: string | null
          labour_component: number | null
          labour_rate_per_mover: number | null
          labour_validation_message: string | null
          labour_validation_status: string | null
          last_regenerated_at: string | null
          last_regenerated_by: string | null
          loss_reason: string | null
          lost_at: string | null
          move_date: string | null
          move_project_id: string | null
          move_size: string | null
          multi_location: boolean
          non_labour_component: number | null
          origin_count: number | null
          override_by: string | null
          override_price: number | null
          override_reason: string | null
          override_reason_code: string | null
          payment_error: string | null
          payment_failed_at: string | null
          payment_retry_count: number
          payment_status: string | null
          preferred_time: string | null
          presentation_mode: string
          public_action_token: string | null
          quote_id: string
          quote_items: Json
          quote_source: string | null
          quote_url: string | null
          recommended_tier: string | null
          reengagement_converted: boolean | null
          reengagement_sent: string | null
          referral_id: string | null
          selected_addons: Json | null
          selected_tier: string | null
          sent_at: string | null
          service_type: string
          size_override_confirmed: boolean | null
          size_override_reason: string | null
          source_request_id: string | null
          specialty_item_description: string | null
          specialty_items: Json | null
          specialty_requirements: string[] | null
          specialty_type: string | null
          specialty_weight_class: string | null
          square_card_id: string | null
          square_customer_id: string | null
          square_payment_id: string | null
          status: string | null
          superseded_at: string | null
          superseded_by: string | null
          supplies_allowance: number | null
          system_price: number | null
          tier_ops_snapshot: Json | null
          tier_price_overrides: Json | null
          tiers: Json | null
          to_access: string | null
          to_address: string
          to_long_carry: boolean | null
          to_parking: string | null
          to_postal: string | null
          truck_override: boolean | null
          truck_primary: string | null
          truck_secondary: string | null
          updated_at: string | null
          valuation_tier: string | null
          valuation_upgrade_cost: number | null
          valuation_upgraded: boolean | null
          version: number
          viewed_at: string | null
          walkthrough_based: boolean | null
          walkthrough_date: string | null
          walkthrough_notes: string | null
          walkthrough_special_items: string | null
          went_cold_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_scenario_id?: string | null
          additional_destinations?: Json
          additional_origins?: Json
          arrival_window?: string | null
          assembly_auto_detected?: boolean | null
          assembly_items?: Json | null
          assembly_minutes?: number | null
          assembly_override?: boolean | null
          assembly_required?: boolean | null
          auto_followup_active?: boolean
          booked_via?: string | null
          booking_notes?: string | null
          client_box_count?: number | null
          cold_reason?: string | null
          comparison_alert_sent_at?: string | null
          contact_id?: string | null
          coordinator_alerted_at?: string | null
          crating_pieces?: Json | null
          crating_total?: number | null
          created_at?: string | null
          custom_price?: number | null
          day_breakdown?: Json
          declaration_total?: number | null
          declared_value?: number | null
          decline_comment?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deliver_to_email?: string | null
          deliver_to_name?: string | null
          deliver_to_notes?: string | null
          deliver_to_phone?: string | null
          deposit_amount?: number | null
          destination_count?: number | null
          distance_km?: number | null
          drive_time_min?: number | null
          duplicated_from?: string | null
          essential_addons?: Json | null
          est_crew_size?: number | null
          est_hours?: number | null
          est_truck_size?: string | null
          estimated_days?: number
          expires_at?: string | null
          externally_booked?: boolean | null
          factors_applied?: Json | null
          followup_1_sent?: string | null
          followup_2_sent?: string | null
          followup_3_sent?: string | null
          followup_expiry_sent?: string | null
          followup_urgency_sent?: string | null
          from_access?: string | null
          from_address: string
          from_long_carry?: boolean | null
          from_parking?: string | null
          from_postal?: string | null
          high_value_declarations?: Json
          hubspot_deal_id?: string | null
          hubspot_duplicate_detected?: boolean
          hubspot_existing_deal_id?: string | null
          hubspot_existing_deal_name?: string | null
          hubspot_existing_deal_stage?: string | null
          id?: string
          inbound_shipment_id?: string | null
          inventory_items?: Json | null
          inventory_modifier?: number | null
          inventory_score?: number | null
          inventory_warnings?: Json | null
          is_multi_scenario?: boolean | null
          is_project?: boolean
          is_revised?: boolean
          junk_items_count?: number | null
          junk_items_description?: string | null
          junk_pickup_from?: string | null
          labour_component?: number | null
          labour_rate_per_mover?: number | null
          labour_validation_message?: string | null
          labour_validation_status?: string | null
          last_regenerated_at?: string | null
          last_regenerated_by?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          move_date?: string | null
          move_project_id?: string | null
          move_size?: string | null
          multi_location?: boolean
          non_labour_component?: number | null
          origin_count?: number | null
          override_by?: string | null
          override_price?: number | null
          override_reason?: string | null
          override_reason_code?: string | null
          payment_error?: string | null
          payment_failed_at?: string | null
          payment_retry_count?: number
          payment_status?: string | null
          preferred_time?: string | null
          presentation_mode?: string
          public_action_token?: string | null
          quote_id: string
          quote_items?: Json
          quote_source?: string | null
          quote_url?: string | null
          recommended_tier?: string | null
          reengagement_converted?: boolean | null
          reengagement_sent?: string | null
          referral_id?: string | null
          selected_addons?: Json | null
          selected_tier?: string | null
          sent_at?: string | null
          service_type: string
          size_override_confirmed?: boolean | null
          size_override_reason?: string | null
          source_request_id?: string | null
          specialty_item_description?: string | null
          specialty_items?: Json | null
          specialty_requirements?: string[] | null
          specialty_type?: string | null
          specialty_weight_class?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_payment_id?: string | null
          status?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
          supplies_allowance?: number | null
          system_price?: number | null
          tier_ops_snapshot?: Json | null
          tier_price_overrides?: Json | null
          tiers?: Json | null
          to_access?: string | null
          to_address: string
          to_long_carry?: boolean | null
          to_parking?: string | null
          to_postal?: string | null
          truck_override?: boolean | null
          truck_primary?: string | null
          truck_secondary?: string | null
          updated_at?: string | null
          valuation_tier?: string | null
          valuation_upgrade_cost?: number | null
          valuation_upgraded?: boolean | null
          version?: number
          viewed_at?: string | null
          walkthrough_based?: boolean | null
          walkthrough_date?: string | null
          walkthrough_notes?: string | null
          walkthrough_special_items?: string | null
          went_cold_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_scenario_id?: string | null
          additional_destinations?: Json
          additional_origins?: Json
          arrival_window?: string | null
          assembly_auto_detected?: boolean | null
          assembly_items?: Json | null
          assembly_minutes?: number | null
          assembly_override?: boolean | null
          assembly_required?: boolean | null
          auto_followup_active?: boolean
          booked_via?: string | null
          booking_notes?: string | null
          client_box_count?: number | null
          cold_reason?: string | null
          comparison_alert_sent_at?: string | null
          contact_id?: string | null
          coordinator_alerted_at?: string | null
          crating_pieces?: Json | null
          crating_total?: number | null
          created_at?: string | null
          custom_price?: number | null
          day_breakdown?: Json
          declaration_total?: number | null
          declared_value?: number | null
          decline_comment?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deliver_to_email?: string | null
          deliver_to_name?: string | null
          deliver_to_notes?: string | null
          deliver_to_phone?: string | null
          deposit_amount?: number | null
          destination_count?: number | null
          distance_km?: number | null
          drive_time_min?: number | null
          duplicated_from?: string | null
          essential_addons?: Json | null
          est_crew_size?: number | null
          est_hours?: number | null
          est_truck_size?: string | null
          estimated_days?: number
          expires_at?: string | null
          externally_booked?: boolean | null
          factors_applied?: Json | null
          followup_1_sent?: string | null
          followup_2_sent?: string | null
          followup_3_sent?: string | null
          followup_expiry_sent?: string | null
          followup_urgency_sent?: string | null
          from_access?: string | null
          from_address?: string
          from_long_carry?: boolean | null
          from_parking?: string | null
          from_postal?: string | null
          high_value_declarations?: Json
          hubspot_deal_id?: string | null
          hubspot_duplicate_detected?: boolean
          hubspot_existing_deal_id?: string | null
          hubspot_existing_deal_name?: string | null
          hubspot_existing_deal_stage?: string | null
          id?: string
          inbound_shipment_id?: string | null
          inventory_items?: Json | null
          inventory_modifier?: number | null
          inventory_score?: number | null
          inventory_warnings?: Json | null
          is_multi_scenario?: boolean | null
          is_project?: boolean
          is_revised?: boolean
          junk_items_count?: number | null
          junk_items_description?: string | null
          junk_pickup_from?: string | null
          labour_component?: number | null
          labour_rate_per_mover?: number | null
          labour_validation_message?: string | null
          labour_validation_status?: string | null
          last_regenerated_at?: string | null
          last_regenerated_by?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          move_date?: string | null
          move_project_id?: string | null
          move_size?: string | null
          multi_location?: boolean
          non_labour_component?: number | null
          origin_count?: number | null
          override_by?: string | null
          override_price?: number | null
          override_reason?: string | null
          override_reason_code?: string | null
          payment_error?: string | null
          payment_failed_at?: string | null
          payment_retry_count?: number
          payment_status?: string | null
          preferred_time?: string | null
          presentation_mode?: string
          public_action_token?: string | null
          quote_id?: string
          quote_items?: Json
          quote_source?: string | null
          quote_url?: string | null
          recommended_tier?: string | null
          reengagement_converted?: boolean | null
          reengagement_sent?: string | null
          referral_id?: string | null
          selected_addons?: Json | null
          selected_tier?: string | null
          sent_at?: string | null
          service_type?: string
          size_override_confirmed?: boolean | null
          size_override_reason?: string | null
          source_request_id?: string | null
          specialty_item_description?: string | null
          specialty_items?: Json | null
          specialty_requirements?: string[] | null
          specialty_type?: string | null
          specialty_weight_class?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_payment_id?: string | null
          status?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
          supplies_allowance?: number | null
          system_price?: number | null
          tier_ops_snapshot?: Json | null
          tier_price_overrides?: Json | null
          tiers?: Json | null
          to_access?: string | null
          to_address?: string
          to_long_carry?: boolean | null
          to_parking?: string | null
          to_postal?: string | null
          truck_override?: boolean | null
          truck_primary?: string | null
          truck_secondary?: string | null
          updated_at?: string | null
          valuation_tier?: string | null
          valuation_upgrade_cost?: number | null
          valuation_upgraded?: boolean | null
          version?: number
          viewed_at?: string | null
          walkthrough_based?: boolean | null
          walkthrough_date?: string | null
          walkthrough_notes?: string | null
          walkthrough_special_items?: string | null
          went_cold_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_duplicated_from_fkey"
            columns: ["duplicated_from"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_inbound_shipment_id_fkey"
            columns: ["inbound_shipment_id"]
            isOneToOne: false
            referencedRelation: "inbound_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_move_project_id_fkey"
            columns: ["move_project_id"]
            isOneToOne: false
            referencedRelation: "move_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "client_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_day_rates: {
        Row: {
          created_at: string | null
          full_day_price: number
          half_day_price: number
          id: string
          pricing_tier: string
          rate_card_id: string | null
          stops_included_full: number
          stops_included_half: number
          template_id: string | null
          vehicle_type: string
        }
        Insert: {
          created_at?: string | null
          full_day_price: number
          half_day_price: number
          id?: string
          pricing_tier?: string
          rate_card_id?: string | null
          stops_included_full?: number
          stops_included_half?: number
          template_id?: string | null
          vehicle_type: string
        }
        Update: {
          created_at?: string | null
          full_day_price?: number
          half_day_price?: number
          id?: string
          pricing_tier?: string
          rate_card_id?: string | null
          stops_included_full?: number
          stops_included_half?: number
          template_id?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_day_rates_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_card_day_rates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_delivery_rates: {
        Row: {
          created_at: string | null
          delivery_type: string
          id: string
          price_max: number | null
          price_min: number
          pricing_tier: string
          rate_card_id: string | null
          template_id: string | null
          zone: number
        }
        Insert: {
          created_at?: string | null
          delivery_type: string
          id?: string
          price_max?: number | null
          price_min: number
          pricing_tier?: string
          rate_card_id?: string | null
          template_id?: string | null
          zone: number
        }
        Update: {
          created_at?: string | null
          delivery_type?: string
          id?: string
          price_max?: number | null
          price_min?: number
          pricing_tier?: string
          rate_card_id?: string | null
          template_id?: string | null
          zone?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_delivery_rates_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_card_delivery_rates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_distance_overages: {
        Row: {
          created_at: string | null
          from_km: number
          id: string
          pricing_tier: string
          rate_card_id: string | null
          rate_per_km: number
          template_id: string | null
          to_km: number | null
        }
        Insert: {
          created_at?: string | null
          from_km: number
          id?: string
          pricing_tier?: string
          rate_card_id?: string | null
          rate_per_km: number
          template_id?: string | null
          to_km?: number | null
        }
        Update: {
          created_at?: string | null
          from_km?: number
          id?: string
          pricing_tier?: string
          rate_card_id?: string | null
          rate_per_km?: number
          template_id?: string | null
          to_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_distance_overages_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_card_distance_overages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_overages: {
        Row: {
          created_at: string | null
          id: string
          overage_tier: string
          price_per_stop: number
          pricing_tier: string
          rate_card_id: string | null
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          overage_tier: string
          price_per_stop: number
          pricing_tier?: string
          rate_card_id?: string | null
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          overage_tier?: string
          price_per_stop?: number
          pricing_tier?: string
          rate_card_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_overages_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_card_overages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_services: {
        Row: {
          created_at: string | null
          id: string
          price_max: number | null
          price_min: number
          price_unit: string | null
          pricing_tier: string
          rate_card_id: string | null
          service_name: string
          service_slug: string
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          price_max?: number | null
          price_min: number
          price_unit?: string | null
          pricing_tier?: string
          rate_card_id?: string | null
          service_name: string
          service_slug: string
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          price_max?: number | null
          price_min?: number
          price_unit?: string | null
          pricing_tier?: string
          rate_card_id?: string | null
          service_name?: string
          service_slug?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_services_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_card_services_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_templates: {
        Row: {
          created_at: string | null
          description: string | null
          extras: Json
          id: string
          is_active: boolean | null
          template_kind: string
          template_name: string
          template_slug: string
          updated_at: string | null
          verticals_covered: string[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          extras?: Json
          id?: string
          is_active?: boolean | null
          template_kind?: string
          template_name: string
          template_slug: string
          updated_at?: string | null
          verticals_covered?: string[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          extras?: Json
          id?: string
          is_active?: boolean | null
          template_kind?: string
          template_name?: string
          template_slug?: string
          updated_at?: string | null
          verticals_covered?: string[] | null
        }
        Relationships: []
      }
      rate_card_volume_bonuses: {
        Row: {
          created_at: string | null
          discount_pct: number
          id: string
          max_deliveries: number | null
          min_deliveries: number
          rate_card_id: string | null
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          discount_pct: number
          id?: string
          max_deliveries?: number | null
          min_deliveries: number
          rate_card_id?: string | null
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          discount_pct?: number
          id?: string
          max_deliveries?: number | null
          min_deliveries?: number
          rate_card_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_volume_bonuses_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_card_volume_bonuses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_weight_surcharges: {
        Row: {
          created_at: string | null
          id: string
          label: string | null
          pricing_tier: string
          rate_card_id: string | null
          surcharge_per_item: number
          template_id: string | null
          weight_max_lbs: number | null
          weight_min_lbs: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          label?: string | null
          pricing_tier?: string
          rate_card_id?: string | null
          surcharge_per_item: number
          template_id?: string | null
          weight_max_lbs?: number | null
          weight_min_lbs: number
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string | null
          pricing_tier?: string
          rate_card_id?: string | null
          surcharge_per_item?: number
          template_id?: string | null
          weight_max_lbs?: number | null
          weight_min_lbs?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_weight_surcharges_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_card_weight_surcharges_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_zones: {
        Row: {
          coverage_areas: string | null
          created_at: string | null
          distance_max_km: number | null
          distance_min_km: number
          id: string
          pricing_tier: string
          rate_card_id: string | null
          surcharge: number
          template_id: string | null
          zone_name: string
          zone_number: number
        }
        Insert: {
          coverage_areas?: string | null
          created_at?: string | null
          distance_max_km?: number | null
          distance_min_km: number
          id?: string
          pricing_tier?: string
          rate_card_id?: string | null
          surcharge?: number
          template_id?: string | null
          zone_name: string
          zone_number: number
        }
        Update: {
          coverage_areas?: string | null
          created_at?: string | null
          distance_max_km?: number | null
          distance_min_km?: number
          id?: string
          pricing_tier?: string
          rate_card_id?: string | null
          surcharge?: number
          template_id?: string | null
          zone_name?: string
          zone_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_zones_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_card_zones_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_checks: {
        Row: {
          check_date: string
          completed_at: string | null
          created_at: string | null
          crew_lead_id: string
          flagged_items: string[] | null
          id: string
          items: Json
          note: string | null
          passed: boolean
          team_id: string
          truck_id: string | null
        }
        Insert: {
          check_date: string
          completed_at?: string | null
          created_at?: string | null
          crew_lead_id: string
          flagged_items?: string[] | null
          id?: string
          items?: Json
          note?: string | null
          passed?: boolean
          team_id: string
          truck_id?: string | null
        }
        Update: {
          check_date?: string
          completed_at?: string | null
          created_at?: string | null
          crew_lead_id?: string
          flagged_items?: string[] | null
          id?: string
          items?: Json
          note?: string | null
          passed?: boolean
          team_id?: string
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "readiness_checks_crew_lead_id_fkey"
            columns: ["crew_lead_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_checks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_checks_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      realtors: {
        Row: {
          agent_name: string
          brokerage: string | null
          created_at: string | null
          email: string | null
          id: string
        }
        Insert: {
          agent_name: string
          brokerage?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Update: {
          agent_name?: string
          brokerage?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      recurring_delivery_schedules: {
        Row: {
          booking_type: string
          created_at: string | null
          created_by_source: string | null
          created_by_user: string | null
          crew_id: string | null
          day_type: string | null
          days_of_week: number[]
          default_num_stops: number | null
          default_pickup_address: string | null
          default_services: Json | null
          frequency: string
          id: string
          is_active: boolean | null
          is_paused: boolean | null
          next_generation_date: string | null
          organization_id: string
          rate_card_id: string | null
          schedule_name: string
          time_window: string | null
          vehicle_type: string | null
        }
        Insert: {
          booking_type?: string
          created_at?: string | null
          created_by_source?: string | null
          created_by_user?: string | null
          crew_id?: string | null
          day_type?: string | null
          days_of_week?: number[]
          default_num_stops?: number | null
          default_pickup_address?: string | null
          default_services?: Json | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          is_paused?: boolean | null
          next_generation_date?: string | null
          organization_id: string
          rate_card_id?: string | null
          schedule_name: string
          time_window?: string | null
          vehicle_type?: string | null
        }
        Update: {
          booking_type?: string
          created_at?: string | null
          created_by_source?: string | null
          created_by_user?: string | null
          crew_id?: string | null
          day_type?: string | null
          days_of_week?: number[]
          default_num_stops?: number | null
          default_pickup_address?: string | null
          default_services?: Json | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          is_paused?: boolean | null
          next_generation_date?: string | null
          organization_id?: string
          rate_card_id?: string | null
          schedule_name?: string
          time_window?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_delivery_schedules_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_delivery_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_delivery_schedules_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "partner_rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          agent_id: string | null
          agent_name: string
          brokerage: string | null
          client_email: string | null
          client_name: string
          commission: number | null
          created_at: string | null
          id: string
          move_date: string | null
          move_id: string | null
          move_type: string | null
          preferred_contact: string | null
          property: string | null
          status: string | null
          tier: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_name: string
          brokerage?: string | null
          client_email?: string | null
          client_name: string
          commission?: number | null
          created_at?: string | null
          id?: string
          move_date?: string | null
          move_id?: string | null
          move_type?: string | null
          preferred_contact?: string | null
          property?: string | null
          status?: string | null
          tier?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_name?: string
          brokerage?: string | null
          client_email?: string | null
          client_name?: string
          commission?: number | null
          created_at?: string | null
          id?: string
          move_date?: string | null
          move_id?: string | null
          move_type?: string | null
          preferred_contact?: string | null
          property?: string | null
          status?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "realtors"
            referencedColumns: ["id"]
          },
        ]
      }
      registered_devices: {
        Row: {
          created_at: string | null
          default_team_id: string | null
          device_id: string
          device_name: string
          id: string
          is_active: boolean
          last_active_at: string | null
          phone: string | null
          registered_at: string | null
          truck_id: string | null
        }
        Insert: {
          created_at?: string | null
          default_team_id?: string | null
          device_id: string
          device_name: string
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          phone?: string | null
          registered_at?: string | null
          truck_id?: string | null
        }
        Update: {
          created_at?: string | null
          default_team_id?: string | null
          device_id?: string
          device_name?: string
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          phone?: string | null
          registered_at?: string | null
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registered_devices_default_team_id_fkey"
            columns: ["default_team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registered_devices_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          client_email: string | null
          client_feedback: string | null
          client_name: string
          client_phone: string | null
          client_rating: number | null
          created_at: string | null
          email_sent_at: string | null
          id: string
          move_id: string | null
          pod_rating: number | null
          reminder_send_at: string | null
          reminder_sent_at: string | null
          review_clicked: boolean | null
          review_clicked_at: string | null
          scheduled_send_at: string
          sms_sent_at: string | null
          status: string | null
          tier: string | null
        }
        Insert: {
          client_email?: string | null
          client_feedback?: string | null
          client_name: string
          client_phone?: string | null
          client_rating?: number | null
          created_at?: string | null
          email_sent_at?: string | null
          id?: string
          move_id?: string | null
          pod_rating?: number | null
          reminder_send_at?: string | null
          reminder_sent_at?: string | null
          review_clicked?: boolean | null
          review_clicked_at?: string | null
          scheduled_send_at: string
          sms_sent_at?: string | null
          status?: string | null
          tier?: string | null
        }
        Update: {
          client_email?: string | null
          client_feedback?: string | null
          client_name?: string
          client_phone?: string | null
          client_rating?: number | null
          created_at?: string | null
          email_sent_at?: string | null
          id?: string
          move_id?: string | null
          pod_rating?: number | null
          reminder_send_at?: string | null
          reminder_sent_at?: string | null
          review_clicked?: boolean | null
          review_clicked_at?: string | null
          scheduled_send_at?: string
          sms_sent_at?: string | null
          status?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_suggestions: {
        Row: {
          applied: boolean | null
          created_at: string | null
          date: string
          dismissed: boolean | null
          id: string
          savings_km: number | null
          savings_min: number | null
          suggestion: Json
        }
        Insert: {
          applied?: boolean | null
          created_at?: string | null
          date: string
          dismissed?: boolean | null
          id?: string
          savings_km?: number | null
          savings_min?: number | null
          suggestion: Json
        }
        Update: {
          applied?: boolean | null
          created_at?: string | null
          date?: string
          dismissed?: boolean | null
          id?: string
          savings_km?: number | null
          savings_min?: number | null
          suggestion?: Json
        }
        Relationships: []
      }
      scheduled_emails: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          last_error: string | null
          metadata: Json | null
          move_id: string | null
          partner_id: string | null
          quote_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          type: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          move_id?: string | null
          partner_id?: string | null
          quote_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          type: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          move_id?: string | null
          partner_id?: string | null
          quote_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_move_client_sms: {
        Row: {
          created_at: string
          id: string
          kind: string
          last_error: string | null
          move_id: string
          send_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          last_error?: string | null
          move_id: string
          send_at: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          move_id?: string
          send_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_move_client_sms_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_alternatives: {
        Row: {
          alt_date: string
          alt_window: string
          created_at: string | null
          crew_ids: string[] | null
          id: string
          is_selected: boolean | null
          move_id: string | null
          selected_at: string | null
          team_name: string | null
        }
        Insert: {
          alt_date: string
          alt_window: string
          created_at?: string | null
          crew_ids?: string[] | null
          id?: string
          is_selected?: boolean | null
          move_id?: string | null
          selected_at?: string | null
          team_name?: string | null
        }
        Update: {
          alt_date?: string
          alt_window?: string
          created_at?: string | null
          crew_ids?: string[] | null
          id?: string
          is_selected?: boolean | null
          move_id?: string | null
          selected_at?: string | null
          team_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_alternatives_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_status_log: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          photos: Json | null
          shipment_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          photos?: Json | null
          shipment_id: string
          status: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          photos?: Json | null
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_log_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "inbound_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      signoff_skips: {
        Row: {
          created_at: string | null
          crew_member_id: string | null
          id: string
          job_id: string
          job_type: string
          location_lat: number | null
          location_lng: number | null
          photo_storage_path: string | null
          skip_note: string | null
          skip_reason: string
          team_id: string
        }
        Insert: {
          created_at?: string | null
          crew_member_id?: string | null
          id?: string
          job_id: string
          job_type: string
          location_lat?: number | null
          location_lng?: number | null
          photo_storage_path?: string | null
          skip_note?: string | null
          skip_reason: string
          team_id: string
        }
        Update: {
          created_at?: string | null
          crew_member_id?: string | null
          id?: string
          job_id?: string
          job_type?: string
          location_lat?: number | null
          location_lng?: number | null
          photo_storage_path?: string | null
          skip_note?: string | null
          skip_reason?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signoff_skips_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signoff_skips_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      single_item_rates: {
        Row: {
          base_price_max: number
          base_price_min: number
          created_at: string
          id: string
          item_category: string
          notes: string | null
          weight_class: string | null
        }
        Insert: {
          base_price_max: number
          base_price_min: number
          created_at?: string
          id?: string
          item_category: string
          notes?: string | null
          weight_class?: string | null
        }
        Update: {
          base_price_max?: number
          base_price_min?: number
          created_at?: string
          id?: string
          item_category?: string
          notes?: string | null
          weight_class?: string | null
        }
        Relationships: []
      }
      slack_message_events: {
        Row: {
          author: string
          body: string
          channel_id: string
          created_at: string
          id: string
          is_bot: boolean
          ts: string
        }
        Insert: {
          author: string
          body: string
          channel_id: string
          created_at?: string
          id?: string
          is_bot?: boolean
          ts: string
        }
        Update: {
          author?: string
          body?: string
          channel_id?: string
          created_at?: string
          id?: string
          is_bot?: boolean
          ts?: string
        }
        Relationships: []
      }
      sms_log: {
        Row: {
          created_at: string
          id: string
          message_body: string
          message_type: string
          recipient_name: string | null
          recipient_phone: string
          related_id: string | null
          related_type: string | null
          sent_at: string | null
          status: string | null
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_body: string
          message_type: string
          recipient_name?: string | null
          recipient_phone: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_body?: string
          message_type?: string
          recipient_name?: string | null
          recipient_phone?: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Relationships: []
      }
      specialty_surcharges: {
        Row: {
          created_at: string
          id: string
          item_type: string
          notes: string | null
          requires_specialty_crew: boolean | null
          surcharge: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_type: string
          notes?: string | null
          requires_specialty_crew?: boolean | null
          surcharge: number
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          notes?: string | null
          requires_specialty_crew?: boolean | null
          surcharge?: number
        }
        Relationships: []
      }
      staff_roster: {
        Row: {
          created_at: string | null
          deactivated_at: string | null
          email: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string
          specialties: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string
          specialties?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string
          specialties?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      status_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          entity_id: string
          entity_type: string
          event_type: string
          icon: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          entity_id: string
          entity_type: string
          event_type: string
          icon?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          icon?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supplies_orders: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          fulfillment: string | null
          hst: number
          id: string
          items: Json
          move_id: string | null
          order_number: string
          payment_status: string | null
          square_card_id: string | null
          square_customer_id: string | null
          square_payment_id: string | null
          status: string | null
          subtotal: number
          total: number
          updated_at: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          fulfillment?: string | null
          hst: number
          id?: string
          items?: Json
          move_id?: string | null
          order_number: string
          payment_status?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_payment_id?: string | null
          status?: string | null
          subtotal: number
          total: number
          updated_at?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          fulfillment?: string | null
          hst?: number
          id?: string
          items?: Json
          move_id?: string | null
          order_number?: string
          payment_status?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_payment_id?: string | null
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplies_orders_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_features: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          feature: string
          id: string
          service_type: string
          tier: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          feature: string
          id?: string
          service_type: string
          tier: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          feature?: string
          id?: string
          service_type?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      tips: {
        Row: {
          amount: number
          charged_at: string | null
          client_name: string | null
          created_at: string
          crew_id: string | null
          crew_name: string | null
          delivery_id: string | null
          id: string
          job_type: string
          method: string
          move_id: string | null
          neighbourhood: string | null
          net_amount: number | null
          processing_fee: number | null
          report_note: string | null
          reported_at: string | null
          reported_by: string | null
          service_type: string | null
          square_payment_id: string | null
          tier: string | null
        }
        Insert: {
          amount: number
          charged_at?: string | null
          client_name?: string | null
          created_at?: string
          crew_id?: string | null
          crew_name?: string | null
          delivery_id?: string | null
          id?: string
          job_type?: string
          method?: string
          move_id?: string | null
          neighbourhood?: string | null
          net_amount?: number | null
          processing_fee?: number | null
          report_note?: string | null
          reported_at?: string | null
          reported_by?: string | null
          service_type?: string | null
          square_payment_id?: string | null
          tier?: string | null
        }
        Update: {
          amount?: number
          charged_at?: string | null
          client_name?: string | null
          created_at?: string
          crew_id?: string | null
          crew_name?: string | null
          delivery_id?: string | null
          id?: string
          job_type?: string
          method?: string
          move_id?: string | null
          neighbourhood?: string | null
          net_amount?: number | null
          processing_fee?: number | null
          report_note?: string | null
          reported_at?: string | null
          reported_by?: string | null
          service_type?: string | null
          square_payment_id?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_sessions: {
        Row: {
          checkpoints: Json | null
          completed_at: string | null
          created_at: string | null
          crew_lead_id: string
          id: string
          is_active: boolean
          job_id: string
          job_type: string
          last_location: Json | null
          started_at: string | null
          status: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          checkpoints?: Json | null
          completed_at?: string | null
          created_at?: string | null
          crew_lead_id: string
          id?: string
          is_active?: boolean
          job_id: string
          job_type: string
          last_location?: Json | null
          started_at?: string | null
          status?: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          checkpoints?: Json | null
          completed_at?: string | null
          created_at?: string | null
          crew_lead_id?: string
          id?: string
          is_active?: boolean
          job_id?: string
          job_type?: string
          last_location?: Json | null
          started_at?: string | null
          status?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_sessions_crew_lead_id_fkey"
            columns: ["crew_lead_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_allocation_rules: {
        Row: {
          created_at: string | null
          id: string
          inventory_range: string
          move_size: string
          notes: string | null
          primary_vehicle: string
          secondary_vehicle: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_range: string
          move_size: string
          notes?: string | null
          primary_vehicle: string
          secondary_vehicle?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_range?: string
          move_size?: string
          notes?: string | null
          primary_vehicle?: string
          secondary_vehicle?: string | null
        }
        Relationships: []
      }
      truck_assignments: {
        Row: {
          created_at: string | null
          date: string
          id: string
          team_id: string
          truck_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          team_id: string
          truck_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          team_id?: string
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_assignments_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_equipment: {
        Row: {
          assigned_quantity: number
          current_quantity: number
          equipment_id: string
          id: string
          last_checked: string | null
          last_checked_by: string | null
          truck_id: string
        }
        Insert: {
          assigned_quantity: number
          current_quantity: number
          equipment_id: string
          id?: string
          last_checked?: string | null
          last_checked_by?: string | null
          truck_id: string
        }
        Update: {
          assigned_quantity?: number
          current_quantity?: number
          equipment_id?: string
          id?: string
          last_checked?: string | null
          last_checked_by?: string | null
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_equipment_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_initials: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          org_id: string | null
          phone: string | null
          role: string
        }
        Insert: {
          auth_id?: string | null
          avatar_initials?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          org_id?: string | null
          phone?: string | null
          role: string
        }
        Update: {
          auth_id?: string | null
          avatar_initials?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          org_id?: string | null
          phone?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_tiers: {
        Row: {
          active: boolean | null
          covers: string[]
          created_at: string | null
          damage_process: string
          deductible: number | null
          display_name: string
          excludes: string[]
          id: string
          included_in_package: string
          max_per_item: number | null
          max_per_shipment: number | null
          rate_description: string
          rate_per_pound: number | null
          tier_slug: string
        }
        Insert: {
          active?: boolean | null
          covers: string[]
          created_at?: string | null
          damage_process: string
          deductible?: number | null
          display_name: string
          excludes: string[]
          id?: string
          included_in_package: string
          max_per_item?: number | null
          max_per_shipment?: number | null
          rate_description: string
          rate_per_pound?: number | null
          tier_slug: string
        }
        Update: {
          active?: boolean | null
          covers?: string[]
          created_at?: string | null
          damage_process?: string
          deductible?: number | null
          display_name?: string
          excludes?: string[]
          id?: string
          included_in_package?: string
          max_per_item?: number | null
          max_per_shipment?: number | null
          rate_description?: string
          rate_per_pound?: number | null
          tier_slug?: string
        }
        Relationships: []
      }
      valuation_upgrades: {
        Row: {
          active: boolean | null
          assumed_shipment_value: number
          created_at: string | null
          from_package: string
          id: string
          move_size: string
          price: number
          to_tier: string
        }
        Insert: {
          active?: boolean | null
          assumed_shipment_value: number
          created_at?: string | null
          from_package: string
          id?: string
          move_size: string
          price: number
          to_tier: string
        }
        Update: {
          active?: boolean | null
          assumed_shipment_value?: number
          created_at?: string | null
          from_package?: string
          id?: string
          move_size?: string
          price?: number
          to_tier?: string
        }
        Relationships: []
      }
      vehicle_maintenance_log: {
        Row: {
          cost: number | null
          created_at: string | null
          created_by: string | null
          id: string
          maintenance_date: string
          maintenance_type: string
          notes: string | null
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type: string
          notes?: string | null
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          notes?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_log_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      volume_benchmarks: {
        Row: {
          assumed_boxes: number
          baseline_crew: number | null
          baseline_hours: number | null
          benchmark_score: number
          box_score: number
          created_at: string | null
          id: string
          max_modifier: number
          min_items_for_adjustment: number
          min_modifier: number
          move_size: string
          std_item_score: number
          std_major_items: number
        }
        Insert: {
          assumed_boxes: number
          baseline_crew?: number | null
          baseline_hours?: number | null
          benchmark_score: number
          box_score: number
          created_at?: string | null
          id?: string
          max_modifier?: number
          min_items_for_adjustment: number
          min_modifier?: number
          move_size: string
          std_item_score: number
          std_major_items: number
        }
        Update: {
          assumed_boxes?: number
          baseline_crew?: number | null
          baseline_hours?: number | null
          benchmark_score?: number
          box_score?: number
          created_at?: string | null
          id?: string
          max_modifier?: number
          min_items_for_adjustment?: number
          min_modifier?: number
          move_size?: string
          std_item_score?: number
          std_major_items?: number
        }
        Relationships: []
      }
      webhook_idempotency_keys: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          source: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error: string | null
          event_type: string | null
          id: string
          payload: Json | null
          source: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          source: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          source?: string
          status?: string | null
        }
        Relationships: []
      }
      widget_leads: {
        Row: {
          converted: boolean | null
          created_at: string | null
          from_postal: string | null
          high_estimate: number | null
          id: string
          ip_address: string | null
          low_estimate: number | null
          month: string | null
          move_size: string | null
          to_postal: string | null
          user_agent: string | null
        }
        Insert: {
          converted?: boolean | null
          created_at?: string | null
          from_postal?: string | null
          high_estimate?: number | null
          id?: string
          ip_address?: string | null
          low_estimate?: number | null
          month?: string | null
          move_size?: string | null
          to_postal?: string | null
          user_agent?: string | null
        }
        Update: {
          converted?: boolean | null
          created_at?: string | null
          from_postal?: string | null
          high_estimate?: number | null
          id?: string
          ip_address?: string | null
          low_estimate?: number | null
          month?: string | null
          move_size?: string | null
          to_postal?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_nearby_building: {
        Args: { radius_meters?: number; search_lat: number; search_lng: number }
        Returns: {
          access_archetype: string | null
          address: string
          building_name: string | null
          building_type: string
          carry_band: string | null
          coi_deposit: number | null
          coi_required: boolean | null
          commercial_floors: string | null
          commercial_tenants: string[] | null
          complexity_rating: number
          coordinator_notes: string | null
          created_at: string
          crew_notes: string | null
          doorway_dimensions: string | null
          elevator_booking_required: boolean
          elevator_max_hours: number | null
          elevator_shared: boolean
          elevator_system: string
          elevator_type: string | null
          elevator_window_minutes: number | null
          entrance_steps_band: string | null
          estimated_extra_minutes_per_trip: number
          freight_elevator: boolean
          freight_elevator_dimensions: string | null
          freight_elevator_location: string | null
          hallway_width: string | null
          has_commercial_tenants: boolean
          id: string
          interior_levels: number | null
          last_move_date: string | null
          latitude: number | null
          loading_dock: boolean
          loading_dock_booking_required: boolean
          loading_dock_location: string | null
          loading_dock_restrictions: string | null
          lobby_walk_band: string | null
          longitude: number | null
          management_company: string | null
          max_item_length: string | null
          move_hours: string | null
          one_move_per_day: boolean | null
          parking_notes: string | null
          parking_type: string | null
          photo_urls: string[] | null
          postal_code: string | null
          residential_elevator_location: string | null
          residential_floors: string | null
          source: string | null
          stair_flights: number | null
          stair_type: string | null
          stair_width_band: string | null
          staircase_type: string | null
          times_moved_here: number
          total_elevator_transfers: number
          total_floors: number | null
          total_units: number | null
          transfer_floors: string[] | null
          truck_spot: string | null
          two_stage_transfer: boolean | null
          unit_floor: number | null
          updated_at: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "building_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_inbound_shipment_number: { Args: never; Returns: string }
      generate_record_id: { Args: { prefix: string }; Returns: string }
      generate_recurring_deliveries: { Args: never; Returns: undefined }
      get_next_schedule_date: {
        Args: {
          p_days_of_week: number[]
          p_frequency: string
          p_from_date?: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      max_quote_numeric_suffix: {
        Args: { quote_prefix: string }
        Returns: number
      }
      my_crew_id: { Args: never; Returns: string }
      my_org_id: { Args: never; Returns: string }
      my_role: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      expense_category:
        | "parking"
        | "supplies"
        | "fuel"
        | "tolls"
        | "food"
        | "other"
      expense_status: "pending" | "approved" | "rejected"
      photo_category:
        | "pre_move_condition"
        | "loading"
        | "in_transit"
        | "delivery_placement"
        | "post_move_condition"
        | "damage_documentation"
        | "other"
        | "walkthrough_final"
      tracking_status:
        | "not_started"
        | "en_route_to_pickup"
        | "arrived_at_pickup"
        | "loading"
        | "en_route_to_destination"
        | "arrived_at_destination"
        | "unloading"
        | "completed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      expense_category: [
        "parking",
        "supplies",
        "fuel",
        "tolls",
        "food",
        "other",
      ],
      expense_status: ["pending", "approved", "rejected"],
      photo_category: [
        "pre_move_condition",
        "loading",
        "in_transit",
        "delivery_placement",
        "post_move_condition",
        "damage_documentation",
        "other",
        "walkthrough_final",
      ],
      tracking_status: [
        "not_started",
        "en_route_to_pickup",
        "arrived_at_pickup",
        "loading",
        "en_route_to_destination",
        "arrived_at_destination",
        "unloading",
        "completed",
      ],
    },
  },
} as const
