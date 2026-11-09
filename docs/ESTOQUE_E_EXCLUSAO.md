# Filtro de estoque e exclusões

Visualizar Estoque permite combinar marca, categoria e tipo de estoque: Estoque Padrão, Estoque de Cotas e Estoque de Validade. Produtos legados sem tipo são considerados padrão. Limpar Filtros limpa os três critérios; o PDF usa a mesma lista filtrada.

As categorias do estoque vêm de GET /api/categorias, a mesma fonte usada pelo cadastro e pela exclusão. Antes, o estoque extraía nomes das categorias associadas aos produtos: essa lista não comprovava que a categoria estivesse ativa. Produtos com vínculo divergente agora aparecem como Sem categoria ativa e a tela informa a divergência. Categorias vazias também podem aparecer no filtro.

A exclusão seleciona uma categoria retornada pela API e envia seu ID. Isso evita diferenças de digitação, caracteres especiais no caminho e confusão entre registros com nomes iguais. Após sucesso ou categoria não encontrada, a lista é consultada novamente. O cadastro também confere se o registro salvo aparece na listagem antes de anunciar sucesso.

Produtos podem ser excluídos com ou sem saldo em qualquer tipo. Excluir categoria inativa a categoria e seus produtos em uma única transação; os produtos são bloqueados na mesma ordem usada pelas vendas. A operação preserva os registros, seus saldos e o histórico de vendas. Produtos inativos deixam o catálogo e não podem ser vendidos; cadastrar novamente um código existente inativo mantém o fluxo de reativação. Reativar uma categoria não reativa automaticamente seus produtos.

## Investigar a diferença entre o site e o Supabase

O código local não comprova a causa da diferença entre 7 e 12 categorias no ambiente publicado. Não há uma lista fictícia de categorias fixa no frontend. Verifique o banco/projeto conectado ao serviço Railway, a empresa da sessão, categorias inativas e vínculos dos produtos. Não recrie as cinco categorias por suposição.

Execute `sistema-gestao/db/diagnostico_categorias.sql` no SQL Editor. As consultas não alteram dados: mostram totais por empresa, IDs, situação ativa, produtos vinculados, duplicidades e vínculos divergentes. Compare esses IDs com a resposta de GET /api/categorias do site. Se os resultados não corresponderem, confira a conexão do serviço e a versão publicada. O script pressupõe as tabelas existentes do sistema.

As mudanças precisam de publicação do backend e frontend. Não há migração automática ou correção de registros antigos; nenhuma categoria de produção foi excluída durante os testes locais. Os testes de persistência usam H2 temporário e os testes do navegador usam respostas simuladas.
