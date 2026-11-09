import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { moeda } from '../utils/moeda';

export default function GraficoMargens({ produtos, campo, titulo }) {
  const pontos = produtos.slice(0, 10).map(p => ({ ...p, rotulo: `${p.nome} (${p.produtoId})` }));
  if (!pontos.length) return null;
  return <div role="img" aria-label={titulo} style={{ height: Math.max(220, pontos.length * 38 + 50), width: '100%', minWidth: 0 }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={pontos} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => Number(v).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })} />
        <YAxis type="category" dataKey="rotulo" width={110} interval={0} tick={{ fontSize: 11 }} tickFormatter={v => v.length > 17 ? `${v.slice(0, 16)}…` : v} />
        <ReferenceLine x={0} stroke="#666" />
        <Tooltip formatter={v => [moeda(v), campo === 'margemUnitaria' ? 'Margem por unidade' : 'Resultado bruto']} />
        <Bar dataKey={campo} maxBarSize={24} isAnimationActive={false}>
          {pontos.map(p => <Cell key={p.produtoId} fill={p[campo] < 0 ? '#dc2626' : p[campo] === 0 ? '#d97706' : '#16a34a'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
