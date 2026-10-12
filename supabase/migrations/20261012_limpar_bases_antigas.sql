-- Migration: Limpar Tabelas Antigas e Otimizar Consultas da Nova Estrutura

-- 1. Deletar (Dropar) as tabelas antigas gigantes
DROP TABLE IF EXISTS public.base_insumos CASCADE;
DROP TABLE IF EXISTS public.base_composicoes CASCADE;
DROP TABLE IF EXISTS public.base_composicao_itens CASCADE;

-- 2. Criar tabela de Itens de Composição na nova estrutura comercial
CREATE TABLE IF NOT EXISTS public.catalogo_composicao_itens (
    id BIGSERIAL PRIMARY KEY,
    codigo_composicao VARCHAR(50) NOT NULL,
    fonte VARCHAR(20) NOT NULL,
    tipo_item VARCHAR(20) NOT NULL, -- 'INSUMO' ou 'COMPOSICAO'
    codigo_item VARCHAR(50) NOT NULL, -- O codigo do insumo ou da composicao filha
    coeficiente NUMERIC(14,7) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(codigo_composicao, fonte, tipo_item, codigo_item),
    FOREIGN KEY (codigo_composicao, fonte) REFERENCES public.catalogo_composicoes(codigo, fonte) ON DELETE CASCADE
);

-- 3. Atualizar a View (Função) que lista as bases disponíveis no seletor
-- Antes ela lia da base_insumos (que foi deletada). Agora ela deve ler da precos_historicos_insumos
CREATE OR REPLACE FUNCTION public.listar_bases_precos(p_uf text)
 RETURNS TABLE(fonte character varying, mes_ref character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.fonte, p.mes_ref
  FROM public.precos_historicos_insumos p
  WHERE p.uf = p_uf
  ORDER BY p.fonte, p.mes_ref DESC;
END;
$function$;
