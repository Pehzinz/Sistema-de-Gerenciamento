# Receitas e custos semanais

## Corrigir o ambiente publicado

O gráfico de áreas da Inteligência usa a lista `fluxo` retornada por
`GET /api/tendencias/curva-fluxo`, com os campos `receitas` e `custos` por semana.

Na verificação remota de 09/11/2026 em
`https://sistema-de-gerenciamento-production-9d42.up.railway.app`, usando a origem
`https://nexo-gestao.up.railway.app`, o preflight de GET retornou 200 e anunciou
`GET,POST,PUT,DELETE,OPTIONS`; o de PATCH retornou 403 com `Invalid CORS request`.
Isso comprova o bloqueio desse método no serviço consultado. A consulta foi somente de
cabeçalhos HTTP, sem login, leitura de registros ou alteração de dados.

1. Confirme que o serviço **backend** publica a branch com estas alterações e usa a raiz
   `sistema-gestao`. Verifique o commit do deployment ativo, não apenas um deploy do frontend.
2. Confirme que `VITE_API_URL` no frontend aponta para esse backend. Alterá-la exige novo build.
3. Na sessão autenticada, `GET /api/produtos/recursos` deve retornar `versaoCustosProdutos: 1`.
   `GET /api/tendencias/curva-fluxo` deve retornar `custos` nos pontos da lista `fluxo`.
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

## Cálculo do gráfico

- Semanas de segunda a domingo, identificadas pela data inicial com ano. As vendas já
  são registradas no horário de São Paulo; datas históricas não são reinterpretadas.
- Receitas: soma do total efetivamente vendido em cada semana, incluindo promoções.
- Custos: soma do custo unitário registrado em cada item de venda × quantidade vendida.
- Se algum item não tiver custo, o custo da semana fica nulo (lacuna na área vermelha).
  Uma indicação discreta explica a ausência. Não há estimativa de 60%, nem substituição
  pelo custo atual do cadastro. Vendas sem itens também têm custo desconhecido.
- Semanas sem vendas entre a primeira e a última semana registrada têm receita e custo zero.
- Custo zero informado explicitamente é válido. Empresas consultam apenas suas próprias vendas.

Os painéis extras de catálogo, rankings, quartis, dispersão e margens foram removidos.
O cadastro e a edição de custos, a correção CORS e o histórico das vendas permanecem.
Atualizar o custo de um produto vale para as próximas vendas e não altera os totais do
Relatório Contábil. O gráfico não inclui despesas operacionais e não representa lucro líquido.
