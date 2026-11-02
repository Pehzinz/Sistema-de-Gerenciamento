import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { BASE_URL } from '../services/api';

function Calendario() {
  const [dataAtual, setDataAtual] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(new Date().toISOString().split('T')[0]);
  
  const dataLocal = new Date();
  const hojeStr = `${dataLocal.getFullYear()}-${String(dataLocal.getMonth() + 1).padStart(2, '0')}-${String(dataLocal.getDate()).padStart(2, '0')}`;
  // --- ESTADOS DE DADOS (INTEGRADOS AO BANCO DE DADOS) ---
  const [eventos, setEventos] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [produtosPromo, setProdutosPromo] = useState([]);

  // Estados do Modal e Notificações
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ titulo: '', data: '', hora: '', descricao: '' });
  const [notificacao, setNotificacao] = useState(null);

  useEffect(() => {
    buscarDadosAutomatizados();
  }, [dataAtual.getFullYear()]);

  // --- FUNÇÃO PARA CARREGAR FERIADOS, PRODUTOS E EVENTOS DO BANCO ---
  const buscarDadosAutomatizados = async () => {
    const anoAtual = dataAtual.getFullYear();
    const token = localStorage.getItem('token');

    // 1. Busca Feriados Nacionais (BrasilAPI)
    try {
      const resFeriados = await fetch(`https://brasilapi.com.br/api/feriados/v1/${anoAtual}`);
      if (resFeriados.ok) {
        const dadosFeriados = await resFeriados.json();
        setFeriados(dadosFeriados);
      }
    } catch (e) {
      console.error('Erro ao buscar feriados', e);
    }

    if (!token) return;

    // 2. Busca Eventos Manuais salvos no PostgreSQL via Java
    try {
      const resEventos = await fetch(BASE_URL + '/api/eventos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resEventos.ok) {
        const dadosEventos = await resEventos.json();
        setEventos(dadosEventos);
      }
    } catch (e) {
      console.error('Erro ao buscar eventos do banco', e);
    }

    // 3. Busca Produtos em Promoção no Java
    try {
      const resProdutos = await fetch(BASE_URL + '/api/produtos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resProdutos.ok) {
        const dadosProdutos = await resProdutos.json();
        const promocoesFormatadas = dadosProdutos
          .filter(p => p.precoPromocional && p.dataInicioPromocao && p.dataFimPromocao)
          .map(p => ({
            ...p,
            inicioLimpo: String(p.dataInicioPromocao).split('T')[0],
            fimLimpo: String(p.dataFimPromocao).split('T')[0]
          }));
        setProdutosPromo(promocoesFormatadas);
      }
    } catch (e) {
      console.error('Erro ao buscar produtos', e);
    }
  };

  const mostrarNotificacao = (titulo, mensagem, icone = '📌') => {
    setNotificacao({ titulo, mensagem, icone });
    setTimeout(() => setNotificacao(null), 4000); 
  };

  const diasDaSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dataAtual);

  const primeiroDiaDoMes = new Date(ano, mes, 1).getDay(); 
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const ajustePrimeiroDia = primeiroDiaDoMes === 0 ? 6 : primeiroDiaDoMes - 1; 
  const diasVazios = Array.from({ length: ajustePrimeiroDia });
  const diasDoMesArray = Array.from({ length: diasNoMes }, (_, i) => i + 1);

  const mudarMes = (direcao) => setDataAtual(new Date(ano, mes + direcao, 1));

  const abrirModalNovo = (dia = null) => {
    let dataPreenchida = '';
    if (dia) {
      const mesFormatado = String(mes + 1).padStart(2, '0');
      const diaFormatado = String(dia).padStart(2, '0');
      dataPreenchida = `${ano}-${mesFormatado}-${diaFormatado}`;
      
      if (dataPreenchida < hojeStr) {
        mostrarNotificacao('Ação Bloqueada', 'Não é possível agendar eventos no passado.', '⚠️');
        return;
      }
    }
    setForm({ titulo: '', data: dataPreenchida, hora: '', descricao: '' });
    setEditandoId(null);
    setModalAberto(true);
  };

  const abrirModalEditar = (evento) => {
    if (evento.tipo === 'feriado' || evento.tipo === 'promo') {
      mostrarNotificacao('Ação Bloqueada', 'Eventos automáticos não podem ser editados manualmente.', '🔒');
      return;
    }
    setForm({ titulo: evento.titulo, data: evento.data, hora: evento.hora, descricao: evento.descricao });
    setEditandoId(evento.id);
    setModalAberto(true);
  };

  // --- SALVAR EVENTO NO BANCO DE DADOS (POST / PUT) ---
  const salvarEvento = async (e) => {
    e.preventDefault();
    if (form.data < hojeStr) {
      mostrarNotificacao('Data Inválida', 'A data do evento deve ser igual ou maior que hoje.', '🚫');
      return;
    }

  const token = localStorage.getItem('token');
    const url = editandoId 
      ? `${BASE_URL}/api/eventos/${editandoId}` 
      : BASE_URL + '/api/eventos';
    const method = editandoId ? 'PUT' : 'POST';

    try {
      const resposta = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (resposta.ok) {
        mostrarNotificacao(
          editandoId ? 'Evento Atualizado' : 'Evento Criado',
          editandoId ? 'As alterações foram salvas no banco.' : 'Novo compromisso salvo no banco de dados.',
          editandoId ? '✏️' : '✅'
        );
        buscarDadosAutomatizados();
        setModalAberto(false);
      } else {
        mostrarNotificacao('Erro', 'Não foi possível salvar o evento no servidor.', '❌');
      }
    } catch (erro) {
      mostrarNotificacao('Erro de Conexão', 'Falha ao comunicar com o servidor Java.', '❌');
    }
  };

  // --- EXCLUIR EVENTO NO BANCO DE DADOS (DELETE) ---
  const excluirEvento = async () => {
    if (!editandoId) return;
    const token = localStorage.getItem('token');

    try {
      const resposta = await fetch(`${BASE_URL}/api/eventos/${editandoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resposta.ok || resposta.status === 204) {
        mostrarNotificacao('Evento Excluído', 'O compromisso foi removido do banco.', '🗑️');
        buscarDadosAutomatizados();
        setModalAberto(false);
      } else {
        mostrarNotificacao('Erro', 'Não foi possível excluir o evento.', '❌');
      }
    } catch (erro) {
      mostrarNotificacao('Erro de Conexão', 'Falha ao comunicar com o servidor Java.', '❌');
    }
  };

  // --- UNIFICAÇÃO PARA A LISTAGEM DO DIA SELECIONADO ---
  const feriadosDoDia = feriados.filter(f => f.date === diaSelecionado).map((f, i) => ({
    id: `feriado-${i}`, tipo: 'feriado', hora: 'Dia Todo', titulo: `Feriado: ${f.name}`, descricao: 'Feriado Nacional', corPrimaria: '#e74c3c', corSecundaria: '#ffecec'
  }));
  const promocoesDoDia = produtosPromo.filter(p => diaSelecionado >= p.inicioLimpo && diaSelecionado <= p.fimLimpo).map(p => ({
    id: `promo-${p.id}`, tipo: 'promo', hora: 'Promoção', titulo: `Oferta: ${p.nome}`, descricao: `Válida até ${p.fimLimpo.split('-').reverse().join('/')}`, corPrimaria: '#117a65', corSecundaria: '#e8f8f5'
  }));
  const manuaisDoDia = eventos.filter(ev => ev.data === diaSelecionado).map(ev => ({
    ...ev, tipo: 'manual', corPrimaria: '#8e44ad', corSecundaria: '#fcf9ff'
  }));
  const agendaUnificadaDoDia = [...feriadosDoDia, ...promocoesDoDia, ...manuaisDoDia].sort((a, b) => a.hora.localeCompare(b.hora));

  // --- UNIFICAÇÃO PARA A LISTAGEM DOS PRÓXIMOS EVENTOS ---
  const proximosFeriados = feriados.filter(f => f.date >= hojeStr).map((f, i) => ({
    id: `prox-feriado-${i}`, tipo: 'feriado', data: f.date, hora: 'Dia Todo', titulo: `Feriado: ${f.name}`, descricao: 'Feriado Nacional', corPrimaria: '#e74c3c'
  }));
  const proximasPromocoes = produtosPromo.filter(p => p.fimLimpo >= hojeStr).map(p => ({
    id: `prox-promo-${p.id}`, tipo: 'promo', data: p.fimLimpo, hora: 'Encerramento', titulo: `Fim da Promo: ${p.nome}`, descricao: 'Data limite da oferta.', corPrimaria: '#117a65'
  }));
  const proximosManuais = eventos.filter(ev => ev.data >= hojeStr).map(ev => ({
    ...ev, tipo: 'manual', corPrimaria: '#8e44ad'
  }));
  const proximasAtividades = [...proximosFeriados, ...proximasPromocoes, ...proximosManuais]
    .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))
    .slice(0, 3);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden', position: 'relative' }}>
      
      {notificacao && (
        <div style={{
          position: 'absolute', top: '30px', right: '30px', zIndex: 9999,
          backgroundColor: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)',
          borderRadius: '16px', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)', border: '1px solid rgba(255,255,255,0.5)',
          animation: 'slideIn 0.4s ease-out forwards', width: '280px'
        }}>
          <div style={{ fontSize: '24px' }}>{notificacao.icone}</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{notificacao.titulo}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{notificacao.mensagem}</div>
          </div>
        </div>
      )}

      <div style={{ flexShrink: 0 }}><Navbar /></div>

      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>Gestão de Tempo</div>
              <h1 style={{ margin: 0, color: '#333', fontSize: '28px', letterSpacing: '-0.5px' }}>Agenda Operacional</h1>
              <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '14px' }}>Feriados, promoções e rotinas integradas ao banco de dados.</p>
            </div>
            <button onClick={() => abrirModalNovo()} style={{ padding: '12px 24px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(142,68,173,0.3)' }}>
              + Novo evento
            </button>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
              <button onClick={() => mudarMes(-1)} style={{ width: '35px', height: '35px', borderRadius: '50%', border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer' }}>{'<'}</button>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#333', textTransform: 'capitalize', minWidth: '150px', textAlign: 'center' }}>{nomeMes} de {ano}</h2>
              <button onClick={() => mudarMes(1)} style={{ width: '35px', height: '35px', borderRadius: '50%', border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer' }}>{'>'}</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
              {diasDaSemana.map(dia => <div key={dia} style={{ textAlign: 'center', fontWeight: 'bold', color: '#888', fontSize: '13px', paddingBottom: '10px' }}>{dia}</div>)}
              {diasVazios.map((_, i) => <div key={`vazio-${i}`} style={{ minHeight: '110px' }}></div>)}
              
              {diasDoMesArray.map(dia => {
                const dataString = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                
                const eventosDoDia = eventos.filter(ev => ev.data === dataString);
                const feriadoDoDia = feriados.find(f => f.date === dataString);
                const promocoesDoDia = produtosPromo.filter(p => dataString >= p.inicioLimpo && dataString <= p.fimLimpo);
                
                const isSelecionado = diaSelecionado === dataString;
                const isHoje = hojeStr === dataString;
                const isPassado = dataString < hojeStr;

                return (
                  <div 
                    key={dia} onClick={() => setDiaSelecionado(dataString)} onDoubleClick={() => abrirModalNovo(dia)}
                    style={{ 
                      minHeight: '110px', padding: '10px', borderRadius: '12px', border: isSelecionado ? '2px solid #8e44ad' : '1px solid #f0f0f0', 
                      backgroundColor: isHoje ? '#fffdf5' : (isPassado ? '#f3e8ff' : 'white'), cursor: isPassado ? 'not-allowed' : 'pointer', 
                      transition: 'all 0.2s', position: 'relative', overflowY: 'auto', opacity: isPassado ? 0.6 : 1
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: isHoje ? '#d35400' : (feriadoDoDia ? '#e74c3c' : '#555'), fontSize: '14px', marginBottom: '5px' }}>{dia}</div>
                    {feriadoDoDia && <div style={{ fontSize: '9px', backgroundColor: '#ffecec', color: '#c0392b', padding: '3px 5px', borderRadius: '4px', fontWeight: 'bold', marginBottom: '4px', lineHeight: '1.2' }}>🎉 {feriadoDoDia.name}</div>}
                    {eventosDoDia.map(ev => <div key={ev.id} style={{ fontSize: '9px', backgroundColor: '#e0c3fc', color: '#551a8b', padding: '3px 5px', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>📌 {ev.hora} - {ev.titulo}</div>)}
                    {promocoesDoDia.map(promo => <div key={`promo-${promo.id}`} style={{ fontSize: '9px', backgroundColor: '#e8f8f5', color: '#117a65', padding: '3px 5px', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>🏷️ Promo: {promo.nome}</div>)}
                  </div>
                );
              })}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #eaeaea', margin: '10px 0' }} />

          <div style={{ display: 'flex', gap: '30px' }}>
            {/* COLUNA ESQUERDA: AGENDA UNIFICADA DO DIA */}
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>📅 Agenda para o dia {diaSelecionado.split('-').reverse().join('/')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {agendaUnificadaDoDia.length > 0 ? agendaUnificadaDoDia.map(item => (
                  <div key={item.id} onClick={() => abrirModalEditar(item)} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', borderLeft: `6px solid ${item.corPrimaria}`, boxShadow: '0 2px 10px rgba(0,0,0,0.02)', cursor: item.tipo === 'manual' ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ backgroundColor: item.corSecundaria, color: item.corPrimaria, padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', minWidth: '70px' }}>
                        {item.hora}
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#333' }}>{item.titulo}</div>
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{item.descricao}</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ color: '#aaa', fontSize: '14px', fontStyle: 'italic', padding: '20px', backgroundColor: 'white', borderRadius: '12px', textAlign: 'center' }}>Nenhum compromisso para este dia.</div>
                )}
              </div>
            </div>

            {/* COLUNA DIREITA: PRÓXIMAS ATIVIDADES UNIFICADAS */}
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>🚀 Próximas Atividades</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {proximasAtividades.length > 0 ? proximasAtividades.map((ev) => (
                  <div key={ev.id} onClick={() => abrirModalEditar(ev)} style={{ backgroundColor: 'white', padding: '15px 20px', borderRadius: '12px', border: '1px solid #f0f0f0', cursor: ev.tipo === 'manual' ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ textAlign: 'center', width: '45px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: ev.corPrimaria }}>{ev.data.split('-')[2]}</div>
                      <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase' }}>{ev.data.split('-')[1]}</div>
                    </div>
                    <div style={{ borderLeft: '1px solid #eee', paddingLeft: '15px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{ev.titulo}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{ev.hora} • {ev.descricao.substring(0, 35)}...</div>
                    </div>
                  </div>
                )) : ( <div style={{ color: '#aaa', fontSize: '14px', fontStyle: 'italic' }}>Não há eventos futuros programados.</div> )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL SUSPENSO */}
      {modalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '20px', width: '450px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#333', marginTop: 0, fontSize: '20px', marginBottom: '25px' }}>{editandoId ? '✏️ Editar Evento' : '📅 Novo Evento'}</h3>
            <form onSubmit={salvarEvento}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#888', marginBottom: '5px' }}>TÍTULO DO EVENTO</label>
                <input type="text" required value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', outlineColor: '#8e44ad' }} placeholder="Ex: Fechar folha de ponto" />
              </div>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#888', marginBottom: '5px' }}>DATA</label>
                  <input type="date" required min={hojeStr} value={form.data} onChange={e => setForm({...form, data: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', outlineColor: '#8e44ad', color: '#555' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#888', marginBottom: '5px' }}>HORÁRIO</label>
                  <input type="time" required value={form.hora} onChange={e => setForm({...form, hora: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', outlineColor: '#8e44ad', color: '#555' }} />
                </div>
              </div>
              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#888', marginBottom: '5px' }}>DESCRIÇÃO (Opcional)</label>
                <textarea rows="3" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', outlineColor: '#8e44ad', resize: 'none' }} placeholder="Detalhes adicionais..."></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {editandoId ? ( <button type="button" onClick={excluirEvento} style={{ padding: '12px 15px', border: 'none', background: '#fff0f0', color: '#e74c3c', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Excluir</button> ) : ( <div></div> )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setModalAberto(false)} style={{ padding: '12px 20px', border: 'none', background: '#f5f5f5', color: '#555', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                  <button type="submit" style={{ padding: '12px 20px', border: 'none', background: '#8e44ad', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}

export default Calendario;