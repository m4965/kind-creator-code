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
      contacts: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string | null
          notes: string | null
          phone: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          phone: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          contact_id: string
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string
          unread: number
          user_id: string
        }
        Insert: {
          ai_enabled?: boolean
          contact_id: string
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          unread?: number
          user_id: string
        }
        Update: {
          ai_enabled?: boolean
          contact_id?: string
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          unread?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          edges: Json
          id: string
          name: string
          nodes: Json
          session_id: string | null
          trigger_keywords: string[]
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          name: string
          nodes?: Json
          session_id?: string | null
          trigger_keywords?: string[]
          trigger_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          name?: string
          nodes?: Json
          session_id?: string | null
          trigger_keywords?: string[]
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      funnel_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          order: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          order?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          order?: number
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          order: number
          stage_id: string | null
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order?: number
          stage_id?: string | null
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order?: number
          stage_id?: string | null
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          media_url: string | null
          meta: Json
          role: Database["public"]["Enums"]["message_role"]
          transcript: string | null
          type: Database["public"]["Enums"]["message_type"]
          user_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          media_url?: string | null
          meta?: Json
          role: Database["public"]["Enums"]["message_role"]
          transcript?: string | null
          type?: Database["public"]["Enums"]["message_type"]
          user_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          media_url?: string | null
          meta?: Json
          role?: Database["public"]["Enums"]["message_role"]
          transcript?: string | null
          type?: Database["public"]["Enums"]["message_type"]
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
      payments: {
        Row: {
          amount: number | null
          conversation_id: string
          created_at: string
          extracted: Json
          id: string
          media_url: string | null
          message_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount?: number | null
          conversation_id: string
          created_at?: string
          extracted?: Json
          id?: string
          media_url?: string | null
          message_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount?: number | null
          conversation_id?: string
          created_at?: string
          extracted?: Json
          id?: string
          media_url?: string | null
          message_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          media_type: Database["public"]["Enums"]["message_type"] | null
          media_url: string | null
          shortcut: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          media_type?: Database["public"]["Enums"]["message_type"] | null
          media_url?: string | null
          shortcut: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_type?: Database["public"]["Enums"]["message_type"] | null
          media_url?: string | null
          shortcut?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          evolution_instance: string | null
          evolution_key: string | null
          evolution_url: string | null
          groq_audio_model: string | null
          groq_key: string | null
          groq_model: string | null
          groq_vision_model: string | null
          system_prompt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          evolution_instance?: string | null
          evolution_key?: string | null
          evolution_url?: string | null
          groq_audio_model?: string | null
          groq_key?: string | null
          groq_model?: string | null
          groq_vision_model?: string | null
          system_prompt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          evolution_instance?: string | null
          evolution_key?: string | null
          evolution_url?: string | null
          groq_audio_model?: string | null
          groq_key?: string | null
          groq_model?: string | null
          groq_vision_model?: string | null
          system_prompt?: string | null
          updated_at?: string
          user_id?: string
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
      whatsapp_sessions: {
        Row: {
          active: boolean
          api_key: string
          created_at: string
          id: string
          instance: string
          name: string
          provider: string
          status: string
          updated_at: string
          url: string
          user_id: string
          webhook_secret: string
        }
        Insert: {
          active?: boolean
          api_key?: string
          created_at?: string
          id?: string
          instance?: string
          name: string
          provider?: string
          status?: string
          updated_at?: string
          url?: string
          user_id: string
          webhook_secret?: string
        }
        Update: {
          active?: boolean
          api_key?: string
          created_at?: string
          id?: string
          instance?: string
          name?: string
          provider?: string
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
          webhook_secret?: string
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
      app_role: "admin" | "user"
      message_role: "user" | "assistant" | "system"
      message_type: "text" | "image" | "audio" | "video" | "document"
      payment_status: "pending" | "confirmed" | "rejected"
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
      app_role: ["admin", "user"],
      message_role: ["user", "assistant", "system"],
      message_type: ["text", "image", "audio", "video", "document"],
      payment_status: ["pending", "confirmed", "rejected"],
    },
  },
} as const
