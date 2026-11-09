import GraficoMargens from './GraficoMargens';
import { moeda } from '../utils/moeda';

export default function AnaliseMargens({ dados }) {
  return <section aria-label="Margem bruta dos produtos" style={{ background: 'white', padding: 25, borderRadius: 15, minWidth: 0 }}>
    <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#333' }}>Margem realizada nas vendas</h2>
    <p style={{ fontSize: 13, color: '#555' }}>Receita menos o custo das unidades vendidas, registrado no momento de cada venda. Não inclui aluguel, salários, taxas ou outras despesas da loja; não representa o lucro líquido.</p>
    {!dados ? <p role="status">A análise de custos ainda não está disponível. Atualize o servidor e depois a análise.</p> : <>
      <p style={{ fontSize: 13, color: '#555' }}>Todo o histórico · {dados.unidadesComCusto} unidade(s) com custo registrado · {dados.unidadesSemCusto} unidade(s) sem custo registrado.</p>
      {dados.unidadesSemCusto > 0 && <p role="note" style={{ padding: 12, background: '#fffbeb', borderRadius: 8, color: '#854d0e', fontSize: 13 }}>
        Análise parcial: {moeda(dados.receitaSemCusto)} em vendas estão sem custo registrado e não entram no resultado bruto. Preencher o custo de um produto agora vale para as próximas vendas; não altera o histórico.
      </p>}
      <div className="responsive-row" style={{ display: 'flex', gap: 16, margin: '20px 0' }}>
        {[
          ['Receita dos itens com custo', dados.unidadesComCusto > 0 ? dados.receitaComCusto : null],
          ['Custo das unidades vendidas', dados.unidadesComCusto > 0 ? dados.custoProdutosVendidos : null],
          ['Resultado bruto dos itens com custo', dados.margemBruta],
        ].map(([titulo, valor]) => <div key={titulo} style={{ flex: 1, minWidth: 0, padding: 16, borderRadius: 10, background: '#f8f9fa' }}>
          <div style={{ color: '#555', fontSize: 12, marginBottom: 8 }}>{titulo}</div>
          <strong style={{ fontSize: 21, color: valor != null && valor < 0 ? '#b91c1c' : '#333' }}>{moeda(valor)}</strong>
        </div>)}
      </div>
      {dados.margemPercentual != null && <p style={{ fontSize: 13 }}>Margem ponderada pela receita dos itens com custo: {Number(dados.margemPercentual).toLocaleString('pt-BR')}%.</p>}
      {dados.unidadesComCusto === 0 && <p>Não há vendas com custo registrado para calcular margens. Informe o custo unitário no cadastro ou na edição dos produtos.</p>}
      {dados.produtosComMargemNegativa > 0 && <p style={{ color: '#b91c1c', fontWeight: 'bold' }}>
        {dados.produtosComMargemNegativa} produto(s) com resultado bruto negativo nos itens com custo conhecido. Confira os primeiros da lista para revisar preço, custo e promoções.
      </p>}
      {dados.produtos?.length > 0 && <>
        <h3 style={{ fontSize: 15 }}>Produtos vendidos: menores resultados brutos primeiro</h3>
        <p style={{ fontSize: 12, color: '#666' }}>Até 10 produtos. Resultados parciais consideram apenas unidades com custo registrado. Produtos sem custo conhecido aparecem depois dos demais.</p>
        <GraficoMargens produtos={dados.produtos.filter(p => p.margemBruta != null)} campo="margemBruta" titulo="Gráfico do resultado bruto histórico por produto" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead><tr>{['Produto', 'Receita com custo', 'Custo vendido', 'Resultado bruto', 'Unidades com custo / total'].map(titulo => <th key={titulo} style={{ padding: 12, borderBottom: '2px solid #eee' }}>{titulo}</th>)}</tr></thead>
            <tbody>{dados.produtos.slice(0, 10).map((produto, i) => <tr key={produto.produtoId ?? i}>
              <td style={{ padding: 12, borderBottom: '1px solid #eee', overflowWrap: 'anywhere' }}>{produto.nome}<br /><small style={{ color: '#666' }}>{produto.produtoId}</small></td>
              <td style={{ padding: 12 }}>{moeda(produto.unidadesComCusto > 0 ? produto.receitaComCusto : null)}</td>
              <td style={{ padding: 12 }}>{moeda(produto.unidadesComCusto > 0 ? produto.custoProdutosVendidos : null)}</td>
              <td style={{ padding: 12, fontWeight: 'bold', color: produto.margemBruta != null && produto.margemBruta < 0 ? '#b91c1c' : '#333' }}>{moeda(produto.margemBruta)}</td>
              <td style={{ padding: 12 }}>{produto.unidadesComCusto} / {produto.unidadesComCusto + produto.unidadesSemCusto}{produto.unidadesSemCusto > 0 && ' · parcial'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </>}
  </section>;
}
