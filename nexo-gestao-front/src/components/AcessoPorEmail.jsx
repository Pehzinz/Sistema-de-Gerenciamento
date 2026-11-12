import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LabelInput } from './label-input';
import { BASE_URL, apiFetch, readApiError } from '../services/api';
import { ERRO_NOVA_SENHA, SENHA_MAX_BYTES, SENHA_MINIMA, novaSenhaValida } from '../utils/senha';

export default function AcessoPorEmail({ confirmarEmail }) {
  const location = useLocation();
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  const redefinir = !confirmarEmail && Boolean(token);
  const solicitar = !confirmarEmail && !redefinir;
  const [cpf, setCpf] = useState(location.state?.cpf || '');
  const [cnpj, setCnpj] = useState(() => localStorage.getItem('cnpj') || '');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const titulo = confirmarEmail ? 'Confirmar e-mail' : redefinir ? 'Criar nova senha' : 'Recuperar senha';

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    if (redefinir && !novaSenhaValida(senha)) {
      setErro(ERRO_NOVA_SENHA);
      return;
    }
    if (redefinir && senha !== confirmacao) {
      setErro('As senhas precisam ser iguais.');
      return;
    }
    const rota = confirmarEmail ? 'confirmar-email' : redefinir ? 'redefinir-senha' : 'recuperar-senha';
    const dados = confirmarEmail ? { token } : redefinir ? { token, senha } : { cpf, cnpj, email };
    setEnviando(true);
    try {
      const resposta = await apiFetch(BASE_URL + '/api/' + rota, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      if (!resposta.ok) {
        setErro(await readApiError(resposta, 'Não foi possível concluir a solicitação'));
        return;
      }
      if (solicitar) {
        setResultado((await resposta.json()).mensagem);
      } else if (redefinir) {
        ['token', 'perfil', 'nome'].forEach(chave => sessionStorage.removeItem(chave));
        setSenha('');
        setConfirmacao('');
        setResultado('Senha alterada. Entre com sua nova senha.');
      } else {
        setResultado('E-mail confirmado. A recuperação de senha já está disponível para esta conta.');
      }
    } catch {
      setErro('Erro de conexão com o servidor.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-acesso-email">
      <h2 id="titulo-acesso-email">{titulo}</h2>
      {resultado ? <p role="status">{resultado}</p> : (
        <form onSubmit={enviar} style={{ display: 'grid', gap: '15px', marginBottom: '20px' }}>
          {solicitar && <>
            <p>Informe os dados da sua conta. O CNPJ identifica a empresa em que você usa o Nexo.</p>
            <LabelInput label="Seu CPF" autoComplete="username" inputMode="numeric"
              maxLength={14} value={cpf} onChange={e => setCpf(e.target.value)} required />
            <LabelInput label="Seu e-mail cadastrado" type="email" autoComplete="email"
              maxLength={254} value={email} onChange={e => setEmail(e.target.value)} required />
            <LabelInput label="CNPJ da empresa" maxLength={18}
              value={cnpj} onChange={e => setCnpj(e.target.value)} required />
          </>}
          {redefinir && <>
            <LabelInput label="Nova senha (mín. 6 caracteres)" type="password" autoComplete="new-password"
              minLength={SENHA_MINIMA} maxLength={SENHA_MAX_BYTES} value={senha} onChange={e => setSenha(e.target.value)} required />
            <LabelInput label="Repita a nova senha" type="password" autoComplete="new-password"
              maxLength={SENHA_MAX_BYTES} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} required />
          </>}
          {confirmarEmail && !token && <p role="alert">Abra o link de confirmação enviado ao seu e-mail.</p>}
          {erro && <p role="alert">{erro}</p>}
          {(!confirmarEmail || token) && <button type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : confirmarEmail ? 'Confirmar meu e-mail' : redefinir ? 'Salvar nova senha' : 'Enviar link de recuperação'}
          </button>}
        </form>
      )}
      {redefinir && !resultado && <p><Link to="/recuperar-senha" replace>Solicitar outro link</Link></p>}
      <Link to="/" replace>Voltar para o login</Link>
    </section>
  );
}
