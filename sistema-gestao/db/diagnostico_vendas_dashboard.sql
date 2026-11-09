-- Somente leitura. Execute no mesmo projeto Supabase conectado à API.
SELECT now() AS instante_atual,
       now() AT TIME ZONE 'America/Sao_Paulo' AS agora_sao_paulo,
       now() AT TIME ZONE 'UTC' AS agora_utc;

SELECT table_name, column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'produtos' AND column_name = 'tipo_estoque')
    OR (table_name = 'vendas' AND column_name = 'data_venda'));

SELECT empresa_id, count(*) AS vendas, sum(total) AS total_vendido,
       min(data_venda) AS primeira_venda, max(data_venda) AS ultima_venda
FROM public.vendas GROUP BY empresa_id ORDER BY empresa_id;

-- Datas futuras em São Paulo podem indicar horário UTC salvo sem fuso.
-- O resultado é um indício; não autoriza deslocar automaticamente os horários.
SELECT id, empresa_id, data_venda, total, forma_pagamento
FROM public.vendas
WHERE data_venda > (now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 minute'
ORDER BY data_venda DESC LIMIT 100;

SELECT v.id, v.empresa_id, v.data_venda, v.total, count(i.id) AS itens
FROM public.vendas v LEFT JOIN public.itens_venda i ON i.venda_id = v.id
GROUP BY v.id, v.empresa_id, v.data_venda, v.total
ORDER BY v.id DESC LIMIT 30;
