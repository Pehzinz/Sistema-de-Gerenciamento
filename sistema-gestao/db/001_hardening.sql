-- Migração MANUAL para PostgreSQL/Supabase. Não é executada pela aplicação.
-- Faça backup, resolva os resultados de preflight.sql e teste em staging primeiro.
BEGIN;

-- Falha sem alterar dados caso existam duplicatas; não escolhe registros a apagar.
CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_cnpj ON public.empresas (cnpj);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_empresa_cpf ON public.usuarios (empresa_id, cpf);
CREATE UNIQUE INDEX IF NOT EXISTS ux_categorias_empresa_nome ON public.categorias (empresa_id, lower(nome));
CREATE UNIQUE INDEX IF NOT EXISTS ux_produtos_empresa_codigo ON public.produtos (empresa_id, id);

-- Remove somente a antiga restrição UNIQUE global de categorias.nome.
-- Duas empresas diferentes podem ter uma categoria chamada "Áudio".
DO $$
DECLARE regra record;
BEGIN
    FOR regra IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.categorias'::regclass AND contype = 'u'
          AND cardinality(conkey) = 1
          AND conkey[1] = (SELECT attnum FROM pg_attribute
                          WHERE attrelid = 'public.categorias'::regclass AND attname = 'nome')
    LOOP
        EXECUTE format('ALTER TABLE public.categorias DROP CONSTRAINT %I', regra.conname);
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS ix_produtos_empresa_ativo ON public.produtos (empresa_id, ativo);
CREATE INDEX IF NOT EXISTS ix_categorias_empresa_ativo ON public.categorias (empresa_id, ativo);
CREATE INDEX IF NOT EXISTS ix_usuarios_cpf ON public.usuarios (cpf);
CREATE INDEX IF NOT EXISTS ix_vendas_empresa_data ON public.vendas (empresa_id, data_venda);
CREATE INDEX IF NOT EXISTS ix_eventos_empresa_data_hora ON public.eventos (empresa_id, data, hora);
CREATE INDEX IF NOT EXISTS ix_itens_venda_venda ON public.itens_venda (venda_id);
COMMIT;
