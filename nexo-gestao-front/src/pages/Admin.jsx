import useAtualizacaoCotas from '../hooks/useAtualizacaoCotas';
import { indicadorEstoque } from '../utils/controleEstoque';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { BASE_URL, readApiError, apiFetch as fetch } from '../services/api';

// --- CORREÇÃO AQUI: Importação moderna do PDF ---
import { jsPDF } from 'jspdf';               
import autoTable from 'jspdf-autotable';       

function Admin() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [erroDados, setErroDados] = useState('');
  const [filtroTipoEstoque, setFiltroTipoEstoque] = useState('');
  
  // NOVOS ESTADOS PARA OS FILTROS
  const [filtroMarca, setFiltroMarca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  
  const navigate = useNavigate();


  const buscarProdutos = useCallback(async () => {
    const token = sessionStorage.getItem('token');
    if (!token) return navigate('/');

    try {
      const opcoes = { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' };
      const [resposta, resCategorias] = await Promise.all([
        fetch(BASE_URL + '/api/produtos', opcoes), fetch(BASE_URL + '/api/categorias', opcoes),
      ]);
      if (!resposta.ok) throw new Error(await readApiError(resposta, 'Erro ao carregar produtos'));
      if (!resCategorias.ok) throw new Error(await readApiError(resCategorias, 'Erro ao carregar categorias'));
      const [dados, categoriasAtivas] = await Promise.all([resposta.json(), resCategorias.json()]);
      setProdutos(dados);
      setCategorias(categoriasAtivas);
      setErroDados('');
    } catch (erro) {
      setErroDados(erro.message || 'Erro ao carregar estoque.');
    }
  }, [navigate]);

  useEffect(() => {
    let ativo = true;
    Promise.resolve().then(() => { if (ativo) void buscarProdutos(); });
    return () => { ativo = false; };
  }, [buscarProdutos]);


  useAtualizacaoCotas(produtos, buscarProdutos);

  // --- LÓGICA DE FILTRAGEM ---
  
  // 1. Extrai as marcas únicas que existem na lista de produtos
  const marcasUnicas = [...new Set(produtos.map(p => p.marca).filter(Boolean))];
  
  // 2. Extrai as categorias únicas
  const categoriasUnicas = categorias;
  const categoriaDoProduto = produto => categorias.find(c => c.id === produto.categoria?.id);
  const tiposEstoque = { PADRAO: 'Estoque Padrão', COTA_TEMPO: 'Estoque de Cotas', VALIDADE: 'Estoque de Validade' };

  // 3. Aplica os filtros na lista para exibir na tabela
  const produtosFiltrados = produtos.filter(produto => {
    const matchMarca = filtroMarca === '' || produto.marca === filtroMarca;
    const matchCategoria = filtroCategoria === '' || String(categoriaDoProduto(produto)?.id ?? 'sem-categoria') === filtroCategoria;
    const matchTipo = filtroTipoEstoque === '' || (produto.tipoEstoque || 'PADRAO') === filtroTipoEstoque;
    
    return matchMarca && matchCategoria && matchTipo;
  });


  // 4. FUNÇÃO PARA GERAR O RELATÓRIO EM PDF ---
  const gerarRelatorioPDF = () => {
    const doc = new jsPDF();

    // Título do Documento
    doc.setFontSize(18);
    doc.setTextColor(51, 51, 51);
    doc.text('Relatório de Estoque - Nexo Gestão', 14, 22);

    // Data e Hora de geração
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const dataAtual = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${dataAtual} | Total de itens: ${produtosFiltrados.length}`, 14, 30);

    // Montando as colunas e linhas da tabela
    const colunas = ['Código', 'Produto', 'Marca', 'Categoria', 'Estoque', 'Preço (R$)'];
    
    const linhas = produtosFiltrados.map(p => {
      const precoFinal = p.precoPromocional 
        ? `Promo: ${p.precoPromocional.toFixed(2).replace('.', ',')}` 
        : p.preco.toFixed(2).replace('.', ',');
        
      return [
        p.id,
        p.nome,
        p.marca || '-',
        categoriaDoProduto(p)?.nome || 'Sem categoria ativa',
        indicadorEstoque(p),
        precoFinal
      ];
    });

    // --- CORREÇÃO AQUI: Nova forma de desenhar a tabela no PDF ---
    autoTable(doc, {
      startY: 35,
      head: [colunas],
      body: linhas,
      theme: 'grid',
      headStyles: { fillColor: [142, 68, 173] }, 
      styles: { fontSize: 10 },
      alternateRowStyles: { fillColor: [249, 245, 250] } 
    });

    // Dispara o download automático do arquivo
    doc.save('Relatorio_Estoque_Nexo.pdf');
  }; 

  
  return (
    <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      <main className="app-main" style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        
        <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Catálogo
              </div>
              <h1 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Estoque Atual</h1>
            </div>
            
            <div className="responsive-row" style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => { setFiltroMarca(''); setFiltroCategoria(''); setFiltroTipoEstoque(''); }} style={{ padding: '10px 20px', backgroundColor: '#f9f5fa', color: '#8e44ad', border: '1px solid #e0c3fc', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: (filtroMarca || filtroCategoria || filtroTipoEstoque) ? 'block' : 'none' }}>
                ✕ Limpar Filtros
              </button>
              
              {/* BOTÃO DO RELATÓRIO PDF */}
              <button onClick={gerarRelatorioPDF} style={{ padding: '10px 20px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(142,68,173,0.3)' }}>
                📄 Baixar PDF
              </button>
            </div>
          </div>

          {erroDados && <p role="alert">{erroDados}</p>}
          {produtos.some(p => p.categoria && !categoriaDoProduto(p)) && <p role="status">
            Há produtos vinculados a categorias ausentes da lista ativa. Consulte o diagnóstico de categorias antes de recadastrá-las.
          </p>}
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '15px', backgroundColor: 'white', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela com rolagem horizontal"><table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fcfcfc', zIndex: 1, boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                <tr>
                  <th style={{ padding: '20px', color: '#888', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>PRODUTO</th>
                  
                  {/* COLUNA MARCA COM FILTRO */}
                  <th style={{ padding: '20px', color: '#888', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      MARCA
                      <select aria-label="Filtrar por marca"
                        value={filtroMarca} 
                        onChange={(e) => setFiltroMarca(e.target.value)}
                        style={{ 
                          border: 'none', 
                          backgroundColor: filtroMarca ? '#f3e8ff' : 'transparent', 
                          color: filtroMarca ? '#8e44ad' : '#888', 
                          fontWeight: 'bold', 
                          cursor: 'pointer', 
                          outline: 'none', 
                          borderRadius: '5px',
                          width: filtroMarca ? 'auto' : '20px', 
                          padding: filtroMarca ? '2px 5px' : '0' 
                        }}
                      >
                        <option value="" style={{ color: '#888' }}>Sem filtro</option>
                        {marcasUnicas.map(marca => (
                          <option key={marca} value={marca} style={{ color: '#333' }}>{marca}</option>
                        ))}
                      </select>
                    </div>
                  </th>

                  {/* COLUNA CATEGORIA COM FILTRO */}
                  <th style={{ padding: '20px', color: '#888', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      CATEGORIA
                      <select aria-label="Filtrar por categoria"
                        value={filtroCategoria} 
                        onChange={(e) => setFiltroCategoria(e.target.value)}
                        style={{ 
                          border: 'none', 
                          backgroundColor: filtroCategoria ? '#f3e8ff' : 'transparent', 
                          color: filtroCategoria ? '#8e44ad' : '#888', 
                          fontWeight: 'bold', 
                          cursor: 'pointer', 
                          outline: 'none', 
                          borderRadius: '5px',
                          width: filtroCategoria ? 'auto' : '20px',
                          padding: filtroCategoria ? '2px 5px' : '0'
                        }}
                      >
                        <option value="" style={{ color: '#888' }}>Sem filtro</option>
                        <option value="sem-categoria">Sem categoria ativa</option>
                        {categoriasUnicas.map(cat => (
                          <option key={cat.id} value={cat.id} style={{ color: '#333' }}>{cat.nome}</option>
                        ))}
                      </select>
                    </div>
                  </th>

                  <th style={{ padding: '20px', color: '#888', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      ESTOQUE
                      <select aria-label="Tipo de Estoque"
                        value={filtroTipoEstoque}
                        onChange={e => setFiltroTipoEstoque(e.target.value)}
                        style={{
                          border: 'none',
                          backgroundColor: filtroTipoEstoque ? '#f3e8ff' : 'transparent',
                          color: filtroTipoEstoque ? '#8e44ad' : '#888',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          outline: 'none',
                          borderRadius: '5px',
                          width: filtroTipoEstoque ? 'auto' : '20px',
                          padding: filtroTipoEstoque ? '2px 5px' : '0'
                        }}
                      >
                        <option value="" style={{ color: '#888' }}>Sem filtro</option>
                        {Object.entries(tiposEstoque).map(([valor, nome]) => (
                          <option key={valor} value={valor} style={{ color: '#333' }}>{nome}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th style={{ padding: '20px', color: '#888', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>PREÇO</th>
                </tr>
              </thead>
              
              <tbody>
                {produtosFiltrados.length > 0 ? produtosFiltrados.map((produto) => (
                  <tr key={produto.id} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: 'white' }}>
                    
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ fontWeight: 'bold', color: '#333', fontSize: '15px' }}>{produto.nome}</div>
                      <div style={{ fontSize: '13px', color: '#aaa', marginTop: '4px' }}>{produto.id}</div>
                    </td>

                    <td style={{ padding: '15px 20px', color: '#666', fontSize: '14px', fontWeight: '500' }}>
                      {produto.marca}
                    </td>
                    
                    <td style={{ padding: '15px 20px', color: '#666', fontSize: '14px' }}>
                      {categoriaDoProduto(produto)?.nome || 'Sem categoria ativa'}
                    </td>
                    
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ 
                        backgroundColor: produto.quantidadeDisponivel === 0 ? '#ffeaec' : ((produto.quantidadeDisponivel ?? produto.estoque) <= 10 ? '#fff5e6' : '#e8f5e9'),
                        color: produto.quantidadeDisponivel === 0 ? '#d63031' : ((produto.quantidadeDisponivel ?? produto.estoque) <= 10 ? '#ff9900' : '#1e8e3e'),
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        fontSize: '13px', 
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}>
                        {indicadorEstoque(produto)}
                      </span>
                    </td>

                    {/* CÉLULA DE PREÇO COM VALIDAÇÃO DE PROMOÇÃO */}
                    <td style={{ padding: '15px 20px', color: '#555' }}>
                      {produto.precoPromocional ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ textDecoration: 'line-through', color: '#aaa', fontSize: '12px' }}>
                            R$ {produto.preco.toFixed(2).replace('.', ',')}
                          </span>
                          <span style={{ color: '#d63031', fontWeight: 'bold', fontSize: '15px' }}>
                            R$ {produto.precoPromocional.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 'bold', color: '#333' }}>
                          R$ {produto.preco.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                      Nenhum produto encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
          
          <div style={{ marginTop: '5px', fontSize: '13px', color: '#aaa' }}>
            Exibindo {produtosFiltrados.length} de {produtos.length} produtos
          </div>

        </div>
      </main>
    </div>
  );
}

export default Admin;