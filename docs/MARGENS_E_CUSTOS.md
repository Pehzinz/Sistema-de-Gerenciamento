# Custos e análises de margem

## Corrigir o ambiente publicado

A mensagem “A análise de custos ainda não está disponível” significa que a resposta de
`GET /api/tendencias/curva-fluxo` não contém `margens`. Ela não significa simplesmente
ausência de vendas novas. Uma API desta versão retorna a estrutura mesmo sem vendas.

Na verificação remota de 09/11/2026 em
`https://sistema-de-gerenciamento-production-9d42.up.railway.app`, usando a origem
`https://nexo-gestao.up.railway.app`, o preflight de GET retornou 200 e anunciou
`GET,POST,PUT,DELETE,OPTIONS`; o de PATCH retornou 403 com `Invalid CORS request`.
Isso comprova o bloqueio desse método no serviço consultado. A consulta foi somente de
cabeçalhos HTTP, sem login, leitura de registros ou alteração de dados.

1. Confirme que o serviço **backend** publica a branch com estas alterações e usa a raiz
   `sistema-gestao`. Verifique o commit do deployment ativo, não apenas um deploy do frontend.
2. Confirme que `VITE_API_URL` no frontend aponta para esse backend. Alterá-la exige novo build.
3. Na sessão autenticada, `GET /api/produtos/recursos` deve retornar `versaoCustosProdutos: 1`
   e `versaoMargensCatalogo: 1`. `GET /api/tendencias/margens-catalogo` deve retornar `versao: 1`.
4. A nova API autoriza o preflight CORS de **PATCH**, necessário para salvar a edição do custo.
   O endpoint só altera o custo do produto da empresa autenticada, sem reenviar estoque.
5. O schema precisa de `produtos.custo_unitario` e `itens_venda.custo_unitario`, ambos
   `numeric(12,2)` e aceitando nulo. Por padrão, o Hibernate usa `ddl-auto=update`.
   Se esse ajuste estiver desabilitado ou falhar por permissão, o administrador do banco
   pode executar `sistema-gestao/db/002_custos_produtos.sql` no banco conectado à API.
   O script é manual, idempotente e não atribui custos a vendas antigas.
6. Salve um custo pela interface, busque o produto novamente e confirme o valor em
   `custoUnitario`. Atualize a Inteligência. Não confunda um formulário preenchido com gravação confirmada.

Este trabalho não acessou credenciais nem executou SQL no banco de produção. O sucesso
dos testes locais não confirma qual deployment ou banco está ativo em produção.

## O que cada gráfico representa

- **Catálogo atual:** margem unitária = preço vigente menos custo cadastrado. Promoções
  são aplicadas apenas no período válido, no fuso de São Paulo. Disponível sem novas vendas.
- **Margem percentual atual:** margem unitária / preço vigente × 100. Não é markup sobre custo.
- **Mediana e Q1:** estatística descritiva entre produtos com custo conhecido, sem ponderação
  por vendas. Quantis interpolam as posições `(n - 1) × p`; Q1 exige ao menos quatro produtos.
  O quartil inferior é relativo ao catálogo, não uma afirmação de prejuízo. Margem negativa
  identifica preço abaixo do custo; margem zero identifica ausência de sobra bruta.
- **Volume × margem:** cruza unidades vendidas em todo o histórico com a margem atual.
  Não é lucro histórico, previsão de demanda nem inferência causal. Produtos sem vendas
  continuam representados em volume zero; não há exclusão por falta de histórico.
- **Resultado realizado:** soma subtotal vendido menos custo registrado no item da venda
  multiplicado pela quantidade. Margem ponderada = resultado / receita dos itens com custo.
  Não usa a média simples das porcentagens de produtos. A cobertura incompleta é explícita.

Atualizar o custo do catálogo não reescreve os custos anteriores, não cria uma perda
realizada e não altera os totais do Relatório Contábil. Nenhuma dessas análises desconta
despesas operacionais ou constitui lucro líquido da empresa.
