-- Somente leitura. Execute no SQL Editor do mesmo projeto Supabase usado pelo Railway.
-- Confira empresa_id nos resultados: a aplicação lista apenas a empresa da sessão.
SELECT current_database() AS banco, current_schema() AS schema_atual;

SELECT empresa_id, count(*) AS total,
       count(*) FILTER (WHERE ativo = true) AS ativas,
       count(*) FILTER (WHERE ativo = false) AS inativas
FROM public.categorias GROUP BY empresa_id ORDER BY empresa_id;

SELECT c.id, c.nome, c.empresa_id, c.ativo,
       count(p.id_interno) FILTER (WHERE p.ativo = true) AS produtos_ativos,
       coalesce(sum(p.estoque) FILTER (WHERE p.ativo = true), 0) AS saldo_produtos_ativos
FROM public.categorias c
LEFT JOIN public.produtos p ON p.categoria_id = c.id
GROUP BY c.id, c.nome, c.empresa_id, c.ativo
ORDER BY c.empresa_id, lower(trim(c.nome)), c.id;

-- Categorias com nomes equivalentes na mesma empresa.
SELECT empresa_id, lower(trim(nome)) AS nome_normalizado, count(*) AS quantidade,
       array_agg(id ORDER BY id) AS ids
FROM public.categorias
GROUP BY empresa_id, lower(trim(nome)) HAVING count(*) > 1;

-- Produtos ativos com vínculo ausente, inativo ou de outra empresa.
SELECT p.id, p.nome, p.empresa_id, p.categoria_id,
       c.nome AS categoria, c.ativo AS categoria_ativa, c.empresa_id AS empresa_categoria
FROM public.produtos p
LEFT JOIN public.categorias c ON c.id = p.categoria_id
WHERE p.ativo = true
  AND (c.id IS NULL OR c.ativo IS DISTINCT FROM true OR c.empresa_id IS DISTINCT FROM p.empresa_id)
ORDER BY p.empresa_id, p.id;
