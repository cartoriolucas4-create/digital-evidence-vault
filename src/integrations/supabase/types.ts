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
  public: {
    Tables: {
      access_events: {
        Row: {
          browser: Json | null
          case_id: string
          client_timestamp: string | null
          clock_skew_ms: number | null
          geolocation: Json | null
          headers: Json
          http_method: string | null
          http_path: string | null
          http_status: number | null
          http_version: string | null
          id: string
          ip_direct: string | null
          ip_proxy: string | null
          ip_source: string | null
          ip_v4: string | null
          ip_v6: string | null
          metadata_hash: string | null
          protocol: string | null
          server_timestamp_utc: string
          server_timezone: string | null
          session_id: string
          source_port: number | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          browser?: Json | null
          case_id: string
          client_timestamp?: string | null
          clock_skew_ms?: number | null
          geolocation?: Json | null
          headers?: Json
          http_method?: string | null
          http_path?: string | null
          http_status?: number | null
          http_version?: string | null
          id?: string
          ip_direct?: string | null
          ip_proxy?: string | null
          ip_source?: string | null
          ip_v4?: string | null
          ip_v6?: string | null
          metadata_hash?: string | null
          protocol?: string | null
          server_timestamp_utc?: string
          server_timezone?: string | null
          session_id: string
          source_port?: number | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          browser?: Json | null
          case_id?: string
          client_timestamp?: string | null
          clock_skew_ms?: number | null
          geolocation?: Json | null
          headers?: Json
          http_method?: string | null
          http_path?: string | null
          http_status?: number | null
          http_version?: string | null
          id?: string
          ip_direct?: string | null
          ip_proxy?: string | null
          ip_source?: string | null
          ip_v4?: string | null
          ip_v6?: string | null
          metadata_hash?: string | null
          protocol?: string | null
          server_timestamp_utc?: string
          server_timezone?: string | null
          session_id?: string
          source_port?: number | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cases: {
        Row: {
          campaign_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          investigation_id: string | null
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          investigation_id?: string | null
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          investigation_id?: string | null
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      disciplines: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      evidence_files: {
        Row: {
          camera_facing: string | null
          case_id: string
          client_timestamp: string | null
          event_id: string
          extension: string | null
          height: number | null
          id: string
          kind: string
          mime_type: string | null
          received_at: string
          sha256: string
          size_bytes: number | null
          storage_path: string
          width: number | null
        }
        Insert: {
          camera_facing?: string | null
          case_id: string
          client_timestamp?: string | null
          event_id: string
          extension?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          received_at?: string
          sha256: string
          size_bytes?: number | null
          storage_path: string
          width?: number | null
        }
        Update: {
          camera_facing?: string | null
          case_id?: string
          client_timestamp?: string | null
          event_id?: string
          extension?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          received_at?: string
          sha256?: string
          size_bytes?: number | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_files_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "access_events"
            referencedColumns: ["id"]
          },
        ]
      }
      question_types: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      study_disciplines: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      study_entries: {
        Row: {
          correct: number
          created_at: string
          discipline_id: string
          id: string
          notes: string | null
          question_type_id: string | null
          questions: number
          source_id: string | null
          study_date: string
          subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          correct?: number
          created_at?: string
          discipline_id: string
          id?: string
          notes?: string | null
          question_type_id?: string | null
          questions?: number
          source_id?: string | null
          study_date?: string
          subject_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          correct?: number
          created_at?: string
          discipline_id?: string
          id?: string
          notes?: string | null
          question_type_id?: string | null
          questions?: number
          source_id?: string | null
          study_date?: string
          subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_entries_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_entries_question_type_id_fkey"
            columns: ["question_type_id"]
            isOneToOne: false
            referencedRelation: "study_question_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_entries_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "study_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "study_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_question_types: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      study_settings: {
        Row: {
          daily_goal: number
          monthly_goal: number
          student_name: string
          target_accuracy: number
          updated_at: string
          user_id: string
          weekly_goal: number
        }
        Insert: {
          daily_goal?: number
          monthly_goal?: number
          student_name?: string
          target_accuracy?: number
          updated_at?: string
          user_id: string
          weekly_goal?: number
        }
        Update: {
          daily_goal?: number
          monthly_goal?: number
          student_name?: string
          target_accuracy?: number
          updated_at?: string
          user_id?: string
          weekly_goal?: number
        }
        Relationships: []
      }
      study_sources: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      study_subjects: {
        Row: {
          created_at: string
          discipline_id: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discipline_id: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          discipline_id?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_subjects_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          discipline_id: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discipline_id: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          discipline_id?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          daily_goal: number
          target_accuracy: number
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_goal?: number
          target_accuracy?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_goal?: number
          target_accuracy?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
