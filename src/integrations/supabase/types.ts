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
      base_composicoes: {
        Row: {
          classe: string | null
          codigo: string
          created_at: string
          custo_unitario: number | null
          descricao: string
          fonte: string
          id: number
          mes_ref: string | null
          unidade: string | null
        }
        Insert: {
          classe?: string | null
          codigo: string
          created_at?: string
          custo_unitario?: number | null
          descricao: string
          fonte: string
          id?: number
          mes_ref?: string | null
          unidade?: string | null
        }
        Update: {
          classe?: string | null
          codigo?: string
          created_at?: string
          custo_unitario?: number | null
          descricao?: string
          fonte?: string
          id?: number
          mes_ref?: string | null
          unidade?: string | null
        }
        Relationships: []
      }
      base_insumos: {
        Row: {
          codigo: string
          created_at: string
          descricao: string
          fonte: string
          id: number
          mes_ref: string | null
          origem: string | null
          preco: number | null
          unidade: string | null
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao: string
          fonte?: string
          id?: number
          mes_ref?: string | null
          origem?: string | null
          preco?: number | null
          unidade?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string
          fonte?: string
          id?: number
          mes_ref?: string | null
          origem?: string | null
          preco?: number | null
          unidade?: string | null
        }
        Relationships: []
      }
      orcamento_cronograma: {
        Row: {
          created_at: string
          etapa: string
          id: string
          mes: number
          orcamento_id: string
          percentual: number
        }
        Insert: {
          created_at?: string
          etapa: string
          id?: string
          mes: number
          orcamento_id: string
          percentual?: number
        }
        Update: {
          created_at?: string
          etapa?: string
          id?: string
          mes?: number
          orcamento_id?: string
          percentual?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_cronograma_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          codigo: string | null
          created_at: string
          descricao: string
          etapa: string | null
          fonte: string | null
          id: string
          item: string | null
          orcamento_id: string
          ordem: number
          preco_unitario: number
          quantidade: number
          unidade: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descricao: string
          etapa?: string | null
          fonte?: string | null
          id?: string
          item?: string | null
          orcamento_id: string
          ordem?: number
          preco_unitario?: number
          quantidade?: number
          unidade?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descricao?: string
          etapa?: string | null
          fonte?: string | null
          id?: string
          item?: string | null
          orcamento_id?: string
          ordem?: number
          preco_unitario?: number
          quantidade?: number
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          bdi_pct: number
          contrato: string | null
          crea: string | null
          created_at: string
          encargos_pct: number
          engenheiro: string | null
          id: string
          municipio: string | null
          nome: string
          objeto: string | null
          orgao: string | null
          ref_precos: string | null
          status: string
          uf: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bdi_pct?: number
          contrato?: string | null
          crea?: string | null
          created_at?: string
          encargos_pct?: number
          engenheiro?: string | null
          id?: string
          municipio?: string | null
          nome: string
          objeto?: string | null
          orgao?: string | null
          ref_precos?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bdi_pct?: number
          contrato?: string | null
          crea?: string | null
          created_at?: string
          encargos_pct?: number
          engenheiro?: string | null
          id?: string
          municipio?: string | null
          nome?: string
          objeto?: string | null
          orgao?: string | null
          ref_precos?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          empresa: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
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
    Enums: {},
  },
} as const
