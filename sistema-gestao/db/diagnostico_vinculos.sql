-- SOMENTE LEITURA. Sem senhas, hashes, nomes, CPFs ou CNPJs no resultado.
-- Os IDs servem para revisar a conta antiga e a atribuição das vendas.
SELECT
    'conta_com_cpf_de_teste' AS caso,
    NULL::bigint AS venda_id,
    NULL::bigint AS empresa_da_venda,
    u.id AS usuario_id,
    u.empresa_id AS empresa_do_usuario,
    u.perfil,
    (SELECT count(*) FROM public.vendas v WHERE v.usuario_id = u.id) AS vendas_ligadas_ao_usuario,
    (SELECT count(*) FROM public.usuarios outro
     WHERE outro.empresa_id = u.empresa_id AND outro.id <> u.id AND upper(outro.perfil) = 'ADMIN') AS outros_administradores_da_empresa,
    ARRAY[]::bigint[] AS usuarios_da_empresa_da_venda
FROM public.usuarios u
WHERE u.cpf = '000.000.000-00'
UNION ALL
SELECT
    'venda_com_usuario_de_outra_empresa',
    v.id,
    v.empresa_id,
    u.id,
    u.empresa_id,
    u.perfil,
    (SELECT count(*) FROM public.vendas historico WHERE historico.usuario_id = u.id),
    NULL::bigint,
    ARRAY(SELECT candidato.id FROM public.usuarios candidato
          WHERE candidato.empresa_id = v.empresa_id ORDER BY candidato.id)
FROM public.vendas v
JOIN public.usuarios u ON u.id = v.usuario_id
WHERE v.empresa_id IS DISTINCT FROM u.empresa_id;
