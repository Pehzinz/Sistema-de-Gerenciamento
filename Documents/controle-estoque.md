# Controles de estoque de produtos

## Compatibilidade e banco de dados

`tipoEstoque` aceita `PADRAO`, `COTA_TEMPO` e `VALIDADE`. Ausência do campo no cadastro, registros antigos e valores SQL nulos são interpretados como `PADRAO`.

O projeto já usa `spring.jpa.hibernate.ddl-auto=update`: na próxima inicialização, o Hibernate adiciona as colunas `tipo_estoque` (default `PADRAO`), `limite_cota`, `intervalo_cota_minutos`, `validade_comercial`, `inicio_janela_cota` e `vendas_na_janela`. Nenhuma migração destrutiva é necessária. As novas datas são instantes UTC; a interface recebe e envia a validade convertendo o horário local do navegador.

## Comportamento

- **PADRAO:** mantém o estoque físico e as regras existentes.
- **COTA_TEMPO:** exige limite e intervalo em minutos, inteiros positivos. O estoque físico fica em zero. A primeira janela começa na configuração, não no início da hora ou do dia civil. Janelas seguintes têm a mesma duração e âncora, mesmo após períodos sem vendas. Saldo não utilizado não acumula. Exemplo: configuração às 10:35 com intervalo 60 renova às 11:35, 12:35 etc. 1440 minutos equivale a 24 horas.
- **VALIDADE:** exige estoque inicial e data/hora comercial. O produto sai do catálogo quando o saldo chega a zero ou quando o relógio alcança o prazo, inclusive no instante exato do vencimento. Ele continua acessível na gestão, permitindo reposição ou extensão da validade.

A renovação é calculada na consulta de disponibilidade e persistida na próxima venda. Não depende de cron, front-end ou alteração permanente do campo `ativo`.

## API

- `GET /api/produtos` e `GET /api/produtos/{id}`: gestão de produtos ativos, incluindo vencidos e esgotados.
- `GET /api/produtos/catalogo` e `GET /api/produtos/catalogo/{id}`: catálogo de venda; omite produtos de validade vencidos ou sem saldo. Produtos de cota esgotada permanecem no catálogo, com disponibilidade zero até a renovação. Ambos os endpoints de catálogo permitem usuários autenticados, incluindo colaboradores.
- `quantidadeDisponivel`: saldo calculado pelo servidor para o caixa. Não substitui o campo físico `estoque`. Consultas não reservam unidades; o POST da venda sempre revalida.
- Cadastro e edição aceitam `tipoEstoque`, `limiteCota`, `intervaloCotaMinutos` e `validadeComercial` (ISO 8601 com fuso, por exemplo `2026-12-01T18:00:00Z`).
- `inicioJanelaCota` e `vendasNaJanela` são somente leitura no JSON. O cliente não pode alterar o consumo diretamente.
- Ao converter entre tipos, envie `estoque` explícito para tipos físicos. Campos incompatíveis são apagados no servidor. Edições do mesmo tipo físico preservam o saldo atual; use `/adicionar-estoque` para reposição. Alterar limite ou intervalo reinicia a cota; uma edição sem alterar a configuração preserva o consumo.
- A reposição física rejeita produtos de cota. Exclusão continua lógica: tipos físicos exigem saldo zero, conforme a regra anterior; cotas podem ser inativadas a qualquer momento. Reativação com o mesmo código aceita qualquer tipo.

## Concorrência e verificação

Venda, edição, reposição e exclusão usam o mesmo bloqueio pessimista por produto e empresa. A venda adquire os bloqueios em ordem de código, lê o relógio depois de obter a linha e consome o saldo na mesma transação da gravação dos itens. Erros posteriores, inclusive preço desatualizado, desfazem todos os consumos da venda.

Os testes Java cobrem legado nulo, fronteiras temporais, janelas ociosas, validade, conversões, catálogo, isolamento por empresa, edição, reposição, exclusão, reativação, itens repetidos, rollback e concorrência real entre transações H2. Os testes Playwright cobrem os campos dinâmicos, payload de cadastro, conversão de cota para físico e layout móvel. A integração com PostgreSQL de produção não é executada pelos testes locais.

