import { useNotificacoes } from '../hooks/useNotificacoes';
import NexoMark from '../components/NexoMark';
import { LabelInput } from '../components/label-input';
import AnimatedGradient from '../components/animated-gradient';
import AcessoPorEmail from '../components/AcessoPorEmail';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BASE_URL, apiFetch as fetch, readApiError } from '../services/api';
import { ERRO_NOVA_SENHA, SENHA_MAX_BYTES, SENHA_MINIMA, novaSenhaValida } from '../utils/senha';

// Spell's Mist parameters, recolored with Nexo's purple palette.
const mistConfig = { preset: 'custom', color1: '#171021', color2: '#8e44ad', color3: '#171021', rotation: 0, proportion: 33, scale: 0.48, speed: 39, distortion: 4, swirl: 65, swirlIterations: 5, softness: 100, offset: -235, shape: 'Edge', shapeSize: 48 };

function Login({ acessoPorEmail }) {
  const { notificar } = useNotificacoes();
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Estados para Login
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [cnpjLogin, setCnpjLogin] = useState('');
  const [empresaLembrada, setEmpresaLembrada] = useState(() => localStorage.getItem('empresaNome') || '');
  const [cnpjLembrado, setCnpjLembrado] = useState(() => localStorage.getItem('cnpj') || '');
  
  // Estados para Cadastro de Empresa
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [cpfAdmin, setCpfAdmin] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [senhaAdmin, setSenhaAdmin] = useState('');

  const navigate = useNavigate();
  const { hash } = useLocation();


  const fazerLogin = async (evento) => {
    evento.preventDefault();
    try {
      const resposta = await fetch(BASE_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, senha, cnpj: cnpjLembrado || cnpjLogin })
      });

      if (resposta.ok) {
        const dados = await resposta.json();
        sessionStorage.setItem('token', dados.token);
        sessionStorage.setItem('perfil', dados.perfil);
        sessionStorage.setItem('nome', dados.nomeCompleto || 'Usuário');
        localStorage.setItem('empresaNome', dados.nomeEmpresa);
        localStorage.setItem('cnpj', dados.cnpj); 

        if (dados.perfil === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/caixa');
        }
      } else {
        notificar(await readApiError(resposta, resposta.status === 401
          ? 'CPF ou senha incorretos. Confira também a empresa deste terminal'
          : 'Não foi possível entrar no sistema'), { tipo: 'erro' });
      }
    } catch {
      notificar('Erro de conexão com o servidor.', { tipo: 'erro' });
    }
  };

  const cadastrarEmpresa = async (evento) => {
    evento.preventDefault();
    if (!novaSenhaValida(senhaAdmin)) {
      notificar(ERRO_NOVA_SENHA, { tipo: 'atencao' });
      return;
    }
    try {
      const resposta = await fetch(BASE_URL + '/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeEmpresa, cnpj, nomeAdmin, cpfAdmin, senhaAdmin, emailAdmin })
      });

      if (resposta.ok) {
        // O navegador pode guardar uma empresa que já foi removida do banco de demonstração.
        const dados = await resposta.json().catch(() => ({}));
        localStorage.setItem('empresaNome', nomeEmpresa);
        localStorage.setItem('cnpj', cnpj);
        setEmpresaLembrada(nomeEmpresa);
        setCnpjLembrado(cnpj);
        ['token', 'perfil', 'nome'].forEach(key => sessionStorage.removeItem(key));
        notificar(dados.confirmacaoEmailSolicitada
          ? 'Cadastro concluído. Confira sua caixa de entrada para confirmar o e-mail de recuperação.'
          : 'Empresa e Administrador cadastrados com sucesso! Faça o login agora.', { tipo: 'sucesso' });
        setIsRegistering(false); 
        setCpf(cpfAdmin); 
        setSenha('');
        setSenhaAdmin('');
      } else {
        notificar(await readApiError(resposta, 'Não foi possível cadastrar a empresa'), { tipo: 'erro' });
      }
    } catch {
      notificar('Erro de conexão com o servidor.', { tipo: 'erro' });
    }
  };

  const limparEmpresa = () => {
    localStorage.removeItem('empresaNome');
    localStorage.removeItem('cnpj');
    setEmpresaLembrada('');
    setCnpjLembrado('');
    setCpf('');
    setSenha('');
    setCnpjLogin('');
  };

  const inputStyle = { padding: '12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '15px' };
  const btnStyle = { padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' };

  return (
    <div className="login-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif' }}>
      <AnimatedGradient config={mistConfig} className="login-gradient" />
      <div className="login-intro">
        <a className="login-brand" href="/" aria-label="Nexo Gestão, início"><span className="brand-symbol"><NexoMark /></span> nexo<span className="brand-tag">GESTÃO</span></a>
        <div className="login-intro-copy"><span className="login-eyebrow">SEU NEGÓCIO, EM SINTONIA</span><h1>Mais clareza.<br />Novas possibilidades.</h1><p>Produtos, vendas e decisões conectados em um só lugar. Simplifique a rotina e dê espaço ao que vem a seguir.</p><div className="login-features"><span>Estoque organizado</span><span>Gestão inteligente</span></div></div>
        <span className="login-footer">Um novo olhar para a sua gestão.</span>
      </div>
      <div className="login-card" style={{ backgroundColor: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '380px', textAlign: 'center' }}>
        <span className="login-card-eyebrow">BEM-VINDO AO NEXO</span>
        
        {acessoPorEmail ? <AcessoPorEmail key={hash} confirmarEmail={acessoPorEmail === 'confirmar'} /> : !isRegistering ? (
          <>
            {empresaLembrada ? (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ color: '#007bff', margin: '0 0 5px 0' }}>Nexo Gestão</h2>
                <p style={{ color: '#333', fontSize: '16px', fontWeight: 'bold', margin: '5px 0' }}>{empresaLembrada}</p>
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Terminal de Acesso</p>
              </div>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ color: '#007bff', margin: '0 0 5px 0' }}>Nexo Gestão</h2>
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Acesse sua conta corporativa</p>
              </div>
            )}

            <form onSubmit={fazerLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <LabelInput autoComplete="username" inputMode="numeric" type="text" placeholder="CPF do Usuário" value={cpf} onChange={(e) => setCpf(e.target.value)} required style={inputStyle} />
              <LabelInput autoComplete="current-password" type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required style={inputStyle} />
              {!empresaLembrada && <LabelInput label="CNPJ da empresa (opcional)" maxLength={18}
                value={cnpjLogin} onChange={e => setCnpjLogin(e.target.value)} />}
              <button type="submit" style={btnStyle}>Entrar no Sistema</button>
            </form>
            <p><Link to="/recuperar-senha" state={{ cpf }}>Esqueci minha senha</Link></p>

            {empresaLembrada ? (
              <button onClick={limparEmpresa} style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: '13px', marginTop: '25px', cursor: 'pointer', textDecoration: 'underline' }}>
                Não pertence à {empresaLembrada}? Trocar de Empresa
              </button>
            ) : (
              <div style={{ marginTop: '25px', fontSize: '14px', color: '#666' }}>
                Não tem um sistema Nexo? <br/>
                <button onClick={() => setIsRegistering(true)} style={{ background: 'none', border: 'none', color: '#007bff', fontWeight: 'bold', cursor: 'pointer', padding: '5px 0' }}>
                  Cadastre sua Empresa aqui
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ color: '#007bff', margin: '0 0 5px 0' }}>Nova Empresa</h2>
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Crie seu ambiente no Nexo</p>
            </div>

            <form onSubmit={cadastrarEmpresa} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#888' }}>DADOS DA EMPRESA</div>
              <LabelInput type="text" placeholder="Nome da Empresa (Fantasia)" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required style={inputStyle} />
              <LabelInput type="text" placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} required style={inputStyle} />
              
              <div style={{ textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#888', marginTop: '10px' }}>DADOS DO ADMINISTRADOR</div>
              <LabelInput type="text" placeholder="Seu Nome Completo" value={nomeAdmin} onChange={(e) => setNomeAdmin(e.target.value)} required style={inputStyle} />
              <LabelInput type="text" placeholder="Seu CPF" value={cpfAdmin} onChange={(e) => setCpfAdmin(e.target.value)} required style={inputStyle} />
              <LabelInput autoComplete="email" type="email" label="E-mail do administrador" maxLength={254}
                value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)} required style={inputStyle}
                aria-describedby="ajuda-email-admin" />
              <small id="ajuda-email-admin">Você usará este e-mail para recuperar o acesso à sua conta.</small>
              <LabelInput autoComplete="new-password" type="password" placeholder="Crie uma senha (mín. 6 caracteres)" minLength={SENHA_MINIMA} maxLength={SENHA_MAX_BYTES} value={senhaAdmin} onChange={(e) => setSenhaAdmin(e.target.value)} required style={inputStyle} />

              <button type="submit" style={{...btnStyle, backgroundColor: '#28a745'}}>Concluir Cadastro</button>
            </form>

            <div style={{ marginTop: '20px', fontSize: '14px' }}>
              <button onClick={() => setIsRegistering(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}>
                Voltar para o Login
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default Login;
