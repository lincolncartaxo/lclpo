-- Migration: Arquitetura Comercial Catálogo + Preços (Alta Escalabilidade)

-- 1. Criação dos Catálogos Globais (Sem Preços, apenas metadados)
CREATE TABLE IF NOT EXISTS public.catalogo_insumos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    fonte VARCHAR(20) NOT NULL, -- SINAPI, SICRO, ORSE
    descricao TEXT NOT NULL,
    unidade VARCHAR(10),
    origem VARCHAR(50),
    UNIQUE(codigo, fonte)
);

CREATE TABLE IF NOT EXISTS public.catalogo_composicoes (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    fonte VARCHAR(20) NOT NULL,
    descricao TEXT NOT NULL,
    unidade VARCHAR(10),
    classe VARCHAR(50), -- ex: Edificações, Pavimentação
    UNIQUE(codigo, fonte)
);

-- 2. Criação das Tabelas de Preços Históricos (A tabela gigante)
-- Utilizando chaves compostas para performance e indexação
CREATE TABLE IF NOT EXISTS public.precos_historicos_insumos (
    id BIGSERIAL PRIMARY KEY,
    codigo_insumo VARCHAR(50) NOT NULL,
    fonte VARCHAR(20) NOT NULL,
    uf VARCHAR(2) NOT NULL, -- 'PB', 'SP', 'SE', ou 'BR' para bases nacionais sem UF
    mes_ref VARCHAR(10) NOT NULL, -- Formato 'YYYY-MM'
    preco_desonerado NUMERIC(14,4) NOT NULL DEFAULT 0,
    preco_nao_desonerado NUMERIC(14,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(codigo_insumo, fonte, uf, mes_ref),
    FOREIGN KEY (codigo_insumo, fonte) REFERENCES public.catalogo_insumos(codigo, fonte) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.precos_historicos_composicoes (
    id BIGSERIAL PRIMARY KEY,
    codigo_composicao VARCHAR(50) NOT NULL,
    fonte VARCHAR(20) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    mes_ref VARCHAR(10) NOT NULL,
    custo_desonerado NUMERIC(14,4) NOT NULL DEFAULT 0,
    custo_nao_desonerado NUMERIC(14,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(codigo_composicao, fonte, uf, mes_ref),
    FOREIGN KEY (codigo_composicao, fonte) REFERENCES public.catalogo_composicoes(codigo, fonte) ON DELETE CASCADE
);

-- 3. Índices para Otimização de Busca
-- Índice GIN para Text Search rápido na descrição (Full Text Search)
CREATE INDEX idx_catalogo_insumos_busca ON public.catalogo_insumos USING GIN (to_tsvector('portuguese', descricao));
CREATE INDEX idx_catalogo_composicoes_busca ON public.catalogo_composicoes USING GIN (to_tsvector('portuguese', descricao));

-- Índices B-Tree para consultas exatas na hora de montar o orçamento
CREATE INDEX idx_precos_insumos_lookup ON public.precos_historicos_insumos(codigo_insumo, fonte, uf, mes_ref);
CREATE INDEX idx_precos_composicoes_lookup ON public.precos_historicos_composicoes(codigo_composicao, fonte, uf, mes_ref);

-- 4. Multi-Tenant (Bases Próprias por Empresa)
CREATE TABLE IF NOT EXISTS public.base_propria_insumos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_empresa UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL, -- Geralmente o CNPJ + Sequencial
    descricao TEXT NOT NULL,
    unidade VARCHAR(10),
    preco_desonerado NUMERIC(14,4) NOT NULL DEFAULT 0,
    preco_nao_desonerado NUMERIC(14,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.base_propria_composicoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_empresa UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    unidade VARCHAR(10),
    custo_desonerado NUMERIC(14,4) NOT NULL DEFAULT 0,
    custo_nao_desonerado NUMERIC(14,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS nas tabelas próprias
ALTER TABLE public.base_propria_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_propria_composicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresas veem apenas seus próprios insumos" 
ON public.base_propria_insumos FOR ALL 
USING (id_empresa IN (SELECT empresa::uuid FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Empresas veem apenas suas próprias composicoes" 
ON public.base_propria_composicoes FOR ALL 
USING (id_empresa IN (SELECT empresa::uuid FROM public.profiles WHERE profiles.id = auth.uid()));

-- 5. Função PL/pgSQL para Ingestão em Lote (Upsert Massivo)
-- Esta função será chamada pela Edge Function para inserir milhares de preços de uma vez
CREATE OR REPLACE FUNCTION upsert_precos_insumos_lote(payload JSONB)
RETURNS VOID AS $$
BEGIN
    -- Atualiza ou insere o preço histórico
    INSERT INTO public.precos_historicos_insumos (codigo_insumo, fonte, uf, mes_ref, preco_desonerado, preco_nao_desonerado)
    SELECT 
        (rec->>'codigo')::VARCHAR,
        (rec->>'fonte')::VARCHAR,
        (rec->>'uf')::VARCHAR,
        (rec->>'mes_ref')::VARCHAR,
        (rec->>'preco_desonerado')::NUMERIC,
        (rec->>'preco_nao_desonerado')::NUMERIC
    FROM jsonb_array_elements(payload) AS rec
    ON CONFLICT (codigo_insumo, fonte, uf, mes_ref) 
    DO UPDATE SET 
        preco_desonerado = EXCLUDED.preco_desonerado,
        preco_nao_desonerado = EXCLUDED.preco_nao_desonerado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
