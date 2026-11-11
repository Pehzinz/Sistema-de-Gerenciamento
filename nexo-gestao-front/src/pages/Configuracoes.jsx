import { useNotificacoes } from '../hooks/useNotificacoes';
import { LabelInput } from '../components/label-input';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import EmailSeguranca from '../components/EmailSeguranca';
import { BASE_URL, apiFetch as fetch, readApiError } from '../services/api';

function Configuracoes() {
  const { notificar, confirmar } = useNotificacoes();
  const [empresa, setEmpresa] = useState({
    nome: '', cnpj: '', telefone: '', email: '', endereco: ''
  });
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('');
  
  const navigate = useNavigate();


  const buscarConfiguracoes = useCallback(async () => {
    const token = sessionStorage.getItem('token');
    try {
      const resposta = await fetch(BASE_URL + '/api/empresas/minha-empresa', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resposta.ok) {
        const dados = await resposta.json();
        setEmpresa(dados);
      }
    } catch (erro) {
      console.error('Erro ao buscar empresa', erro);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    Promise.resolve().then(() => { if (ativo) void buscarConfiguracoes(); });
    return () => { ativo = false; };
  }, [buscarConfiguracoes, navigate]);


  const salvarConfiguracoes = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('token');
    try {
      const resposta = await fetch(BASE_URL + '/api/empresas/configuracoes', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(empresa)
      });
      if (resposta.ok) {
        // A CORREÇÃO DA TELA DE LOGIN: Atualiza a memória da máquina com o novo nome
        localStorage.setItem('empresaNome', empresa.nome);
        
        notificar('Configurações salvas com sucesso!', { tipo: 'sucesso' });
      } else {
        notificar(await readApiError(resposta, 'Não foi possível salvar as configurações'), { tipo: 'erro' });
      }
    } catch {
      notificar('Falha ao salvar. Verifique a conexão.', { tipo: 'erro' });
    }
  };

  const limparEstoque = async () => {
    const confirmacao = await confirmar("ATENÇÃO: Todos os produtos terão o estoque zerado e serão ocultados do catálogo. O histórico de vendas será mantido. Tem certeza?");
    if (!confirmacao) return;

    try {
      const token = sessionStorage.getItem('token');
      const resposta = await fetch(BASE_URL + '/api/empresas/limpar-estoque', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resposta.ok) notificar('O Estoque foi limpo com sucesso.', { tipo: 'sucesso' });
      else notificar(await readApiError(resposta, 'Não foi possível limpar o estoque'), { tipo: 'erro' });
    } catch {
      notificar('Erro de conexão ao limpar o estoque. Tente novamente.', { tipo: 'erro' });
    }
  };

  const encerrarConta = async (e) => {
    e.preventDefault();
    if (confirmacaoExclusao !== 'DELETAR') {
      notificar("Para sua segurança, digite a palavra DELETAR exatamente como solicitado.", { tipo: 'atencao' });
      return;
    }

    const token = sessionStorage.getItem('token');
    const resposta = await fetch(BASE_URL + '/api/empresas/encerrar-conta', {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (resposta.ok) {
      notificar('Sua conta foi encerrada. Todos os dados foram apagados.', { tipo: 'sucesso' });
      ['token', 'perfil', 'nome'].forEach(key => sessionStorage.removeItem(key));
      ['empresaNome', 'cnpj'].forEach(key => localStorage.removeItem(key));
      navigate('/', { replace: true });
    } else {
      notificar('Houve um erro ao excluir a conta.', { tipo: 'erro' });
      setModalExclusaoAberto(false);
    }
  };

  const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', backgroundColor: '#fcfcfc', color: '#333', width: '100%', boxSizing: 'border-box', outline: 'none' };

  return (
    <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      <main className="app-main" style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        
        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
              Administração
            </div>
            <h1 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Configurações da Empresa</h1>
          </div>

          <div style={{ padding: '30px', backgroundColor: 'white', borderRadius: '15px', border: '1px solid #f0f0f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <h3 style={{ marginTop: 0, color: '#444' }}>Dados Comerciais</h3>
            
            <form className="settings-grid" onSubmit={salvarConfiguracoes} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <LabelInput label="NOME FANTASIA" type="text" value={empresa.nome} onChange={(e) => setEmpresa({...empresa, nome: e.target.value})} style={inputStyle} required />
              </div>

              <div>
                <LabelInput label="CNPJ (Bloqueado)" type="text" value={empresa.cnpj} disabled style={{...inputStyle, backgroundColor: '#f0f0f0', color: '#aaa'}} />
              </div>

              <div>
                <LabelInput label="TELEFONE PÚBLICO" type="text" value={empresa.telefone || ''} onChange={(e) => setEmpresa({...empresa, telefone: e.target.value})} style={inputStyle} placeholder="(00) 0000-0000" />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <LabelInput label="E-MAIL DE CONTATO" type="email" value={empresa.email || ''} onChange={(e) => setEmpresa({...empresa, email: e.target.value})} style={inputStyle} placeholder="contato@empresa.com" />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <LabelInput label="ENDEREÇO DA SEDE" type="text" value={empresa.endereco || ''} onChange={(e) => setEmpresa({...empresa, endereco: e.target.value})} style={inputStyle} />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="submit" style={{ padding: '12px 25px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(142,68,173,0.3)' }}>
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>

          <EmailSeguranca />

          <div style={{ padding: '30px', backgroundColor: 'white', borderRadius: '15px', border: '1px solid #ffeaec', boxShadow: '0 4px 15px rgba(214,48,49,0.05)' }}>
            <h3 style={{ marginTop: 0, color: '#d63031' }}>Zona de Perigo</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Ações realizadas nesta seção têm impacto severo na operação da loja.
            </p>

            <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '15px', borderBottom: '1px solid #f0f0f0', marginBottom: '15px' }}>
              <div>
                <strong style={{ color: '#333' }}>Limpar Catálogo e Estoque</strong>
                <div style={{ fontSize: '13px', color: '#888', marginTop: '3px' }}>Oculta os produtos e zera estoques. Mantém faturamento histórico.</div>
              </div>
              <button onClick={limparEstoque} style={{ padding: '8px 15px', backgroundColor: '#fff5e6', color: '#d68a00', border: '1px solid #ffe0b2', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Limpar Estoque
              </button>
            </div>

            <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#333' }}>Encerrar Conta do Nexo Gestão</strong>
                <div style={{ fontSize: '13px', color: '#888', marginTop: '3px' }}>Exclusão permanente de todos os dados da nuvem. Irreversível.</div>
              </div>
              <button onClick={() => setModalExclusaoAberto(true)} style={{ padding: '8px 15px', backgroundColor: '#ffeaec', color: '#d63031', border: '1px solid #ffcdd2', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Deletar Conta
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* NOVO: MODAL DE EXCLUSÃO SUSPENSO (Estilo PDV) */}
      {modalExclusaoAberto && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
          <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '15px', width: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#d63031', marginTop: 0, fontSize: '20px' }}>Exclusão Definitiva de Conta</h3>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.5', marginBottom: '20px' }}>
              Esta ação é <strong>irreversível</strong>. Todos os produtos, relatórios financeiros, histórico de vendas e contas de colaboradores serão completamente apagados dos servidores.
            </p>
            <p style={{ fontSize: '14px', color: '#333', fontWeight: 'bold', marginBottom: '10px' }}>
              Para confirmar o encerramento, digite a palavra DELETAR abaixo:
            </p>
            
            <form onSubmit={encerrarConta}>
              <LabelInput
                type="text" 
                placeholder="Digite DELETAR" 
                value={confirmacaoExclusao} 
                onChange={(e) => setConfirmacaoExclusao(e.target.value)} 
                required
                style={{ width: '100%', padding: '12px', marginBottom: '25px', boxSizing: 'border-box', border: '1px solid #ffcdd2', borderRadius: '8px', outline: 'none', fontSize: '14px', backgroundColor: '#fff5f5' }} 
              />
              
              <div className="button-group" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => { setModalExclusaoAberto(false); setConfirmacaoExclusao(''); }} style={{ padding: '12px 20px', border: 'none', background: '#f5f5f5', color: '#555', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Cancelar
                </button>
                <button className="button-danger" type="submit" style={{ padding: '12px 20px', border: 'none', background: '#d63031', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Apagar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Configuracoes;
