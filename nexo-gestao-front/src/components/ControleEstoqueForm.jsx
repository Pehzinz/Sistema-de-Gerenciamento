import { controleInicial } from '../utils/controleEstoque';
const campo = { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' };
const input = { padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '15px' };

export default function ControleEstoqueForm({ value, onChange, edicao = false }) {
  const mudar = (nome, valor) => onChange({ ...value, [nome]: valor });
  return <fieldset style={{ border: '1px solid #e0c3fc', borderRadius: '10px', padding: '20px', margin: 0 }}>
    <legend>Controle de estoque</legend>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
      <label style={campo}>Tipo de controle
        <select style={input} value={value.tipoEstoque || 'PADRAO'} onChange={e => onChange({ ...controleInicial, tipoEstoque: e.target.value })}>
          <option value="PADRAO">Estoque Padrão</option>
          <option value="COTA_TEMPO">Cota de Tempo</option>
          <option value="VALIDADE">Prazo de Validade</option>
        </select>
      </label>
      {value.tipoEstoque === 'COTA_TEMPO' ? <>
        <label style={campo}>Limite de vendas por intervalo
          <input style={input} type="number" min="1" max="2147483647" step="1" required value={value.limiteCota ?? ''} onChange={e => mudar('limiteCota', e.target.value)} />
        </label>
        <label style={campo}>Renovar a cada (minutos)
          <input style={input} type="number" min="1" max="2147483647" step="1" required placeholder="60 = 1 hora; 1440 = 1 dia" value={value.intervaloCotaMinutos ?? ''} onChange={e => mudar('intervaloCotaMinutos', e.target.value)} />
        </label>
      </> : <>
        <label style={campo}>{edicao ? 'Estoque físico (inicial ao mudar o tipo)' : 'Estoque Inicial'}
          <input style={input} type="number" min="0" max="2147483647" step="1" required value={value.estoque ?? ''} onChange={e => mudar('estoque', e.target.value)} />
        </label>
        {value.tipoEstoque === 'VALIDADE' && <label style={campo}>Validade comercial (horário local)
          <input style={input} type="datetime-local" required value={value.validadeComercial || ''} onChange={e => mudar('validadeComercial', e.target.value)} />
        </label>}
      </>}
    </div>
    {edicao && <p style={{ color: '#666', fontSize: '13px' }}>Ao trocar o tipo, informe o novo saldo físico. Para o mesmo tipo, use a reposição para adicionar unidades. Alterar limite ou intervalo inicia uma nova cota; salvar sem alterações preserva o consumo.</p>}
  </fieldset>;
}
