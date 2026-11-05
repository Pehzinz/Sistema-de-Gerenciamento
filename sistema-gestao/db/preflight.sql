-- Consultas somente de leitura. Resultados exigem revisão antes de migrar.
SELECT cnpj, count(*) FROM public.empresas GROUP BY cnpj HAVING count(*) > 1;
SELECT empresa_id, cpf, count(*) FROM public.usuarios GROUP BY empresa_id, cpf HAVING count(*) > 1;
SELECT empresa_id, lower(nome), count(*) FROM public.categorias GROUP BY empresa_id, lower(nome) HAVING count(*) > 1;
SELECT empresa_id, id, count(*) FROM public.produtos GROUP BY empresa_id, id HAVING count(*) > 1;
-- Possíveis duplicatas com máscaras diferentes: precisam de padronização antes de usar índices normalizados.
SELECT regexp_replace(cnpj, '[^0-9]', '', 'g'), count(*) FROM public.empresas
GROUP BY regexp_replace(cnpj, '[^0-9]', '', 'g') HAVING count(*) > 1;
SELECT empresa_id, regexp_replace(cpf, '[^0-9]', '', 'g'), count(*) FROM public.usuarios
GROUP BY empresa_id, regexp_replace(cpf, '[^0-9]', '', 'g') HAVING count(*) > 1;
-- A versão anterior podia criar contas de teste sem empresa.
SELECT id, nome_completo, perfil, empresa_id FROM public.usuarios
WHERE empresa_id IS NULL OR cpf = '000.000.000-00';
SELECT id_interno, empresa_id FROM public.produtos WHERE empresa_id IS NULL OR estoque < 0 OR preco <= 0;
SELECT p.id_interno FROM public.produtos p JOIN public.categorias c ON c.id = p.categoria_id
WHERE p.empresa_id IS DISTINCT FROM c.empresa_id;
SELECT v.id FROM public.vendas v JOIN public.usuarios u ON u.id = v.usuario_id
WHERE v.empresa_id IS DISTINCT FROM u.empresa_id;
