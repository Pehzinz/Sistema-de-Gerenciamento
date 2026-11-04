import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BASE_URL } from '../services/api';

function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Estados para Login
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [empresaLembrada, setEmpresaLembrada] = useState('');
  const [cnpjLembrado, setCnpjLembrado] = useState(''); 
  
  // Estados para Cadastro de Empresa
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [cpfAdmin, setCpfAdmin] = useState('');
  const [senhaAdmin, setSenhaAdmin] = useState('');

  const navigate = useNavigate();

  // A CORREÇÃO: Garante que a tela sempre pega o nome mais atual do Storage
  useEffect(() => {
    const empresaSalva = localStorage.getItem('empresaNome');
    const cnpjSalvo = localStorage.getItem('cnpj');
    if (empresaSalva && cnpjSalvo) {
      setEmpresaLembrada(empresaSalva);
      setCnpjLembrado(cnpjSalvo);
    }
  }, [localStorage.getItem('empresaNome')]); // Escuta mudanças no nome!

  const fazerLogin = async (evento) => {
    evento.preventDefault();
    try {
      const resposta = await fetch(BASE_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, senha, cnpj: cnpjLembrado }) 
      });

      if (resposta.ok) {
        const dados = await resposta.json();
        localStorage.setItem('token', dados.token);
        localStorage.setItem('perfil', dados.perfil);
        localStorage.setItem('nome', dados.nomeCompleto || 'Usuário');
        localStorage.setItem('empresaNome', dados.nomeEmpresa);
        localStorage.setItem('cnpj', dados.cnpj); 

        if (dados.perfil === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/caixa');
        }
      } else {
        alert('CPF ou senha incorretos! Tente novamente.');
      }
    } catch (erro) {
      alert('Erro de conexão com o servidor.');
    }
  };

  const cadastrarEmpresa = async (evento) => {
    evento.preventDefault();
    try {
      const resposta = await fetch(BASE_URL + '/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeEmpresa, cnpj, nomeAdmin, cpfAdmin, senhaAdmin })
      });

      if (resposta.ok) {
        alert('Empresa e Administrador cadastrados com sucesso! Faça o login agora.');
        setIsRegistering(false); 
        setCpf(cpfAdmin); 
        setSenha('');
      } else {
        const erro = await resposta.json();
        alert(erro.erro || 'Erro ao cadastrar empresa.');
      }
    } catch (erro) {
      alert('Erro de conexão com o servidor.');
    }
  };

  const limparEmpresa = () => {
    localStorage.removeItem('empresaNome');
    localStorage.removeItem('cnpj');
    setEmpresaLembrada('');
    setCnpjLembrado('');
    setCpf('');
    setSenha('');
  };

  const inputStyle = { padding: '12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '15px' };
  const btnStyle = { padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif' }}>
      
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '380px', textAlign: 'center' }}>
        
        {!isRegistering ? (
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
              <input type="text" placeholder="CPF do Usuário" value={cpf} onChange={(e) => setCpf(e.target.value)} required style={inputStyle} />
              <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required style={inputStyle} />
              <button type="submit" style={btnStyle}>Entrar no Sistema</button>
            </form>

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
              <input type="text" placeholder="Nome da Empresa (Fantasia)" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required style={inputStyle} />
              <input type="text" placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} required style={inputStyle} />
              
              <div style={{ textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#888', marginTop: '10px' }}>DADOS DO ADMINISTRADOR</div>
              <input type="text" placeholder="Seu Nome Completo" value={nomeAdmin} onChange={(e) => setNomeAdmin(e.target.value)} required style={inputStyle} />
              <input type="text" placeholder="Seu CPF" value={cpfAdmin} onChange={(e) => setCpfAdmin(e.target.value)} required style={inputStyle} />
              <input type="password" placeholder="Crie uma Senha" value={senhaAdmin} onChange={(e) => setSenhaAdmin(e.target.value)} required style={inputStyle} />

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