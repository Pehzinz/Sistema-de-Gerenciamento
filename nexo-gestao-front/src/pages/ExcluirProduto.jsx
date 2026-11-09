import { useNotificacoes } from '../hooks/useNotificacoes';
import { LabelInput } from '../components/label-input';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { BASE_URL, readApiError, apiFetch as fetch } from '../services/api';

function ExcluirProduto() {
  const { notificar } = useNotificacoes();
  // Estados do Produto
  const [idProduto, setIdProduto] = useState('');
  const [confirmacaoProduto, setConfirmacaoProduto] = useState('');
  
  // Estados da Categoria
  const [categoriaId, setCategoriaId] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [erroCategorias, setErroCategorias] = useState('');
  const [excluindoProduto, setExcluindoProduto] = useState(false);
  const [excluindoCategoria, setExcluindoCategoria] = useState(false);
  const [confirmacaoCategoria, setConfirmacaoCategoria] = useState('');
  
  const navigate = useNavigate();

  const buscarCategorias = useCallback(async () => {
    const token = sessionStorage.getItem('token');
    if (!token) return navigate('/');
    try {
      const resposta = await fetch(`${BASE_URL}/api/categorias`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (!resposta.ok) throw new Error(await readApiError(resposta, 'Erro ao carregar categorias'));
      setCategorias(await resposta.json());
      setErroCategorias('');
    } catch (erro) {
      setCategorias([]);
      setErroCategorias(erro.message || 'Erro de conexão ao carregar categorias.');
    }
  }, [navigate]);

  useEffect(() => {
    let ativo = true;
    Promise.resolve().then(() => { if (ativo) void buscarCategorias(); });
    return () => { ativo = false; };
  }, [buscarCategorias]);

  // EXCLUSÃO DE PRODUTO
  const handleExcluirProduto = async (e) => {
    e.preventDefault();
    if (excluindoProduto) return;

    if (idProduto.length !== 10) {
      notificar('Ação negada: O código do produto deve ter exatamente 10 dígitos.', { tipo: 'atencao' });
      return;
    }

    if (confirmacaoProduto !== 'Delete') {
      notificar('Ação negada: Você deve digitar exatamente "Delete" (com D maiúsculo) para confirmar a exclusão.', { tipo: 'atencao' });
      return;
    }

    const token = sessionStorage.getItem('token');
    if (!token) return navigate('/');

    setExcluindoProduto(true);
    try {
      const resposta = await fetch(`${BASE_URL}/api/produtos/${idProduto}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resposta.ok || resposta.status === 204) {
        notificar('Produto excluído do catálogo. O histórico de vendas foi preservado.', { tipo: 'atencao' });
        setIdProduto(''); 
        setConfirmacaoProduto(''); 
      } else if (resposta.status === 404) {
        notificar('Erro: Produto não encontrado no banco de dados.', { tipo: 'erro' });
      } else {
        notificar(await readApiError(resposta, 'Erro ao excluir produto'), { tipo: 'erro' });
      }
    } catch {
      notificar('Erro de conexão ao tentar excluir o produto.', { tipo: 'erro' });
    } finally {
      setExcluindoProduto(false);
    }
  };

  // EXCLUSÃO DE CATEGORIA
  const handleExcluirCategoria = async (e) => {
    e.preventDefault();
    if (excluindoCategoria) return;

    if (!categoriaId) {
      notificar('Ação negada: Selecione uma categoria cadastrada.', { tipo: 'atencao' });
      return;
    }

    if (confirmacaoCategoria !== 'Delete') {
      notificar('Ação negada: Você deve digitar exatamente "Delete" (com D maiúsculo) para confirmar a exclusão.', { tipo: 'atencao' });
      return;
    }

    const token = sessionStorage.getItem('token');
    if (!token) return navigate('/');

    setExcluindoCategoria(true);
    try {
      const resposta = await fetch(`${BASE_URL}/api/categorias/${categoriaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resposta.ok || resposta.status === 204) {
        notificar('Categoria excluída com sucesso do sistema!', { tipo: 'sucesso' });
        setCategoriaId('');
        await buscarCategorias();
        setConfirmacaoCategoria('');
      } else {
        notificar(await readApiError(resposta, 'Erro ao excluir a categoria'), { tipo: 'erro' });
        if (resposta.status === 404) { setCategoriaId(''); await buscarCategorias(); }
      }
    } catch {
      notificar('Erro de conexão ao tentar excluir a categoria.', { tipo: 'erro' });
    } finally {
      setExcluindoCategoria(false);
    }
  };

  return (
      <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* 2. Navbar Fixa na Esquerda */}
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      <main className="app-main" style={{ maxWidth: '900px', margin: '0 auto', marginTop: '30px' }}>
        
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#d63031', display: 'flex', alignItems: 'center', gap: '10px' }}>
             Excluir Produto ou Categoria
          </h2>
          <div style={{ backgroundColor: '#fff0f0', borderLeft: '5px solid #d63031', padding: '15px', borderRadius: '5px', color: '#555', fontSize: '14px', lineHeight: '1.5' }}>
            <strong>Atenção:</strong> Ao confirmar a exclusão, o item será inativado no catálogo da loja. A exclusão é permitida com ou sem estoque, em todos os tipos. Excluir uma categoria também inativa todos os seus produtos. O saldo registrado e o histórico de vendas são preservados. Esta ação exige confirmação de segurança.
          </div>
        </div>

        <div className="responsive-row" style={{ display: 'flex', gap: '20px' }}>
          
          {/* Lado Esquerdo: Produto */}
          <div style={{ flex: 1, backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3>Excluir produto</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Confirme o código de barras (10 dígitos) e digite "Delete" para excluir.
            </p>
            
            <form onSubmit={handleExcluirProduto} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <LabelInput label="ID do Produto"
                  type="text" 
                  /*maxLength="10"*/  
                  placeholder="Apenas números" 
                  value={idProduto} 
                  onChange={(e) => setIdProduto(e.target.value.replace(/\D/g, ''))} 
                  style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
                <LabelInput label="Confirmação"
                  type="text" 
                  placeholder='Digite "Delete"' 
                  value={confirmacaoProduto} 
                  onChange={(e) => setConfirmacaoProduto(e.target.value)} 
                  style={{ padding: '12px', borderRadius: '5px', border: '2px solid #ff7675', backgroundColor: '#fff0f0', outline: 'none' }} 
                  required 
                />
              </div>

              <button type="submit" disabled={excluindoProduto} style={{ padding: '15px', backgroundColor: '#d63031', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '20px', fontSize: '16px' }}>
                DELETAR PRODUTO
              </button>
            </form>
          </div>

          {/* Lado Direito: Categoria */}
          <div style={{ flex: 1, backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3>Excluir categoria</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Selecione uma categoria cadastrada e confirme com "Delete". Todos os produtos dessa categoria também serão retirados do catálogo, mesmo com estoque.
            </p>
            
            <form onSubmit={handleExcluirCategoria} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="categoria-exclusao" style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Categoria cadastrada</label>
                <select id="categoria-exclusao" value={categoriaId} onChange={e => setCategoriaId(e.target.value)} required disabled={excluindoCategoria || !!erroCategorias} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', width: '100%' }}>
                  <option value="">Selecione uma categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {erroCategorias && <p role="alert">{erroCategorias}</p>}
                {!erroCategorias && categorias.length === 0 && <p>Nenhuma categoria ativa cadastrada.</p>}
                <button type="button" onClick={buscarCategorias} disabled={excluindoCategoria} style={{
                  alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px',
                  marginTop: '12px', padding: '10px 16px', backgroundColor: '#f9f5fa', color: '#8e44ad',
                  border: '1px solid #e0c3fc', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px',
                  cursor: excluindoCategoria ? 'not-allowed' : 'pointer', opacity: excluindoCategoria ? 0.6 : 1
                }}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7v5h-5" />
                    <path d="M4 17v-5h5" />
                    <path d="M6.1 7a7 7 0 0 1 11.6-1L20 12M4 12l2.3 6A7 7 0 0 0 17.9 17" />
                  </svg>
                  Atualizar categorias
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
                <LabelInput label="Confirmação"
                  type="text" 
                  placeholder='Digite "Delete"' 
                  value={confirmacaoCategoria} 
                  onChange={(e) => setConfirmacaoCategoria(e.target.value)} 
                  style={{ padding: '12px', borderRadius: '5px', border: '2px solid #ff7675', backgroundColor: '#fff0f0', outline: 'none' }} 
                  required 
                />
              </div>

              <button type="submit" disabled={excluindoCategoria || !categoriaId || !!erroCategorias} style={{ padding: '15px', backgroundColor: '#d63031', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '20px', fontSize: '16px' }}>
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