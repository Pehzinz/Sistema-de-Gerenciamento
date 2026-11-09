# Vendas noturnas e atualização do Dashboard

O log informado em 8 de novembro de 2026 contém:

```sql
alter table if exists produtos alter column tipo_estoque set data type varchar(32) default 'PADRAO'
```

Esse comando é inválido no PostgreSQL: a alteração de tipo não aceita DEFAULT nessa posição. O mapeamento incluía o valor padrão em columnDefinition, reutilizado pelo Hibernate na atualização de tipo. Agora o tamanho é definido por @Column(length = 32) e o valor padrão por @ColumnDefault. Um teste usa o migrador real do Hibernate com dialeto PostgreSQL e metadados simulando a coluna existente para verificar o ALTER gerado. Não é uma execução contra PostgreSQL real.

Esse é um comando de atualização do schema na inicialização, separado do INSERT da venda. A compra mostrou sucesso segundo o usuário. Para saber se a venda específica foi gravada, é preciso conferir os registros e a resposta de GET /api/vendas da empresa da sessão.

Também foi corrigida a gravação de data_venda: o servidor utilizava LocalDateTime.now() com seu fuso padrão. Em UTC, uma compra feita às 22h48 em São Paulo podia receber 01h48 do dia seguinte. Como o Dashboard limita o histórico à data atual de São Paulo e preserva datas sem fuso recebidas da API, essa compra ficava de fora. Novas vendas usam explicitamente America/Sao_Paulo. O teste HTTP roda com JVM em UTC, aquece o cache antes da compra e verifica imediatamente data, total e itens na API do Dashboard.

O Dashboard consulta sem cache do navegador, permite atualizar manualmente, consulta novamente ao retornar à aba e recalcula a data atual após carregar. Falhas HTTP ou de conexão mostram erro e botão para tentar novamente, sem apresentar relatório zerado como se a consulta tivesse funcionado.

## Publicação e conferência

1. Publicar backend e frontend com estas alterações.
2. No próximo início do backend, conferir se o erro de schema deixou de ocorrer. Não executar novamente o comando inválido nem apagar tabelas.
3. Realizar uma compra de teste, conferir a confirmação e consultar o Dashboard. Testar Atualizar Dashboard se ele já estava aberto em outra aba.
4. Se vendas antigas ainda não aparecerem, executar db/diagnostico_vendas_dashboard.sql no Supabase e comparar empresa_id, data_venda e os IDs com a API. O script é somente de leitura.

As datas históricas não foram alteradas: a coluna não guarda o fuso original e pode reunir registros de diferentes configurações do servidor. Subtrair três horas de toda a tabela poderia estragar datas corretas. Uma eventual correção deve delimitar registros comprovadamente afetados pelo período de deploy/configuração. Nenhum dado de produção foi acessado ou alterado nesta correção.

Referências: https://www.postgresql.org/docs/current/sql-altertable.html e https://docs.hibernate.org/orm/current/javadocs/org/hibernate/annotations/ColumnDefault.html.
