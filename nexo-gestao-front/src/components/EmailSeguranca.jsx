import { useEffect, useState } from 'react';
import { LabelInput } from './label-input';
import { BASE_URL, apiFetch, readApiError } from '../services/api';

const caminho = BASE_URL + '/api/usuarios/meu-email';

function autorizacao() {
  return { Authorization: `Bearer ${sessionStorage.getItem('token')}` };
}

export default function EmailSeguranca() {
  const [estado, setEstado] = useState(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function carregar() {
      try {
        const resposta = await apiFetch(caminho, { headers: autorizacao(), signal: controller.signal });
        if (!resposta.ok) {
          setErro(await readApiError(resposta, 'Não foi possível consultar o e-mail de recuperação'));
          return;
        }
        const dados = await resposta.json();
        setEstado(dados);
        setEmail(dados.emailPendente || '');
      } catch {
        if (!controller.signal.aborted) setErro('Erro de conexão ao consultar o e-mail de recuperação.');
      }
    }
    void carregar();
    return () => controller.abort();
  }, []);

  async function salvar(evento) {
    evento.preventDefault();
    setErro('');
    setResultado('');
    setEnviando(true);
    try {
      const resposta = await apiFetch(caminho, {
        method: 'POST',
        headers: { ...autorizacao(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      if (!resposta.ok) {
        setErro(await readApiError(resposta, 'Não foi possível solicitar a confirmação do e-mail'));
        return;
      }
      setEstado(atual => ({ ...atual, emailPendente: email.trim() }));
      setResultado((await resposta.json()).mensagem);
    } catch {
      setErro('Erro de conexão ao enviar a confirmação.');
    } finally {
      setSenha('');
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-email-seguranca" style={{ padding: '30px', backgroundColor: 'white', borderRadius: '15px', border: '1px solid #f0f0f0' }}>
      <h3 id="titulo-email-seguranca" style={{ marginTop: 0 }}>E-mail de recuperação</h3>
      <p>Use o e-mail da sua conta de administrador para recuperar a senha e receber avisos de segurança.</p>
      {estado && <>
        {estado.emailVerificado && <p>E-mail confirmado <strong>{estado.emailVerificado}</strong></p>}
        {estado.emailPendente && <p>Aguardando confirmação de <strong>{estado.emailPendente}</strong></p>}
        {!estado.envioDisponivel && <p>O envio de e-mails de segurança está indisponível.</p>}
        {estado.envioDisponivel && (
          <form onSubmit={salvar} style={{ display: 'grid', gap: '15px' }}>
            <LabelInput label="E-mail para recuperação" type="email" autoComplete="email" maxLength={254}
              value={email} onChange={e => setEmail(e.target.value)} required />
            <LabelInput label="Senha atual" type="password" autoComplete="current-password" maxLength={72}
              value={senha} onChange={e => setSenha(e.target.value)} required />
            <button type="submit" disabled={enviando} style={{ justifySelf: 'end', color: 'white', background: 'var(--primary)' }}>
              {enviando ? 'Enviando…' : 'Enviar link de confirmação'}
            </button>
          </form>
        )}
      </>}
      {resultado && <p role="status">{resultado}</p>}
      {erro && <p role="alert">{erro}</p>}
    </section>
  );
}
