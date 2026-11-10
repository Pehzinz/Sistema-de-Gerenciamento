import { createPortal } from 'react-dom';

const moeda = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

export default function ProjecaoTooltip({ active, payload, label, cursorPosition }) {
  if (!active || !payload?.length || !cursorPosition) return null;
  const ponto = payload[0].payload;
  const largura = Math.min(240, window.innerWidth - 24);
  const esquerda = cursorPosition.x + largura + 18 <= window.innerWidth - 12
    ? cursorPosition.x + 18 : cursorPosition.x - largura - 18;
  const posicao = {
    position: 'fixed', width: largura,
    left: Math.max(12, Math.min(esquerda, window.innerWidth - largura - 12)),
    ...(cursorPosition.y < window.innerHeight / 2
      ? { top: cursorPosition.y + 18 } : { bottom: window.innerHeight - cursorPosition.y + 18 }),
  };
  return createPortal(<div className="projection-tooltip" style={posicao} role="status">
    <strong>{label}</strong>
    {payload.filter(item => typeof item.value === 'number' && Number.isFinite(item.value)).map(item => {
      const realizado = item.dataKey === 'realizado';
      const variacao = realizado ? ponto.variacaoRealizado : ponto.variacaoPrevisto;
      return <div className="projection-tooltip-series" key={item.dataKey}>
        <div className="projection-tooltip-value"><span style={{ color: item.color }}>{item.name}</span><b>{moeda(item.value)}</b></div>
        {variacao != null ? <span className={`projection-tooltip-change ${variacao > 0 ? 'is-up' : variacao < 0 ? 'is-down' : ''}`}>
          {variacao > 0 ? '↑ ' : variacao < 0 ? '↓ ' : '→ '}{percentual.format(variacao)}
        </span> : null}
      </div>;
    })}
  </div>, document.body);
}
