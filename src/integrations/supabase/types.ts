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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: number
          metadata: Json
          organization_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: number
          metadata?: Json
          organization_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: number
          metadata?: Json
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_composicao_itens: {
        Row: {
          codigo_composicao: string
          codigo_item: string
          coeficiente: number
          created_at: string
          fonte: string
          fonte_item: string | null
          id: number
          tipo_item: string
        }
        Insert: {
          codigo_composicao: string
          codigo_item: string
          coeficiente?: number
          created_at?: string
          fonte: string
          fonte_item?: string | null
          id?: number
          tipo_item: string
        }
        Update: {
          codigo_composicao?: string
          codigo_item?: string
          coeficiente?: number
          created_at?: string
          fonte?: string
          fonte_item?: string | null
          id?: number
          tipo_item?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_composicao_itens_codigo_composicao_fonte_fkey"
            columns: ["codigo_composicao", "fonte"]
            isOneToOne: false
            referencedRelation: "catalogo_composicoes"
            referencedColumns: ["codigo", "fonte"]
          },
        ]
      }
      catalogo_composicoes: {
        Row: {
          access_mode: string
          classe: string | null
          codigo: string
          created_by: string | null
          descricao: string
          fonte: string
          organization_id: string | null
          unidade: string | null
        }
        Insert: {
          access_mode?: string
          classe?: string | null
          codigo: string
          created_by?: string | null
          descricao: string
          fonte: string
          organization_id?: string | null
          unidade?: string | null
        }
        Update: {
          access_mode?: string
          classe?: string | null
          codigo?: string
          created_by?: string | null
          descricao?: string
          fonte?: string
          organization_id?: string | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_composicoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_insumos: {
        Row: {
          codigo: string
          descricao: string
          fonte: string
          unidade: string | null
        }
        Insert: {
          codigo: string
          descricao: string
          fonte: string
          unidade?: string | null
        }
        Update: {
          codigo?: string
          descricao?: string
          fonte?: string
          unidade?: string | null
        }
        Relationships: []
      }
      composicao_shares: {
        Row: {
          codigo_composicao: string
          created_at: string
          fonte: string
          granted_by: string
          organization_id: string
          permission: string
        }
        Insert: {
          codigo_composicao: string
          created_at?: string
          fonte: string
          granted_by: string
          organization_id: string
          permission?: string
        }
        Update: {
          codigo_composicao?: string
          created_at?: string
          fonte?: string
          granted_by?: string
          organization_id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "composicao_shares_catalogo_fk"
            columns: ["codigo_composicao", "fonte"]
            isOneToOne: false
            referencedRelation: "catalogo_composicoes"
            referencedColumns: ["codigo", "fonte"]
          },
          {
            foreignKeyName: "composicao_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          created_at: string
          id: string
          nome: string
          plano: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          plano?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          plano?: string
          status?: string
        }
        Relationships: []
      }
      orcamento_bdis: {
        Row: {
          bdi_ac: number
          bdi_cf: number | null
          bdi_cofins: number | null
          bdi_g: number
          bdi_i: number
          bdi_iss: number | null
          bdi_l: number
          bdi_pct: number
          bdi_pis: number | null
          bdi_r: number
          bdi_s: number
          bdi_tax_estadual: number | null
          bdi_tax_inss: number | null
          created_at: string
          id: string
          nome: string
          orcamento_id: string
          updated_at: string
        }
        Insert: {
          bdi_ac?: number
          bdi_cf?: number | null
          bdi_cofins?: number | null
          bdi_g?: number
          bdi_i?: number
          bdi_iss?: number | null
          bdi_l?: number
          bdi_pct?: number
          bdi_pis?: number | null
          bdi_r?: number
          bdi_s?: number
          bdi_tax_estadual?: number | null
          bdi_tax_inss?: number | null
          created_at?: string
          id?: string
          nome: string
          orcamento_id: string
          updated_at?: string
        }
        Update: {
          bdi_ac?: number
          bdi_cf?: number | null
          bdi_cofins?: number | null
          bdi_g?: number
          bdi_i?: number
          bdi_iss?: number | null
          bdi_l?: number
          bdi_pct?: number
          bdi_pis?: number | null
          bdi_r?: number
          bdi_s?: number
          bdi_tax_estadual?: number | null
          bdi_tax_inss?: number | null
          created_at?: string
          id?: string
          nome?: string
          orcamento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_bdis_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
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
      orcamento_eventos: {
        Row: {
          created_at: string
          id: string
          numero: number
          orcamento_id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          numero: number
          orcamento_id: string
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          numero?: number
          orcamento_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_eventos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_frentes: {
        Row: {
          created_at: string
          id: string
          nome: string
          numero: number
          orcamento_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          numero: number
          orcamento_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          numero?: number
          orcamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_frentes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_item_frentes: {
        Row: {
          created_at: string
          frente_id: string
          id: string
          item_id: string
          mes_conclusao: number
          orcamento_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          frente_id: string
          id?: string
          item_id: string
          mes_conclusao?: number
          orcamento_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string
          frente_id?: string
          id?: string
          item_id?: string
          mes_conclusao?: number
          orcamento_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_item_frentes_frente_id_fkey"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "orcamento_frentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_item_frentes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_item_frentes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          bdi_id: string | null
          codigo: string | null
          created_at: string
          descricao: string
          etapa: string | null
          evento_id: string | null
          fonte: string | null
          id: string
          item: string | null
          memoria: Json | null
          orcamento_id: string
          ordem: number
          preco_unitario: number
          quantidade: number
          unidade: string | null
        }
        Insert: {
          bdi_id?: string | null
          codigo?: string | null
          created_at?: string
          descricao: string
          etapa?: string | null
          evento_id?: string | null
          fonte?: string | null
          id?: string
          item?: string | null
          memoria?: Json | null
          orcamento_id: string
          ordem?: number
          preco_unitario?: number
          quantidade?: number
          unidade?: string | null
        }
        Update: {
          bdi_id?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string
          etapa?: string | null
          evento_id?: string | null
          fonte?: string | null
          id?: string
          item?: string | null
          memoria?: Json | null
          orcamento_id?: string
          ordem?: number
          preco_unitario?: number
          quantidade?: number
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_bdi_id_fkey"
            columns: ["bdi_id"]
            isOneToOne: false
            referencedRelation: "orcamento_bdis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "orcamento_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_licitacoes: {
        Row: {
          created_at: string
          id: string
          modo: string
          orcamento_id: string
          updated_at: string
          valor_final: number
        }
        Insert: {
          created_at?: string
          id?: string
          modo?: string
          orcamento_id: string
          updated_at?: string
          valor_final: number
        }
        Update: {
          created_at?: string
          id?: string
          modo?: string
          orcamento_id?: string
          updated_at?: string
          valor_final?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_licitacoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: true
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_shares: {
        Row: {
          created_at: string
          granted_by: string
          orcamento_id: string
          organization_id: string
          permission: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          orcamento_id: string
          organization_id: string
          permission?: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          orcamento_id?: string
          organization_id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_shares_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          bdi_ac: number
          bdi_cf: number | null
          bdi_cofins: number | null
          bdi_g: number
          bdi_i: number
          bdi_iss: number | null
          bdi_l: number
          bdi_pct: number
          bdi_pis: number | null
          bdi_r: number
          bdi_s: number
          bdi_tax_estadual: number | null
          bdi_tax_inss: number | null
          contrato: string | null
          crea: string | null
          created_at: string
          encargos_modalidade: string
          encargos_pct: number
          encargos_sociais: Json | null
          engenheiro: string | null
          id: string
          interesse_licitacao: boolean
          interesse_transferegov: boolean
          localizacao: string | null
          municipio: string | null
          nome: string
          objeto: string | null
          organization_id: string | null
          orgao: string | null
          ref_precos: string | null
          regime: string
          status: string
          uf: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bdi_ac?: number
          bdi_cf?: number | null
          bdi_cofins?: number | null
          bdi_g?: number
          bdi_i?: number
          bdi_iss?: number | null
          bdi_l?: number
          bdi_pct?: number
          bdi_pis?: number | null
          bdi_r?: number
          bdi_s?: number
          bdi_tax_estadual?: number | null
          bdi_tax_inss?: number | null
          contrato?: string | null
          crea?: string | null
          created_at?: string
          encargos_modalidade?: string
          encargos_pct?: number
          encargos_sociais?: Json | null
          engenheiro?: string | null
          id?: string
          interesse_licitacao?: boolean
          interesse_transferegov?: boolean
          localizacao?: string | null
          municipio?: string | null
          nome: string
          objeto?: string | null
          organization_id?: string | null
          orgao?: string | null
          ref_precos?: string | null
          regime?: string
          status?: string
          uf?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bdi_ac?: number
          bdi_cf?: number | null
          bdi_cofins?: number | null
          bdi_g?: number
          bdi_i?: number
          bdi_iss?: number | null
          bdi_l?: number
          bdi_pct?: number
          bdi_pis?: number | null
          bdi_r?: number
          bdi_s?: number
          bdi_tax_estadual?: number | null
          bdi_tax_inss?: number | null
          contrato?: string | null
          crea?: string | null
          created_at?: string
          encargos_modalidade?: string
          encargos_pct?: number
          encargos_sociais?: Json | null
          engenheiro?: string | null
          id?: string
          interesse_licitacao?: boolean
          interesse_transferegov?: boolean
          localizacao?: string | null
          municipio?: string | null
          nome?: string
          objeto?: string | null
          organization_id?: string | null
          orgao?: string | null
          ref_precos?: string | null
          regime?: string
          status?: string
          uf?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          organization_id: string
          plan_code: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          organization_id: string
          plan_code: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          organization_id?: string
          plan_code?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plan_definitions"
            referencedColumns: ["code"]
          },
        ]
      }
      plan_definitions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          features: Json
          max_budgets: number
          max_import_rows: number
          max_users: number
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          features?: Json
          max_budgets: number
          max_import_rows: number
          max_users: number
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          features?: Json
          max_budgets?: number
          max_import_rows?: number
          max_users?: number
          name?: string
        }
        Relationships: []
      }
      precos_historicos_composicoes: {
        Row: {
          codigo_composicao: string
          custo_desonerado: number
          custo_nao_desonerado: number
          fonte: string
          mes_ref: string
          uf: string
        }
        Insert: {
          codigo_composicao: string
          custo_desonerado?: number
          custo_nao_desonerado?: number
          fonte: string
          mes_ref: string
          uf: string
        }
        Update: {
          codigo_composicao?: string
          custo_desonerado?: number
          custo_nao_desonerado?: number
          fonte?: string
          mes_ref?: string
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "precos_historicos_composicoes_codigo_composicao_fonte_fkey"
            columns: ["codigo_composicao", "fonte"]
            isOneToOne: false
            referencedRelation: "catalogo_composicoes"
            referencedColumns: ["codigo", "fonte"]
          },
        ]
      }
      precos_historicos_insumos: {
        Row: {
          codigo_insumo: string
          fonte: string
          mes_ref: string
          preco_desonerado: number
          preco_nao_desonerado: number
          uf: string
        }
        Insert: {
          codigo_insumo: string
          fonte: string
          mes_ref: string
          preco_desonerado?: number
          preco_nao_desonerado?: number
          uf: string
        }
        Update: {
          codigo_insumo?: string
          fonte?: string
          mes_ref?: string
          preco_desonerado?: number
          preco_nao_desonerado?: number
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "precos_historicos_insumos_codigo_insumo_fonte_fkey"
            columns: ["codigo_insumo", "fonte"]
            isOneToOne: false
            referencedRelation: "catalogo_insumos"
            referencedColumns: ["codigo", "fonte"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          empresa: string | null
          id: string
          id_empresa: string | null
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa?: string | null
          id: string
          id_empresa?: string | null
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa?: string | null
          id?: string
          id_empresa?: string | null
          nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user_profile: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_list_organization_plans: {
        Args: never
        Returns: {
          budgets_limit: number
          budgets_used: number
          legacy_plan: string
          organization_id: string
          organization_name: string
          organization_status: string
          plan_code: string
          subscription_status: string
          users_limit: number
          users_used: number
        }[]
      }
      admin_list_users_with_roles: {
        Args: never
        Returns: {
          empresa_nome: string
          id_empresa: string
          nome: string
          role: string
          user_id: string
        }[]
      }
      admin_list_users_with_scoped_roles: {
        Args: never
        Returns: {
          empresa_nome: string
          global_role: string
          id_empresa: string
          nome: string
          organization_role: string
          user_id: string
        }[]
      }
      admin_update_user_profile: {
        Args: {
          p_id_empresa: string
          p_nome: string
          p_role: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_update_user_scoped_roles: {
        Args: {
          p_global_role: string
          p_id_empresa: string
          p_nome: string
          p_organization_role: string
          p_user_id: string
        }
        Returns: undefined
      }
      assert_import_admin: { Args: never; Returns: undefined }
      calcular_custo_composicao: {
        Args: {
          p_codigo: string
          p_fonte: string
          p_mes_ref?: string
          p_regime?: string
          p_uf: string
        }
        Returns: number
      }
      can_delete_orcamento: {
        Args: { p_orcamento_id: string }
        Returns: boolean
      }
      can_edit_orcamento: { Args: { p_orcamento_id: string }; Returns: boolean }
      can_read_orcamento: { Args: { p_orcamento_id: string }; Returns: boolean }
      compartilhar_composicao: {
        Args: {
          p_codigo: string
          p_fonte: string
          p_organization_id: string
          p_permission?: string
        }
        Returns: undefined
      }
      criar_composicao_propria: {
        Args: { itens: Json; payload: Json }
        Returns: string
      }
      duplicar_composicao_propria: {
        Args: {
          p_codigo: string
          p_codigo_origem: string
          p_descricao?: string
          p_fonte_origem: string
        }
        Returns: string
      }
      duplicar_orcamento: {
        Args: { p_nome?: string; p_orcamento_id: string }
        Returns: string
      }
      excluir_etapa_orcamento: {
        Args: { p_etapa: string; p_orcamento_id: string }
        Returns: number
      }
      get_my_plan_summary: {
        Args: never
        Returns: {
          budgets_limit: number
          budgets_used: number
          organization_id: string
          plan_code: string
          plan_name: string
          status: string
          users_limit: number
          users_used: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inserir_catalogo_composicao_itens_lote: {
        Args: { payload: Json }
        Returns: undefined
      }
      is_organization_member: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      limpar_catalogo_composicao_itens_importacao: {
        Args: { p_codigos?: string[]; p_fonte: string }
        Returns: undefined
      }
      listar_bases_precos: {
        Args: { p_uf: string }
        Returns: {
          fonte: string
          mes_ref: string
        }[]
      }
      recalcular_orcamentos_da_composicao: {
        Args: { p_codigo: string; p_fonte: string }
        Returns: number
      }
      remove_organization_member: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      salvar_composicao_propria: {
        Args: { itens: Json; payload: Json }
        Returns: string
      }
      upsert_catalogo_composicao_itens_lote: {
        Args: { payload: Json }
        Returns: undefined
      }
      upsert_catalogo_composicoes_lote: {
        Args: { payload: Json }
        Returns: undefined
      }
      upsert_catalogo_insumos_lote: {
        Args: { payload: Json }
        Returns: undefined
      }
      upsert_precos_composicoes_lote: {
        Args: { payload: Json }
        Returns: undefined
      }
      upsert_precos_insumos_lote: {
        Args: { payload: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
