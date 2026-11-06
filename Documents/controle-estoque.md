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
