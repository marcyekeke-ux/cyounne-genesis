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
      agent_events: {
        Row: {
          app_connection_id: string | null
          created_at: string
          description: string | null
          event_type: string
          handled: boolean
          id: string
          payload: Json
          severity: string
          title: string
        }
        Insert: {
          app_connection_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          handled?: boolean
          id?: string
          payload?: Json
          severity?: string
          title: string
        }
        Update: {
          app_connection_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          handled?: boolean
          id?: string
          payload?: Json
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_app_connection_id_fkey"
            columns: ["app_connection_id"]
            isOneToOne: false
            referencedRelation: "app_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level: Database["public"]["Enums"]["alert_level"]
          member_id: string | null
          resolved: boolean
          source: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level: Database["public"]["Enums"]["alert_level"]
          member_id?: string | null
          resolved?: boolean
          source?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["alert_level"]
          member_id?: string | null
          resolved?: boolean
          source?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          api_key: string | null
          enabled: boolean
          extra_config: Json | null
          id: string
          service: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          enabled?: boolean
          extra_config?: Json | null
          id?: string
          service: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          enabled?: boolean
          extra_config?: Json | null
          id?: string
          service?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      app_connections: {
        Row: {
          app_type: string
          created_at: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          last_sync_status: string | null
          name: string
          schema_cache: Json
          service_role_key: string | null
          supabase_anon_key: string
          supabase_url: string
          table_mapping: Json
          updated_at: string
        }
        Insert: {
          app_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          name: string
          schema_cache?: Json
          service_role_key?: string | null
          supabase_anon_key: string
          supabase_url: string
          table_mapping?: Json
          updated_at?: string
        }
        Update: {
          app_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          name?: string
          schema_cache?: Json
          service_role_key?: string | null
          supabase_anon_key?: string
          supabase_url?: string
          table_mapping?: Json
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          target: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          mode: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string
          validated: boolean
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          validated?: boolean
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          validated?: boolean
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          metadata: Json | null
          mime_type: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          label: string
          metadata?: Json | null
          mime_type?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          metadata?: Json | null
          mime_type?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          avatar_url: string | null
          birthday: string | null
          creances: number
          cumul: number
          email: string | null
          full_name: string
          gages: number
          id: string
          joined_at: string
          level: Database["public"]["Enums"]["app_role"]
          metadata: Json | null
          pax_id: string
          phone: string | null
          qr_code: string | null
          status: Database["public"]["Enums"]["member_status"]
          team_leader: string | null
          trust_score: number
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          birthday?: string | null
          creances?: number
          cumul?: number
          email?: string | null
          full_name: string
          gages?: number
          id?: string
          joined_at?: string
          level?: Database["public"]["Enums"]["app_role"]
          metadata?: Json | null
          pax_id: string
          phone?: string | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          team_leader?: string | null
          trust_score?: number
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          birthday?: string | null
          creances?: number
          cumul?: number
          email?: string | null
          full_name?: string
          gages?: number
          id?: string
          joined_at?: string
          level?: Database["public"]["Enums"]["app_role"]
          metadata?: Json | null
          pax_id?: string
          phone?: string | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          team_leader?: string | null
          trust_score?: number
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          provider: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          provider?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          provider?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          gender: string | null
          id: string
          updated_at: string
          voice_signature: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id: string
          updated_at?: string
          voice_signature?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id?: string
          updated_at?: string
          voice_signature?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          label: string | null
          metadata: Json | null
          player_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json | null
          player_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json | null
          player_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          content: Json
          created_at: string
          generated_by: string | null
          id: string
          pdf_url: string | null
          title: string
          type: string
        }
        Insert: {
          content: Json
          created_at?: string
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          title: string
          type: string
        }
        Update: {
          content?: Json
          created_at?: string
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          title?: string
          type?: string
        }
        Relationships: []
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
      whatsapp_messages: {
        Row: {
          body: string | null
          created_at: string
          cyounne_reply: string | null
          direction: string
          from_number: string
          id: string
          metadata: Json | null
          status: string | null
          to_number: string | null
          wa_message_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          cyounne_reply?: string | null
          direction: string
          from_number: string
          id?: string
          metadata?: Json | null
          status?: string | null
          to_number?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          cyounne_reply?: string | null
          direction?: string
          from_number?: string
          id?: string
          metadata?: Json | null
          status?: string | null
          to_number?: string | null
          wa_message_id?: string | null
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
      alert_level: "leger" | "moyen" | "grave"
      app_role: "admin" | "pax" | "mega_pax" | "super_pax" | "roi" | "reine"
      member_status: "actif" | "bloque" | "suspendu"
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
  public: {
    Enums: {
      alert_level: ["leger", "moyen", "grave"],
      app_role: ["admin", "pax", "mega_pax", "super_pax", "roi", "reine"],
      member_status: ["actif", "bloque", "suspendu"],
    },
  },
} as const
