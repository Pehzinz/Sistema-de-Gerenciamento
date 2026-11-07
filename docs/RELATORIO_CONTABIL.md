# Relatório contábil por período

No Dashboard, os campos opcionais Data inicial e Data final controlam o download do relatório contábil e o gráfico de receita por categoria.

- Ambos vazios: histórico completo até a data de hoje.
- Apenas início: vendas desde essa data até hoje.
- Apenas fim: vendas desde o início do histórico até essa data.
- Ambos preenchidos: intervalo inclusivo, incluindo todas as vendas do último dia, até 23:59:59.
- O botão Todo o histórico limpa as duas datas.

A tela apresenta período, quantidade de vendas e faturamento antes do download. Datas invertidas ou posteriores ao dia atual bloqueiam a geração, com uma mensagem de validação. Um período sem vendas gera um relatório com faturamento zero.

O PDF informa o período aplicado. Faturamento, total de transações, gráfico de receita e linhas de vendas usam o mesmo conjunto filtrado. O gráfico de volume do catálogo representa os produtos cadastrados atualmente e está identificado dessa forma. Downloads por período incluem as datas no nome do arquivo; o histórico completo mantém o nome anterior.

Datas ISO com fuso são convertidas para America/Sao_Paulo. Os LocalDateTime sem fuso devolvidos pela API mantêm a data e hora registradas. Vendas legadas sem data permanecem apenas no relatório completo e aparecem como Data não registrada; elas não são atribuídas a um período por suposição.

A implementação utiliza a listagem de vendas já autenticada e restrita à empresa da sessão. Não altera o banco nem o back-end. Para disponibilizar a funcionalidade no site, publique o front-end atualizado.

Os testes Playwright verificam o resumo e os arquivos PDF efetivamente baixados: limites inclusivos, conversão de fuso, histórico completo, datas parciais, datas inválidas e período vazio.
