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
    PostgrestVersion: "14.5"
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
      bookings: {
        Row: {
          date: string
          date_booked: string | null
          duration: string | null
          employee_id: string
          id: string
          room: string | null
          status: string
          synced_at: string
          time_from: string | null
          time_to: string | null
          work_location: string | null
        }
        Insert: {
          date: string
          date_booked?: string | null
          duration?: string | null
          employee_id: string
          id?: string
          room?: string | null
          status: string
          synced_at?: string
          time_from?: string | null
          time_to?: string | null
          work_location?: string | null
        }
        Update: {
          date?: string
          date_booked?: string | null
          duration?: string | null
          employee_id?: string
          id?: string
          room?: string | null
          status?: string
          synced_at?: string
          time_from?: string | null
          time_to?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      clockings: {
        Row: {
          clocking_status: string | null
          date: string
          day_of_week: string
          employee_id: string
          hours_worked: number | null
          id: string
          location_in_lat: number | null
          location_in_lng: number | null
          location_in_name: string | null
          location_out_lat: number | null
          location_out_lng: number | null
          location_out_name: string | null
          synced_at: string
          time_in: string | null
          time_out: string | null
        }
        Insert: {
          clocking_status?: string | null
          date: string
          day_of_week: string
          employee_id: string
          hours_worked?: number | null
          id?: string
          location_in_lat?: number | null
          location_in_lng?: number | null
          location_in_name?: string | null
          location_out_lat?: number | null
          location_out_lng?: number | null
          location_out_name?: string | null
          synced_at?: string
          time_in?: string | null
          time_out?: string | null
        }
        Update: {
          clocking_status?: string | null
          date?: string
          day_of_week?: string
          employee_id?: string
          hours_worked?: number | null
          id?: string
          location_in_lat?: number | null
          location_in_lng?: number | null
          location_in_name?: string | null
          location_out_lat?: number | null
          location_out_lng?: number | null
          location_out_name?: string | null
          synced_at?: string
          time_in?: string | null
          time_out?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clockings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_records: {
        Row: {
          actual_status: Database["public"]["Enums"]["actual_status"]
          comment: string | null
          created_at: string
          date: string
          employee_id: string
          expected_status: Database["public"]["Enums"]["schedule_status"] | null
          flags: Database["public"]["Enums"]["compliance_flag"][] | null
          has_booking: boolean
          has_clocking: boolean
          id: string
          is_compliant: boolean
          location_match: boolean | null
          override_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          week_number: number
        }
        Insert: {
          actual_status: Database["public"]["Enums"]["actual_status"]
          comment?: string | null
          created_at?: string
          date: string
          employee_id: string
          expected_status?:
            | Database["public"]["Enums"]["schedule_status"]
            | null
          flags?: Database["public"]["Enums"]["compliance_flag"][] | null
          has_booking?: boolean
          has_clocking?: boolean
          id?: string
          is_compliant?: boolean
          location_match?: boolean | null
          override_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          week_number: number
        }
        Update: {
          actual_status?: Database["public"]["Enums"]["actual_status"]
          comment?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          expected_status?:
            | Database["public"]["Enums"]["schedule_status"]
            | null
          flags?: Database["public"]["Enums"]["compliance_flag"][] | null
          has_booking?: boolean
          has_clocking?: boolean
          id?: string
          is_compliant?: boolean
          location_match?: boolean | null
          override_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_records_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_user_id: string | null
          business_unit: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          job_schedule: string | null
          last_name: string
          notes: string | null
          office_days_per_week: number
          role: Database["public"]["Enums"]["user_role"]
          talexio_id: string | null
          team_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          business_unit?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          job_schedule?: string | null
          last_name: string
          notes?: string | null
          office_days_per_week?: number
          role?: Database["public"]["Enums"]["user_role"]
          talexio_id?: string | null
          team_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          business_unit?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          job_schedule?: string | null
          last_name?: string
          notes?: string | null
          office_days_per_week?: number
          role?: Database["public"]["Enums"]["user_role"]
          talexio_id?: string | null
          team_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      office_locations: {
        Row: {
          created_at: string
          id: string
          ip_ranges: string[] | null
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters: number
        }
        Insert: {
          created_at?: string
          id?: string
          ip_ranges?: string[] | null
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters?: number
        }
        Update: {
          created_at?: string
          id?: string
          ip_ranges?: string[] | null
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      schedule_rules: {
        Row: {
          applies_to_team_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          rule_type: string
          value: Json
        }
        Insert: {
          applies_to_team_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          rule_type: string
          value: Json
        }
        Update: {
          applies_to_team_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rule_type?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "schedule_rules_applies_to_team_id_fkey"
            columns: ["applies_to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_employee_id: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_manager_of: { Args: { target_employee_id: string }; Returns: boolean }
    }
    Enums: {
      actual_status:
        | "in_office_confirmed"
        | "wfh_confirmed"
        | "no_clocking"
        | "wrong_location"
        | "broken_clocking"
        | "no_booking"
        | "vacation"
        | "public_holiday"
        | "unknown"
      compliance_flag:
        | "missing_clocking"
        | "missing_clock_out"
        | "wrong_location"
        | "no_desk_booking"
        | "late_arrival"
        | "clocking_not_closed"
        | "schedule_mismatch"
        | "exceeded_wfh_days"
      schedule_status:
        | "office"
        | "wfh"
        | "public_holiday"
        | "vacation"
        | "sick_leave"
        | "not_scheduled"
      user_role: "employee" | "manager" | "hr_admin" | "super_admin"
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
      actual_status: [
        "in_office_confirmed",
        "wfh_confirmed",
        "no_clocking",
        "wrong_location",
        "broken_clocking",
        "no_booking",
        "vacation",
        "public_holiday",
        "unknown",
      ],
      compliance_flag: [
        "missing_clocking",
        "missing_clock_out",
        "wrong_location",
        "no_desk_booking",
        "late_arrival",
        "clocking_not_closed",
        "schedule_mismatch",
        "exceeded_wfh_days",
      ],
      schedule_status: [
        "office",
        "wfh",
        "public_holiday",
        "vacation",
        "sick_leave",
        "not_scheduled",
      ],
      user_role: ["employee", "manager", "hr_admin", "super_admin"],
    },
  },
} as const
