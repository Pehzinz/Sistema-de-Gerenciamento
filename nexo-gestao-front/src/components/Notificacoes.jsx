import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';

import { ContextoNotificacoes } from '../hooks/useNotificacoes';
const tipos = {
  info: { titulo: 'Aviso', icone: '📌' },
  sucesso: { titulo: 'Sucesso', icone: '✅' },
  erro: { titulo: 'Não foi possível concluir', icone: '❌' },
  atencao: { titulo: 'Atenção', icone: '⚠️' },
};

function Notificacao({ item, remover }) {
  const [pausada, setPausada] = useState(false);
  useEffect(() => {
    if (pausada) return;
    const timer = setTimeout(() => remover(item.id), item.duracao);
    return () => clearTimeout(timer);
  }, [item.id, item.duracao, pausada, remover]);
  return <div className="notification-card" data-notification-id={item.id} role={item.tipo === 'erro' ? 'alert' : 'status'} onMouseEnter={() => setPausada(true)} onMouseLeave={() => setPausada(false)} onFocusCapture={() => setPausada(true)} onBlurCapture={evento => { if (!evento.currentTarget.contains(evento.relatedTarget)) setPausada(false); }}>
    <span className="notification-icon" aria-hidden="true">{item.icone}</span>
    <div className="notification-copy"><div className="notification-title">{item.titulo}</div><div className="notification-message" data-notification-message>{item.mensagem}</div></div>
    <button className="notification-close" type="button" aria-label="Fechar notificação" onClick={() => remover(item.id)}>×</button>
  </div>;
}

function Confirmacao({ item, concluir }) {
  const cancelarRef = useRef(null);
  useEffect(() => {
    const anterior = document.activeElement;
    cancelarRef.current?.focus();
    return () => { if (anterior?.isConnected) anterior.focus(); };
  }, []);
  const teclado = evento => {
    if (evento.key === 'Escape') { evento.preventDefault(); concluir(false); }
    if (evento.key === 'Tab') {
      const botoes = [...evento.currentTarget.querySelectorAll('button')];
      if (evento.shiftKey && document.activeElement === botoes[0]) { evento.preventDefault(); botoes.at(-1).focus(); }
      else if (!evento.shiftKey && document.activeElement === botoes.at(-1)) { evento.preventDefault(); botoes[0].focus(); }
    }
  };
  return <div className="modal-overlay" onKeyDown={teclado}>
    <div role="alertdialog" aria-modal="true" aria-labelledby="notification-confirm-title" aria-describedby="notification-confirm-message" style={{ width: '480px', padding: '24px', backgroundColor: 'white' }}>
      <h3 id="notification-confirm-title">{item.titulo || 'Confirmar ação'}</h3>
      <p id="notification-confirm-message">{item.mensagem}</p>
      <div className="button-group">
        <button ref={cancelarRef} type="button" onClick={() => concluir(false)}>Cancelar</button>
        <button type="button" className="button-danger" onClick={() => concluir(true)}>{item.confirmarTexto || 'Confirmar'}</button>
      </div>
    </div>
  </div>;
}

export function NotificacoesProvider({ children }) {
  const [itens, setItens] = useState([]);
  const [confirmacao, setConfirmacao] = useState(null);
  const resolverRef = useRef(null);
  const proximoId = useRef(0);
  const { key: rota } = useLocation();
  const [rotaConfirmacao, setRotaConfirmacao] = useState(rota);
  if (rotaConfirmacao !== rota) {
    setRotaConfirmacao(rota);
    setConfirmacao(null);
  }
  const remover = useCallback(id => setItens(atuais => atuais.filter(item => item.id !== id)), []);
  const notificar = useCallback((mensagem, opcoes = {}) => {
    const tipo = opcoes.tipo || 'info';
    const item = { ...tipos[tipo], ...opcoes, tipo, id: ++proximoId.current, mensagem: String(mensagem ?? ''), duracao: opcoes.duracao ?? (tipo === 'erro' ? 8000 : 5000) };
    setItens(atuais => [...atuais.slice(-2), item]);
  }, []);
  const confirmar = useCallback((mensagem, opcoes = {}) => {
    if (resolverRef.current) return Promise.resolve(false);
    return new Promise(resolve => {
      resolverRef.current = resolve;
      setConfirmacao({ ...opcoes, mensagem, rota });
    });
  }, [rota]);
  const concluir = useCallback(resultado => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setConfirmacao(null);
    resolver?.(resultado);
  }, []);
  useEffect(() => () => {
    // Mudar de página ou desmontar nunca autoriza uma ação pendente.
    const resolver = resolverRef.current;
    resolverRef.current = null;
    resolver?.(false);
  }, [rota]);
  useEffect(() => {
    const validar = evento => {
      evento.preventDefault();
      const campo = evento.target;
      const primeiro = campo.form?.querySelector('input:invalid, select:invalid, textarea:invalid');
      if (primeiro && primeiro !== campo) return;
      const nome = campo.labels?.[0]?.textContent || campo.getAttribute('aria-label') || campo.placeholder || 'Campo';
      const detalhe = campo.validity.valueMissing ? 'Preencha este campo para continuar.' : campo.validationMessage;
      notificar(`${nome}: ${detalhe}`, { titulo: 'Confira o formulário', tipo: 'atencao' });
      campo.focus();
    };
    document.addEventListener('invalid', validar, true);
    return () => document.removeEventListener('invalid', validar, true);
  }, [notificar]);
  return <ContextoNotificacoes.Provider value={{ notificar, confirmar }}>
    {children}
    {createPortal(<>
      <div className="notification-viewport" aria-label="Notificações">{itens.map(item => <Notificacao key={item.id} item={item} remover={remover} />)}</div>
      {confirmacao?.rota === rota && <Confirmacao item={confirmacao} concluir={concluir} />}
    </>, document.body)}
  </ContextoNotificacoes.Provider>;
}
