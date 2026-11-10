const moeda = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

export default function ProjecaoTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload;
  return <div className="projection-tooltip" role="status">
    <strong>{label}</strong>
    {payload.filter(item => typeof item.value === 'number' && Number.isFinite(item.value)).map(item => {
      const realizado = item.dataKey === 'realizado';
      const variacao = realizado ? ponto.variacaoRealizado : ponto.variacaoPrevisto;
      const base = realizado ? ponto.baseRealizado : ponto.basePrevisto;
      return <div className="projection-tooltip-series" key={item.dataKey}>
        <div className="projection-tooltip-value"><span style={{ color: item.color }}>{item.name}</span><b>{moeda(item.value)}</b></div>
        {variacao != null ? <span className={`projection-tooltip-change ${variacao > 0 ? 'is-up' : variacao < 0 ? 'is-down' : ''}`}>
          {variacao > 0 ? '↑ ' : variacao < 0 ? '↓ ' : '→ '}{percentual.format(variacao)} em relação a {ponto.periodoAnterior}
        </span> : <span className="projection-tooltip-change">{base === 0 ? 'Variação percentual indisponível: valor anterior igual a zero.' : 'Sem período anterior comparável.'}</span>}
      </div>;
    })}
  </div>;
}
