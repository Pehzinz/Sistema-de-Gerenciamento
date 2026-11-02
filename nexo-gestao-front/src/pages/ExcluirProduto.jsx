import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { BASE_URL } from '../services/api';

function ExcluirProduto() {
  // Estados do Produto
  const [idProduto, setIdProduto] = useState('');
  const [confirmacaoProduto, setConfirmacaoProduto] = useState('');
  
  // Estados da Categoria
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [confirmacaoCategoria, setConfirmacaoCategoria] = useState('');
  
  const navigate = useNavigate();

  // EXCLUSÃO DE PRODUTO
  const handleExcluirProduto = async (e) => {
    e.preventDefault();

    if (idProduto.length !== 10) {
      alert('Ação negada: O código do produto deve ter exatamente 10 dígitos.');
      return;
    }

    if (confirmacaoProduto !== 'Delete') {
      alert('Ação negada: Você deve digitar exatamente "Delete" (com D maiúsculo) para confirmar a exclusão.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return navigate('/');

    try {
      // CORREÇÃO: Utilizando a BASE_URL
      const resposta = await fetch(`${BASE_URL}/api/produtos/${idProduto}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resposta.ok || resposta.status === 204) {
        alert('Produto excluído permanentemente do catálogo!');
        setIdProduto(''); 
        setConfirmacaoProduto(''); 
      } else if (resposta.status === 404) {
        alert('Erro: Produto não encontrado no banco de dados.');
      } else {
        const erro = await resposta.json();
        alert(erro.erro || 'Erro ao excluir produto.');
      }
    } catch (erro) {
      alert('Erro de conexão ao tentar excluir o produto.');
    }
  };

  // EXCLUSÃO DE CATEGORIA
  const handleExcluirCategoria = async (e) => {
    e.preventDefault();

    if (!nomeCategoria.trim()) {
      alert('Ação negada: Informe o nome da categoria.');
      return;
    }

    if (confirmacaoCategoria !== 'Delete') {
      alert('Ação negada: Você deve digitar exatamente "Delete" (com D maiúsculo) para confirmar a exclusão.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return navigate('/');

    try {
      // CORREÇÃO: Utilizando a BASE_URL
      const resposta = await fetch(`${BASE_URL}/api/categorias/nome/${encodeURIComponent(nomeCategoria)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resposta.ok || resposta.status === 204) {
        alert('Categoria excluída com sucesso do sistema!');
        setNomeCategoria('');
        setConfirmacaoCategoria('');
      } else {
        const erro = await resposta.json();
        alert(erro.erro || 'Erro ao excluir a categoria.');
      }
    } catch (erro) {
      alert('Erro de conexão ao tentar excluir a categoria.');
    }
  };

  return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* 2. Navbar Fixa na Esquerda */}
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      <main style={{ maxWidth: '900px', margin: '0 auto', marginTop: '30px' }}>
        
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#d63031', display: 'flex', alignItems: 'center', gap: '10px' }}>
             Excluir Produto ou Categoria
          </h2>
          <div style={{ backgroundColor: '#fff0f0', borderLeft: '5px solid #d63031', padding: '15px', borderRadius: '5px', color: '#555', fontSize: '14px', lineHeight: '1.5' }}>
            <strong>Atenção:</strong> Ao confirmar a exclusão, o item será inativado no catálogo da loja. Certifique-se de que os estoques estão zerados antes de prosseguir. Esta ação exige confirmação de segurança.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          
          {/* Lado Esquerdo: Produto */}
          <div style={{ flex: 1, backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3>Excluir produto</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Confirme o código de barras (10 dígitos) e digite "Delete" para excluir.
            </p>
            
            <form onSubmit={handleExcluirProduto} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>ID do Produto</label>
                <input 
                  type="text" 
                  maxLength="10"
                  placeholder="Apenas números" 
                  value={idProduto} 
                  onChange={(e) => setIdProduto(e.target.value.replace(/\D/g, ''))} 
                  style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#d63031' }}>Confirmação</label>
                <input 
                  type="text" 
                  placeholder='Digite "Delete"' 
                  value={confirmacaoProduto} 
                  onChange={(e) => setConfirmacaoProduto(e.target.value)} 
                  style={{ padding: '12px', borderRadius: '5px', border: '2px solid #ff7675', backgroundColor: '#fff0f0', outline: 'none' }} 
                  required 
                />
              </div>

              <button type="submit" style={{ padding: '15px', backgroundColor: '#d63031', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '20px', fontSize: '16px' }}>
                DELETAR PRODUTO
              </button>
            </form>
          </div>

          {/* Lado Direito: Categoria */}
          <div style={{ flex: 1, backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3>Excluir categoria</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Digite o nome da categoria e confirme com "Delete".
            </p>
            
            <form onSubmit={handleExcluirCategoria} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Nome da Categoria</label>
                <input 
                  type="text" 
                  placeholder="Ex: Monitores" 
                  value={nomeCategoria} 
                  onChange={(e) => setNomeCategoria(e.target.value)} 
                  style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#d63031' }}>Confirmação</label>
                <input 
                  type="text" 
                  placeholder='Digite "Delete"' 
                  value={confirmacaoCategoria} 
                  onChange={(e) => setConfirmacaoCategoria(e.target.value)} 
                  style={{ padding: '12px', borderRadius: '5px', border: '2px solid #ff7675', backgroundColor: '#fff0f0', outline: 'none' }} 
                  required 
                />
              </div>

              <button type="submit" style={{ padding: '15px', backgroundColor: '#d63031', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '20px', fontSize: '16px' }}>
                DELETAR CATEGORIA
              </button>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
}

export default ExcluirProduto;