# Produtos mais vendidos por quantidade

A tela Inteligência apresenta um ranking dos cinco produtos com mais unidades vendidas, com barras na paleta roxa, quantidades exatas e participação no total de unidades do histórico da empresa. O destaque lateral mostra o total de unidades e o líder em volume. O cálculo é independente do preço e do faturamento: vender dez unidades conta dez, mesmo em um único pedido.

## Dados e limites

- `rankingQuantidade` foi acrescentado à resposta existente de `GET /api/tendencias/curva-fluxo`. A consulta continua restrita ao administrador da empresa autenticada. Não recebe uma empresa escolhida pelo cliente.
- O cálculo compartilhado fica em `RankingProdutos.java`. Agrupa pelo identificador interno estável do produto, soma `ItemVenda.quantidade` e ordena por quantidade decrescente. Empates usam nome e identificador para manter uma ordem estável. Produtos com o mesmo nome não são fundidos.
- O período é todo o histórico registrado. Produtos inativos continuam contados quando aparecem em vendas anteriores. Os nomes são obtidos do produto vinculado ao item, como nas demais análises atuais.
- Unidades válidas sem identificação de produto entram no total, mas não na classificação individual. Itens com quantidade ausente ou não positiva não são estimados. O retorno informa essas lacunas e a interface mostra os avisos correspondentes.
- As barras comparam o volume de cada produto ao líder. As porcentagens mostram a participação no total de unidades válidas do histórico, incluindo as unidades sem identificação, quando houver.
- A disponibilidade atual exibida na lista vem da consulta de produtos ativos, usando `quantidadeDisponivel` (inclusive cotas e validades) e, quando necessário, `estoque`. Produtos ausentes dessa lista recebem a indicação de fora do catálogo ativo.
- Uma venda nova invalida o cache de estatísticas existente; o botão Atualizar Análise Completa busca os números novamente. O ranking histórico ajuda a acompanhar a reposição, mas não calcula velocidade recente de venda, prazo de entrega ou estoque mínimo.
- Se o frontend estiver atualizado e o backend ainda não oferecer o campo novo, o painel informa a necessidade de atualização; não exibe um ranking zerado como se fosse real.

## Agente

O novo atalho Mais vendidos usa `GET /api/agente/consultas/mais-vendidos`, sem uma chamada à IA. Também aceita `/mais-vendidos`, `/maisvendidos` e `/ranking`. As respostas de `/resumo`, `/vendas` e `/insights` incluem o ranking por unidades. A IA recebe os mesmos números no contexto, além da disponibilidade atual e do tipo de controle do estoque. Os textos distinguem unidades, faturamento e lucro.

## Calendário

O dia selecionado mantém a borda roxa mesmo nas células brancas, corrigindo a sobreposição do tema geral dos cartões. A espessura da borda é igual em todas as células. A seleção é acessível por Tab e Enter/Espaço, com `aria-pressed`. Dias passados continuam disponíveis para consulta; criar eventos no passado permanece bloqueado.

## Verificação e publicação

Os testes cobrem soma das quantidades em diferentes vendas, preços que não alteram a classificação, nomes repetidos, produtos inativos, lacunas históricas, totais maiores que um inteiro de 32 bits, isolamento entre empresas, atualização após venda e contexto da IA. Os testes de interface cobrem seleção do Calendário, layout em 320 px, disponibilidade por cota, atualização e consulta pelo Agente.

Publique **frontend e backend** após o commit/merge. Não há migração de banco ou nova variável de ambiente.

Na raiz do repositório:

```powershell
git add nexo-gestao-front sistema-gestao/src docs/RANKING_QUANTIDADES.md
git commit -m "Destaca dia selecionado e adiciona ranking por unidades vendidas"
git push -u origin HEAD
```
