const inteiro = valor => Number(valor).toLocaleString('pt-BR');
const percentual = valor => Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function RankingQuantidade({ dados, produtos }) {
  const disponivel = dados && Array.isArray(dados.produtos) && Number.isSafeInteger(dados.totalUnidades)
    && dados.produtos.every(produto => typeof produto.nome === 'string' && Number.isSafeInteger(produto.quantidade) && produto.quantidade > 0);
  const ranking = disponivel ? dados.produtos.slice(0, 5) : [];
  const lider = ranking[0];
  const catalogo = new Map(produtos.map(produto => [String(produto.id), produto]));
  return <section className="quantity-ranking" aria-labelledby="quantity-ranking-title">
    <header className="quantity-ranking-header">
      <div><span className="quantity-ranking-eyebrow">GIRO POR PRODUTO</span><h2 id="quantity-ranking-title">Mais vendidos em quantidade</h2><p>Unidades somadas nas vendas de todo o histórico da sua empresa.</p></div>
      <span className="quantity-ranking-tag">Top 5 · unidades</span>
    </header>
    {!disponivel ? <p role="note">O ranking de quantidades ainda não está disponível nesta API. Atualize o backend e sincronize a análise.</p> : <>
      {lider ? <div className="quantity-ranking-layout">
        <aside className="quantity-ranking-highlight" aria-label="Resumo de unidades vendidas">
          <span className="quantity-ranking-eyebrow">UNIDADES VENDIDAS</span>
          <strong className="quantity-ranking-total">{inteiro(dados.totalUnidades)}</strong>
          <span className="quantity-ranking-caption">{inteiro(dados.produtos.length)} produtos com vendas identificadas</span>
          <div className="quantity-ranking-leader"><span>Líder em volume</span><strong>{lider.nome}</strong><p>{inteiro(lider.quantidade)} unidades vendidas</p></div>
          <p className="quantity-ranking-guidance">Acompanhe estes produtos ao planejar a reposição. O volume histórico não define, sozinho, o estoque mínimo.</p>
        </aside>
        <div>
          <ol className="quantity-ranking-list" aria-label="Ranking por unidades vendidas">
            {ranking.map((produto, index) => {
              const atual = catalogo.get(String(produto.produtoId));
              const quantidade = atual?.quantidadeDisponivel ?? atual?.estoque;
              const estoqueInformado = Number.isInteger(quantidade) && quantidade >= 0;
              const participacao = Number(produto.participacaoPercentual) || 0;
              return <li key={produto.produtoId ?? index} className="quantity-ranking-item">
                <span className="quantity-ranking-position" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div className="quantity-ranking-product">
                  <div className="quantity-ranking-product-head"><strong>{produto.nome}</strong><span className="quantity-ranking-units">{inteiro(produto.quantidade)} <small>un.</small></span></div>
                  <div className="quantity-ranking-track" aria-hidden="true"><span style={{ width: `${produto.quantidade / lider.quantidade * 100}%` }} /></div>
                  <div className="quantity-ranking-details"><span>{percentual(participacao)}% das unidades do histórico</span><span className={`quantity-ranking-stock ${atual && estoqueInformado && quantidade === 0 ? 'is-empty' : ''}`}>{!atual ? 'Fora do catálogo ativo' : estoqueInformado ? `Disponível agora: ${inteiro(quantidade)} un.` : 'Disponibilidade não informada'}</span></div>
                </div>
              </li>;
            })}
          </ol>
          <p className="quantity-ranking-scale">Comprimento das barras em relação ao líder em unidades vendidas.</p>
        </div>
      </div> : <p className="quantity-ranking-empty">Ainda não há produtos identificados com quantidades vendidas para montar o ranking.</p>}
      {dados.unidadesSemIdentificacao > 0 && <p role="note" className="quantity-ranking-warning">{inteiro(dados.unidadesSemIdentificacao)} unidades constam no total, mas não têm produto identificado e ficam fora da classificação.</p>}
      {(dados.itensSemQuantidade > 0 || dados.vendasSemItens > 0) && <p role="note" className="quantity-ranking-warning">Há vendas sem itens ou itens sem quantidade válida. O ranking pode estar incompleto.</p>}
    </>}
  </section>;
}
