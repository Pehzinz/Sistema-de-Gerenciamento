-- Executar no banco conectado ao BACKEND, caso o gerenciamento de schema esteja desabilitado
-- ou o usuário JDBC não tenha permissão de ALTER TABLE. Não preenche custos históricos.
BEGIN;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo_unitario numeric(12,2);
ALTER TABLE itens_venda ADD COLUMN IF NOT EXISTS custo_unitario numeric(12,2);
COMMIT;

-- Deve retornar duas linhas. Uma captura com rolagem horizontal não comprova ausência de coluna.
SELECT table_schema, table_name, column_name, data_type, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN ('produtos', 'itens_venda') AND column_name = 'custo_unitario';
