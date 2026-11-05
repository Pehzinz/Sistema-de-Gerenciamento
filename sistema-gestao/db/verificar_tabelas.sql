-- SOMENTE LEITURA. Pode ser executado mesmo depois de DROP das tabelas.
SELECT esperado.nome AS tabela,
       CASE WHEN to_regclass(format('%I.%I', 'public', esperado.nome)) IS NULL
            THEN 'AUSENTE' ELSE 'EXISTE' END AS situacao
FROM (VALUES ('empresas'), ('usuarios'), ('categorias'), ('produtos'),
             ('vendas'), ('itens_venda'), ('eventos')) AS esperado(nome)
ORDER BY esperado.nome;