Comandos: `./mvnw test` no back-end; `npm run build`, `npm run lint` e `npm run test:e2e` no front-end.


## Confirmação de versão, sessão e calendário

`GET /api/produtos/recursos`, autenticado, deve devolver `versaoControleEstoque: 1`. O front-end consulta esse contrato antes de salvar cotas/validades e verifica o produto retornado após a gravação. Uma API antiga que ignore campos novos não deve mais produzir uma mensagem de sucesso no formulário. Campos físicos do mesmo tipo são apresentados como saldo somente leitura; reposição usa a ação específica.

Um HTTP 401 isolado no catálogo não comprova que a sessão expirou: a aplicação agora consulta `/api/empresas/minha-empresa` com o mesmo token. Apenas se esse endpoint conhecido também responder 401 a sessão é apagada. Erros de produto, permissão, rede ou versão são apresentados sem tratar todos como produto inexistente. Uma sessão efetivamente inválida continua sendo encerrada.

No calendário, a validade aparece automaticamente no dia e horário do vencimento, enquanto o produto estiver ativo, com estoque positivo e prazo futuro. Os eventos são derivados dos produtos persistidos; não há linhas manuais duplicadas na tabela de eventos. A tela atualiza produtos a cada 30 segundos enquanto visível e imediatamente ao recuperar o foco. O prazo é verificado a cada segundo. Reposição ou prorrogação faz o aviso reaparecer; estoque zero, exclusão, conversão para outro tipo e vencimento o removem.

### Conferência após publicar

1. Confirme nos dois serviços Railway o **commit de origem** e a branch `main`, além do status do deploy. Um deploy ativo pode estar executando uma revisão anterior. O back-end deve usar a raiz `sistema-gestao`; o front-end, `nexo-gestao-front`.
2. Depois de publicar ambos os serviços, entre no sistema e verifique a resposta autenticada de `/api/produtos/recursos` nas ferramentas de rede do navegador. Não compartilhe o token nem a senha.
3. Edite os produtos que antes apareceram como padrão apesar da seleção de cota/validade e salve novamente a configuração desejada. O cadastro anterior não permite reconstruir automaticamente limites, intervalos ou prazos que o servidor não tenha persistido.
4. Para cota 5/3 minutos, a resposta do produto deve conter `tipoEstoque: COTA_TEMPO`, `limiteCota: 5`, `intervaloCotaMinutos: 3` e `quantidadeDisponivel: 5` inicialmente. `estoque: 0` é o saldo **físico** e não indica esgotamento dessa cota. A tabela mostra a cota disponível.
5. Para validade, confirme `tipoEstoque: VALIDADE`, `validadeComercial` com fuso e `quantidadeDisponivel` igual ao saldo enquanto válido. Confira o aviso no calendário e sua remoção após a última unidade vendida.

Os testes HTTP agora também verificam a serialização JSON, gravação real no H2 e consulta/venda autenticada dos três tipos, inclusive com colaborador. Eles distinguem 404 para produto indisponível de 401 para token inválido. O acesso ao banco e ao deploy de produção não é realizado por esses testes.


## Atualização automática das cotas na interface

A tabela de estoque e o produto consultado na edição buscam novamente a disponibilidade no servidor na virada de cada janela (verificada a cada segundo). Enquanto houver produtos de cota na tela, também sincronizam a cada 30 segundos e ao retornar à aba. Abas ocultas suspendem as consultas automáticas. O saldo é sempre o devolvido pelo back-end; a interface não restaura unidades por conta própria. Campos de edição ainda não salvos são preservados.

O caixa consulta a disponibilidade a cada inclusão de produto e antes de aumentar a quantidade de um item de cota já no carrinho. O POST da venda mantém a validação transacional. Essa atualização exige apenas publicar o front-end; não altera o esquema do banco.
