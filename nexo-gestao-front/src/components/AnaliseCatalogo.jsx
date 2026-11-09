import { useState } from 'react';
import { ScatterChart, Scatter, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import GraficoMargens from './GraficoMargens';
import { moeda } from '../utils/moeda';

const percentual = valor => valor == null ? 'Não disponível' : `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const faixas = { ABAIXO_DO_CUSTO: 'Abaixo do custo', SEM_MARGEM: 'Sem margem', QUARTIL_INFERIOR: 'Margem no quartil inferior', MARGEM_POSITIVA: 'Margem positiva' };

function DetalhePonto({ active, payload }) {
  const produto = payload?.[0]?.payload;
  if (!active || !produto) return null;
  return <div style={{ background: 'white', padding: 12, border: '1px solid #ddd', maxWidth: 260, fontSize: 12 }}>
    <strong>{produto.nome} ({produto.produtoId})</strong>
    <p>Preço atual: {moeda(produto.precoVenda)} · Custo: {moeda(produto.custoUnitario)}</p>
    <p>Margem atual: {moeda(produto.margemUnitaria)} ({percentual(produto.margemPercentual)})</p>
    <p>Unidades vendidas em todo o histórico: {produto.unidadesVendidas}</p>
  </div>;
}

export default function AnaliseCatalogo({ dados, erro }) {
  const [ordenacao, setOrdenacao] = useState('margem');
  const produtos = [...(dados?.produtos ?? [])].sort((a, b) => ordenacao === 'giro'
    ? b.unidadesVendidas - a.unidadesVendidas || a.margemUnitaria - b.margemUnitaria : a.margemUnitaria - b.margemUnitaria);
  return <section aria-label="Margem atual do catálogo" style={{ background: 'white', padding: 25, borderRadius: 15, minWidth: 0 }}>
    <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Margem bruta dos produtos — catálogo atual</h2>
    <p style={{ fontSize: 13, color: '#555' }}>Preço de venda atual menos o custo unitário cadastrado. Inclui promoções vigentes. Atualiza após salvar o custo e clicar em “Atualizar Análise Completa”, mesmo sem novas vendas.</p>
    <p style={{ fontSize: 12, color: '#666' }}>Esta é uma análise dos preços atuais, não lucro realizado. Não inclui despesas da loja nem reescreve os custos das vendas antigas.</p>
    {erro ? <div role="alert" style={{ background: '#fff7ed', padding: 14, borderRadius: 8 }}>
      <strong>Não foi possível confirmar a análise de custos no servidor.</strong>
      <p>{erro}</p>
      <p style={{ fontSize: 13 }}>Confirme que o backend publicado contém a versão de custos e que o frontend aponta para essa API. No banco conectado à API, as tabelas produtos e itens_venda precisam da coluna custo_unitario.</p>
    </div> : !dados ? <p role="status">Carregando margens do catálogo...</p> : <>
      <p style={{ fontSize: 13, color: '#555' }}>Referência: {dados.dataReferencia} · {dados.produtosComCusto} produto(s) com custo · {dados.produtosSemCusto} sem custo. Produtos sem custo são excluídos dos gráficos e das estatísticas.</p>
      <div className="responsive-row" style={{ display: 'flex', gap: 16, margin: '20px 0' }}>
        {[
          ['Produtos com preço abaixo do custo', dados.produtosAbaixoDoCusto],
          ['Margem percentual mediana', percentual(dados.medianaMargemPercentual)],
          ['Primeiro quartil das margens (Q1)', percentual(dados.primeiroQuartilPercentual)],
        ].map(([titulo, valor]) => <div key={titulo} style={{ flex: 1, padding: 16, borderRadius: 10, background: '#f8f9fa', minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>{titulo}</div><strong style={{ fontSize: 21 }}>{valor}</strong>
        </div>)}
      </div>
      {produtos.length === 0 ? <p>Não há produtos ativos com custo registrado. Salve o custo unitário na edição do produto e atualize a análise.</p> : <>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 12 }}>Comparar produtos por{' '}
          <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} style={{ padding: 8 }}>
            <option value="margem">Menor margem por unidade</option><option value="giro">Mais unidades vendidas no histórico</option>
          </select>
        </label>
        <div className="responsive-row" style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 15 }}>Margem atual por unidade (R$)</h3>
            <p style={{ fontSize: 12, color: '#666' }}>Até 10 produtos na ordem selecionada. Vermelho: venda abaixo do custo.</p>
            <GraficoMargens produtos={produtos} campo="margemUnitaria" titulo="Gráfico de margem atual por produto" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 15 }}>Volume histórico × margem atual</h3>
            <p style={{ fontSize: 12, color: '#666' }}>Cada ponto é um produto. O volume indica vendas passadas; a margem usa o preço e custo de hoje. Não é previsão de demanda.</p>
            <div role="img" aria-label="Dispersão do volume histórico e da margem atual" style={{ height: 300, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 12, bottom: 28, left: 0 }}>
                  <XAxis type="number" dataKey="unidadesVendidas" name="Unidades vendidas" allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: 'Unidades vendidas', position: 'bottom', fontSize: 11 }} />
                  <YAxis type="number" dataKey="margemPercentual" name="Margem atual" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} width={55} />
                  <ReferenceLine y={0} stroke="#dc2626" />
                  {dados.primeiroQuartilPercentual != null && <ReferenceLine y={dados.primeiroQuartilPercentual} stroke="#d97706" strokeDasharray="4 4" />}
                  <Tooltip content={<DetalhePonto />} />
                  <Scatter data={produtos} isAnimationActive={false}>
                    {produtos.map(p => <Cell key={p.produtoId} fill={p.margemUnitaria < 0 ? '#dc2626' : p.faixa === 'QUARTIL_INFERIOR' || p.faixa === 'SEM_MARGEM' ? '#d97706' : '#16a34a'} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#666' }}>Margem (%) = (preço − custo) ÷ preço × 100. Mediana e quartis usam os produtos com custo conhecido, sem ponderação por vendas. Q1 é calculado com ao menos 4 produtos por interpolação linear e indica a faixa inferior da distribuição, não necessariamente prejuízo. No diagrama, a linha tracejada marca Q1.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead><tr>{['Produto', 'Preço atual', 'Custo unitário', 'Margem por unidade', 'Margem (%)', 'Situação'].map(t => <th key={t} style={{ padding: 10, borderBottom: '2px solid #eee' }}>{t}</th>)}</tr></thead>
            <tbody>{produtos.slice(0, 10).map(p => <tr key={p.produtoId}>
              <td style={{ padding: 10, overflowWrap: 'anywhere' }}>{p.nome}<br /><small>{p.produtoId}{p.promocaoAtiva ? ' · promoção vigente' : ''}</small></td>
              <td style={{ padding: 10 }}>{moeda(p.precoVenda)}</td><td style={{ padding: 10 }}>{moeda(p.custoUnitario)}</td>
              <td style={{ padding: 10, color: p.margemUnitaria < 0 ? '#b91c1c' : '#333', fontWeight: 'bold' }}>{moeda(p.margemUnitaria)}</td>
              <td style={{ padding: 10 }}>{percentual(p.margemPercentual)}</td><td style={{ padding: 10 }}>{faixas[p.faixa]}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </>}
  </section>;
}
