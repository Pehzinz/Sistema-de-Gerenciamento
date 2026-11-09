import { LabelInput } from './label-input';
export default function CustoProdutoInput({ value, onChange, preco }) {
  const custo = Number(String(value).replace(',', '.'));
  const abaixoDoCusto = String(value).trim() !== '' && Number.isFinite(custo) && Number(preco) < custo;
  return <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}><LabelInput label="Custo unitário (R$) — opcional" type="text" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder="Ex: 12,50"
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 15, borderRadius: 8, border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: 15 }} /></div>
    <p style={{ fontSize: 12, color: '#666', margin: '8px 0' }}>Custo de aquisição ou produção de uma unidade vendida, incluindo frete rateado, se houver. Em branco = desconhecido; 0 = sem custo. Usado nas próximas vendas.</p>
    {abaixoDoCusto && <p role="status" style={{ color: '#b91c1c', fontSize: 13, margin: '4px 0' }}>Atenção: o preço de venda está abaixo do custo informado.</p>}
  </div>;
}
