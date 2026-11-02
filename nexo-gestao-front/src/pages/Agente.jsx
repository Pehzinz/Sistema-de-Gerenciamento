import { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ReactMarkdown from 'react-markdown'; // <-- IMPORTANTE: Nova biblioteca
import { BASE_URL } from '../services/api';

function Agente() {
  const [mensagens, setMensagens] = useState([
    { 
      remetente: 'IA', 
      texto: 'Olá, chefe! Sou o seu Consultor de Negócios do Nexo Gestão. Estou conectado aos dados da nossa loja em tempo real. Como posso ajudar a analisar suas vendas, faturamento ou estoque hoje?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [iniciais, setIniciais] = useState('US'); // Estado para as iniciais
  
  const fimChatRef = useRef(null);

  const rolarParaFinal = () => {
    fimChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Busca o nome do usuário logado para extrair as iniciais
    const nomeSalvo = localStorage.getItem('nome') || 'Usuário Local';
    const partes = nomeSalvo.trim().split(' ');
    if (partes.length >= 2) {
      setIniciais((partes[0][0] + partes[1][0]).toUpperCase());
    } else {
      setIniciais(nomeSalvo.substring(0, 2).toUpperCase());
    }
  }, []);

  useEffect(() => {
    rolarParaFinal();
  }, [mensagens, carregando]);

  const enviarMensagem = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const perguntaUsuario = input;
    setInput(''); 
    
    setMensagens(prev => [...prev, { remetente: 'USUARIO', texto: perguntaUsuario }]);
    setCarregando(true);

    const token = localStorage.getItem('token');

    try {
      const resposta = await fetch(BASE_URL + '/api/agente/perguntar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ pergunta: perguntaUsuario })
      });

      if (resposta.ok) {
        const dados = await resposta.json();
        setMensagens(prev => [...prev, { remetente: 'IA', texto: dados.resposta }]);
      } else {
        setMensagens(prev => [...prev, { remetente: 'IA', texto: 'Desculpe, encontrei um erro ao acessar os dados da loja. Verifique a conexão com o servidor.' }]);
      }
    } catch (erro) {
      setMensagens(prev => [...prev, { remetente: 'IA', texto: 'Erro de conexão: O servidor principal do Nexo Gestão parece estar desligado.' }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      <main style={{ flex: 1, padding: '40px', overflowY: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        
        <div style={{ width: '100%', maxWidth: '1000px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Inteligência Artificial
              </div>
              <h1 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Consultor de Negócios</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#e8f5e9', padding: '8px 15px', borderRadius: '20px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#27ae60', borderRadius: '50%', display: 'inline-block' }}></span>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e8e3e' }}>Agente Online</span>
            </div>
          </div>

          <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#fafbfc' }}>
              
              {mensagens.map((msg, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: msg.remetente === 'USUARIO' ? 'row-reverse' : 'row', gap: '15px', alignItems: 'flex-start' }}>
                  
                  {/* AVATAR ATUALIZADO (Iniciais ou Brilho da IA) */}
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: msg.remetente === 'USUARIO' ? '14px' : '20px', flexShrink: 0, fontWeight: 'bold',
                    backgroundColor: msg.remetente === 'USUARIO' ? '#8e44ad' : '#f3e8ff',
                    color: msg.remetente === 'USUARIO' ? 'white' : 'inherit',
                    border: msg.remetente === 'IA' ? '1px solid #e0c3fc' : 'none',
                    marginTop: '5px'
                  }}>
                    {msg.remetente === 'USUARIO' ? iniciais : '✨'}
                  </div>

                  {/* BALÃO DE MENSAGEM ATUALIZADO */}
                  <div style={{
                    maxWidth: '75%', padding: '18px 25px', fontSize: '15px', lineHeight: '1.6',
                    backgroundColor: msg.remetente === 'USUARIO' ? '#8e44ad' : 'white',
                    color: msg.remetente === 'USUARIO' ? 'white' : '#333',
                    borderRadius: msg.remetente === 'USUARIO' ? '20px 20px 0 20px' : '20px 20px 20px 0',
                    boxShadow: msg.remetente === 'IA' ? '0 2px 10px rgba(0,0,0,0.05)' : 'none',
                    border: msg.remetente === 'IA' ? '1px solid #eee' : 'none'
                  }}>
                    {msg.remetente === 'IA' ? (
                      // O ReactMarkdown vai transformar os ** em Negrito e os ### em Títulos!
                      <ReactMarkdown>{msg.texto}</ReactMarkdown> 
                    ) : (
                      msg.texto
                    )}
                  </div>
                </div>
              ))}

              {carregando && (
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', backgroundColor: '#f3e8ff', border: '1px solid #e0c3fc' }}>✨</div>
                  <div style={{ padding: '18px 25px', backgroundColor: 'white', borderRadius: '20px 20px 20px 0', border: '1px solid #eee', color: '#888', fontStyle: 'italic', fontSize: '14px' }}>
                    Analisando dados da loja...
                  </div>
                </div>
              )}

              <div ref={fimChatRef} />
            </div>

            <div style={{ padding: '20px', backgroundColor: 'white', borderTop: '1px solid #f0f0f0' }}>
              <form onSubmit={enviarMensagem} style={{ display: 'flex', gap: '15px' }}>
                <input 
                  type="text" 
                  placeholder="Pergunte sobre vendas, promoções, equipe ou peça conselhos de negócio..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={carregando}
                  style={{ flex: 1, padding: '18px 25px', borderRadius: '30px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: '15px', outline: 'none', transition: 'border 0.2s ease' }}
                />
                <button 
                  type="submit" 
                  disabled={carregando || !input.trim()}
                  style={{ padding: '0 35px', backgroundColor: input.trim() && !carregando ? '#8e44ad' : '#ccc', color: 'white', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '15px', cursor: input.trim() && !carregando ? 'pointer' : 'not-allowed', transition: 'background 0.3s ease' }}
                >
                  Enviar
                </button>
              </form>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default Agente;