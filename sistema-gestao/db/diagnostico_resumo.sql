-- SOMENTE LEITURA. Retorna contagens, sem senhas, tokens, CPFs ou CNPJs.
SELECT 'CNPJs duplicados' AS verificacao, count(*) AS ocorrencias
FROM (SELECT cnpj FROM public.empresas GROUP BY cnpj HAVING count(*) > 1) problemas
UNION ALL
SELECT 'CPFs duplicados na mesma empresa', count(*)
FROM (SELECT empresa_id, cpf FROM public.usuarios GROUP BY empresa_id, cpf HAVING count(*) > 1) problemas
UNION ALL
SELECT 'Categorias duplicadas na mesma empresa', count(*)
FROM (SELECT empresa_id, lower(nome) FROM public.categorias GROUP BY empresa_id, lower(nome) HAVING count(*) > 1) problemas
UNION ALL
SELECT 'Codigos de produto duplicados na mesma empresa', count(*)
FROM (SELECT empresa_id, id FROM public.produtos GROUP BY empresa_id, id HAVING count(*) > 1) problemas
UNION ALL
SELECT 'CNPJs duplicados com mascaras diferentes', count(*)
FROM (SELECT regexp_replace(cnpj, '[^0-9]', '', 'g') FROM public.empresas
      GROUP BY regexp_replace(cnpj, '[^0-9]', '', 'g') HAVING count(*) > 1) problemas
UNION ALL
SELECT 'CPFs duplicados com mascaras diferentes na mesma empresa', count(*)
FROM (SELECT empresa_id, regexp_replace(cpf, '[^0-9]', '', 'g') FROM public.usuarios
      GROUP BY empresa_id, regexp_replace(cpf, '[^0-9]', '', 'g') HAVING count(*) > 1) problemas
UNION ALL
SELECT 'Usuarios sem empresa', count(*) FROM public.usuarios WHERE empresa_id IS NULL
UNION ALL
SELECT 'Contas com o CPF de teste antigo', count(*) FROM public.usuarios WHERE cpf = '000.000.000-00'
UNION ALL
SELECT 'Produtos sem empresa ou com estoque/preco invalido', count(*)
FROM public.produtos WHERE empresa_id IS NULL OR estoque < 0 OR preco <= 0
UNION ALL
SELECT 'Produtos ligados a categoria de outra empresa', count(*)
FROM public.produtos p JOIN public.categorias c ON c.id = p.categoria_id
WHERE p.empresa_id IS DISTINCT FROM c.empresa_id
UNION ALL
SELECT 'Vendas ligadas a usuario de outra empresa', count(*)
FROM public.vendas v JOIN public.usuarios u ON u.id = v.usuario_id
WHERE v.empresa_id IS DISTINCT FROM u.empresa_id
UNION ALL
SELECT 'Tabelas da aplicacao sem RLS', count(*) FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('empresas', 'usuarios', 'categorias', 'produtos', 'vendas', 'itens_venda', 'eventos')
  AND NOT rowsecurity
UNION ALL
SELECT 'Tabelas sem RLS com permissao para anon', count(*) FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('empresas', 'usuarios', 'categorias', 'produtos', 'vendas', 'itens_venda', 'eventos')
  AND NOT rowsecurity
  AND has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'SELECT,INSERT,UPDATE,DELETE');
