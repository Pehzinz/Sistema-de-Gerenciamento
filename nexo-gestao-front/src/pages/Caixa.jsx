import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import { BASE_URL, apiFetch as fetch } from '../services/api';

function Caixa() {
  const [codigoProduto, setCodigoProduto] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  
  const [etapa, setEtapa] = useState(1); 
  const [formaPagamento, setFormaPagamento] = useState('');
  
  const [modalAberto, setModalAberto] = useState(false);
  const [acaoPendente, setAcaoPendente] = useState(null); 
  const [cpfAdmin, setCpfAdmin] = useState('');
  const [senhaAdmin, setSenhaAdmin] = useState('');
  
  // NOVO ESTADO: Controle do Modal de Nota Fiscal
  const [modalNotaAberta, setModalNotaAberta] = useState(false);

  const total = carrinho.reduce((acc, item) => acc + item.subtotal, 0);

  const [tempoRestante, setTempoRestante] = useState(120); 
  const ultimaAtividadeRef = useRef(null);
  useEffect(() => {
    ultimaAtividadeRef.current = Date.now();
    const registrarAtividade = () => { ultimaAtividadeRef.current = Date.now(); };
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventos.forEach(evento => window.addEventListener(evento, registrarAtividade, { passive: true }));
    const interval = setInterval(() => {
      const decorrido = Date.now() - ultimaAtividadeRef.current;
      if (decorrido >= 130000) {
        setCarrinho([]); setEtapa(1); setFormaPagamento(''); setCodigoProduto(''); setModalNotaAberta(false);
        ultimaAtividadeRef.current = Date.now();
      }
      setTempoRestante(decorrido < 10000 || decorrido >= 130000 ? 120 : Math.ceil((130000 - decorrido) / 1000));
    }, 1000);
    return () => {
      clearInterval(interval);
      eventos.forEach(evento => window.removeEventListener(evento, registrarAtividade));
    };
  }, []);

  const minutos = Math.floor(tempoRestante / 60);
  const segundos = tempoRestante % 60;
  const tempoFormatado = `${minutos}:${segundos.toString().padStart(2, '0')}`;

  const adicionarAoCarrinho = async (e) => {
    e.preventDefault(); 

    const regexApenasNumeros = /^\d+$/;
    if (codigoProduto.length !== 10 || !regexApenasNumeros.test(codigoProduto)) {
      alert('Atenção: O código de barras deve conter exatamente 10 dígitos numéricos!');
      return; 
    }

    const token = sessionStorage.getItem('token');
    
    try {
      const resposta = await fetch(`${BASE_URL}/api/produtos/catalogo/${codigoProduto}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resposta.ok) {
        const produto = await resposta.json();
        produto.estoque = produto.quantidadeDisponivel ?? produto.estoque;
        
        if (produto.estoque < 1) {
          alert(`Atenção: O produto "${produto.nome}" está fora de stock (0 unidades).`);
          setCodigoProduto('');
          return;
        }

        let precoFinal = produto.preco;
        let isPromocaoValida = false;
        const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

        if (produto.precoPromocional && produto.dataInicioPromocao && produto.dataFimPromocao) {
          if (hoje >= produto.dataInicioPromocao && hoje <= produto.dataFimPromocao) {
            precoFinal = produto.precoPromocional;
            isPromocaoValida = true;
          }
        }
        
        const indexExistente = carrinho.findIndex(item => item.produtoId === produto.id);

        if (indexExistente !== -1) {
          if (carrinho[indexExistente].quantidade >= produto.estoque) {
            alert(`Atenção: Stock insuficiente! O limite máximo para "${produto.nome}" é de ${produto.estoque} unidade(s).`);
            setCodigoProduto('');
            return;
          }

          const novoCarrinho = [...carrinho];
          novoCarrinho[indexExistente].quantidade += 1;
          novoCarrinho[indexExistente].subtotal = novoCarrinho[indexExistente].quantidade * novoCarrinho[indexExistente].precoUnitario;
          setCarrinho(novoCarrinho);
        } else {
          const novoItem = {
            produtoId: produto.id,
            nome: produto.nome,
            marca: produto.marca || 'Marca Padrão',
            quantidade: 1,
            precoOriginal: produto.preco, 
            precoUnitario: precoFinal,    
            subtotal: precoFinal * 1,
            estoque: produto.estoque,
            imagemUrl: produto.imagemUrl,
            emPromocao: isPromocaoValida
          };
          setCarrinho([...carrinho, novoItem]);
        }
        
        setCodigoProduto(''); 
      } else {
        alert('Produto não encontrado!');
      }
    } catch {
      alert('Erro de conexão ao procurar o produto.');
    }
  };

  const tentarAlterarQuantidade = (index, novaQtd) => {
    if (novaQtd < 1) return; 

    const itemAtual = carrinho[index];

    if (novaQtd > itemAtual.quantidade) {
      if (novaQtd > itemAtual.estoque) {
        alert(`Atenção: Limite de stock atingido. Só temos ${itemAtual.estoque} unidade(s) de "${itemAtual.nome}".`);
        return;
      }

      const novoCarrinho = [...carrinho];
      novoCarrinho[index].quantidade = novaQtd;
      novoCarrinho[index].subtotal = novaQtd * novoCarrinho[index].precoUnitario;
      setCarrinho(novoCarrinho);
    } else if (novaQtd < itemAtual.quantidade) {
      setAcaoPendente({ tipo: 'DIMINUIR', index: index, novaQtd: novaQtd });
      setModalAberto(true);
    }
  };

  const tentarRemover = (index) => {
    setAcaoPendente({ tipo: 'EXCLUIR', index: index });
    setModalAberto(true);
  };

  const autorizarAcao = async () => {
    try {
      const resposta = await fetch(BASE_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfAdmin, senha: senhaAdmin, cnpj: localStorage.getItem('cnpj') })
      });

      if (resposta.ok) {
        const dados = await resposta.json();
        
        if (dados.perfil === 'ADMIN') {
          const novoCarrinho = [...carrinho];
          
          if (acaoPendente.tipo === 'EXCLUIR') {
            novoCarrinho.splice(acaoPendente.index, 1);
          } else if (acaoPendente.tipo === 'DIMINUIR') {
            novoCarrinho[acaoPendente.index].quantidade = acaoPendente.novaQtd;
            novoCarrinho[acaoPendente.index].subtotal = acaoPendente.novaQtd * novoCarrinho[acaoPendente.index].precoUnitario;
          }
          
          setCarrinho(novoCarrinho);
          setModalAberto(false);
          setAcaoPendente(null);
          setCpfAdmin('');
          setSenhaAdmin('');
        } else {
          alert('Acesso negado: Este utilizador não é Administrador.');
        }
      } else {
        alert('CPF ou Senha incorretos!');
      }
    } catch {
      alert('Erro ao validar credenciais do administrador.');
    }
  };

  const [salvando, setSalvando] = useState(false);
  const finalizarVenda = async () => {
    if (salvando) return;
    if (!formaPagamento) {
      alert('Por favor, selecione uma forma de pagamento.');
      return;
    }

    const token = sessionStorage.getItem('token');
    
    const pagamentoFormatado = formaPagamento
      .toUpperCase()
      .normalize('NFD') 
      .replace(/[\u0300-\u036f]/g, "") 
      .replaceAll(" ", "_");
    
    setSalvando(true);
    const payloadVenda = {
      formaPagamento: pagamentoFormatado, 
      total: Number(total.toFixed(2)),
      itens: carrinho.map(item => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal
      }))
    };

    try {
      const resposta = await fetch(BASE_URL + '/api/vendas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payloadVenda)
      });

      if (resposta.status === 201) {
        // Substituímos o alert nativo pelo modal customizado
        setModalNotaAberta(true);
      } else {
        const erro = await resposta.json();
        alert(`Não foi possível finalizar: ${erro.erro}`);
      }
    } catch {
      alert('Erro ao ligar ao servidor para realizar a venda.');
    } finally { setSalvando(false); }
  };

  // Função centralizada para limpar o caixa após a escolha na Nota Fiscal
  const resetarCaixaPosVenda = () => {
    setModalNotaAberta(false);
    setCarrinho([]); 
    setEtapa(1);
    setFormaPagamento('');
  };

  return (
    <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      <main className="app-main" style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        
        <div style={{ width: '100%', maxWidth: '1300px', display: 'flex', flexDirection: 'column', gap: '25px' }}>   
          
          <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Ponto de Venda (PDV)
              </div>
              <h1 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Caixa Livre</h1>
            </div>

            <div className="responsive-row" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              
              <div className="responsive-row" style={{ display: 'flex', gap: '15px', backgroundColor: 'white', padding: '10px 20px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', border: '1px solid #eee' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: etapa === 1 ? '#8e44ad' : '#aaa', fontWeight: 'bold', fontSize: '14px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: etapa === 1 ? '#8e44ad' : '#eee', color: etapa === 1 ? 'white' : '#aaa', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '12px' }}>1</span>
                  Produtos
                </div>
                <span style={{ color: '#ddd' }}>|</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: etapa === 2 ? '#8e44ad' : '#aaa', fontWeight: 'bold', fontSize: '14px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: etapa === 2 ? '#8e44ad' : '#eee', color: etapa === 2 ? 'white' : '#aaa', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '12px' }}>2</span>
                  Pagamento
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: '#f3e8ff', 
                color: '#8e44ad', 
                padding: '5px 15px', 
                borderRadius: '10px', 
                border: '1px solid #e0c3fc',
                minWidth: '80px'
              }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Inatividade</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{tempoFormatado}</span>
              </div>

            </div>
          </div>

          <div className="responsive-row" style={{ display: 'flex', gap: '25px', alignItems: 'flex-start' }}>
            
            <div style={{ flex: 2, backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              
              {etapa === 1 ? (
                <>
                  <h3 style={{ marginTop: 0, color: '#333', fontSize: '18px' }}>Adicionar produto à venda</h3>
                  
                  <form onSubmit={adicionarAoCarrinho} style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
                    <input 
                      type="text" 
                      maxLength="10"
                      placeholder="Digite o código de barras (10 dígitos) - Ex: 1234567890" 
                      value={codigoProduto} 
                      onChange={(e) => setCodigoProduto(e.target.value.replace(/\D/g, ''))} 
                      style={{ flex: 1, padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: '15px', outline: 'none' }}
                      required 
                    />
                    <button type="submit" style={{ padding: '15px 30px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 10px rgba(142,68,173,0.3)' }}>
                      Adicionar
                    </button>
                  </form>

                  <h3 style={{ color: '#333', fontSize: '18px', marginBottom: '15px' }}>Produtos adicionados</h3>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela com rolagem horizontal"><table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: '#888', borderBottom: '1px solid #f0f0f0', fontSize: '12px', letterSpacing: '0.5px' }}>
                          <th style={{ padding: '12px 0' }}>PRODUTO</th>
                          <th style={{ padding: '12px 0' }}>QTD</th>
                          <th style={{ padding: '12px 0' }}>VALOR UNIT.</th>
                          <th style={{ padding: '12px 0' }}>SUBTOTAL</th>
                          <th style={{ padding: '12px 0', textAlign: 'center' }}>AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {carrinho.length > 0 ? carrinho.map((item, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '15px 0' }}>
                              <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                
                                {item.imagemUrl ? (
                                  <img 
                                    src={item.imagemUrl} 
                                    alt={item.nome} 
                                    style={{ width: '45px', height: '45px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #eee', flexShrink: 0 }} 
                                  />
                                ) : (
                                  <div style={{ width: '45px', height: '45px', borderRadius: '8px', backgroundColor: '#f9f9f9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', border: '1px solid #eee', flexShrink: 0 }}>
                                    📦
                                  </div>
                                )}
                                
                                <div>
                                  <div style={{ fontWeight: 'bold', color: '#333', fontSize: '15px' }}>{item.nome}</div>
                                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '3px' }}>{item.marca} | ID: {item.produtoId}</div>
                                </div>
                                
                              </div>
                            </td>
                            
                            <td style={{ padding: '15px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button type="button" onClick={() => tentarAlterarQuantidade(index, item.quantidade - 1)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', color: '#333' }}>-</button>
                                
                                <div style={{ padding: '5px 12px', backgroundColor: '#f3e8ff', color: '#8e44ad', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                                  {item.quantidade}
                                </div>
                                
                                <button type="button" onClick={() => tentarAlterarQuantidade(index, item.quantidade + 1)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', color: '#333' }}>+</button>
                              </div>
                            </td>
                            
                            <td style={{ color: '#555', fontSize: '14px' }}>
                              {item.emPromocao ? (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ textDecoration: 'line-through', color: '#aaa', fontSize: '11px' }}>
                                    R$ {item.precoOriginal.toFixed(2).replace('.', ',')}
                                  </span>
                                  <span style={{ color: '#d63031', fontWeight: 'bold' }}>
                                    R$ {item.precoUnitario.toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                              ) : (
                                <span>R$ {item.precoUnitario.toFixed(2).replace('.', ',')}</span>
                              )}
                            </td>

                            <td style={{ fontWeight: 'bold', color: '#333', fontSize: '15px' }}>R$ {item.subtotal.toFixed(2).replace('.', ',')}</td>
                            <td style={{ padding: '15px 0', textAlign: 'center' }}>
                              <button type="button" onClick={() => tentarRemover(index)} style={{ padding: '6px 10px', backgroundColor: '#fff0f0', color: '#e74c3c', border: '1px solid #ffccd5', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                                ✕
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
                              Nenhum produto adicionado à venda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table></div>
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ marginTop: 0, color: '#333', fontSize: '18px' }}>Como será o pagamento?</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                    {['Crédito', 'Débito', 'Pix', 'Vale Alimentação'].map((forma) => (
                      <label key={forma} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '18px 20px', border: formaPagamento === forma ? '2px solid #8e44ad' : '1px solid #e0e0e0', backgroundColor: formaPagamento === forma ? '#fcf9ff' : 'white', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                        <input type="radio" name="pagamento" value={forma} checked={formaPagamento === forma} onChange={(e) => setFormaPagamento(e.target.value)} />
                        <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>{forma}</span>
                      </label>
                    ))}
                  </div>
                  
                  <button type="button" onClick={() => setEtapa(1)} style={{ marginTop: '30px', padding: '10px 0', border: 'none', background: 'transparent', color: '#8e44ad', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    ← Voltar para a lista de produtos
                  </button>
                </>
              )}
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '18px' }}>Resumo da venda</h3>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0', maxHeight: '250px', overflowY: 'auto' }}>
                {carrinho.length > 0 ? carrinho.map((item, index) => (
                  <li key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#555', fontSize: '14px', borderBottom: '1px dashed #f0f0f0', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{item.quantidade}x {item.nome}</span>
                      {item.emPromocao && (
                        <span style={{ fontSize: '10px', color: '#d63031', fontWeight: 'bold' }}>
                          Item com desconto aplicado
                        </span>
                      )}
                    </div>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>R$ {item.subtotal.toFixed(2).replace('.', ',')}</span>
                  </li>
                )) : (
                  <li style={{ color: '#aaa', fontSize: '13px', fontStyle: 'italic' }}>Carrinho vazio.</li>
                )}
              </ul>

              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #f0f0f0' }}>
                <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '22px', fontWeight: 'bold', marginBottom: '25px', color: '#333' }}>
                  <span>Total</span>
                  <span style={{ color: '#8e44ad' }}>R$ {total.toFixed(2).replace('.', ',')}</span>
                </div>
                
                {etapa === 1 ? (
                  <button type="button" onClick={() => setEtapa(2)} disabled={carrinho.length === 0} style={{ width: '100%', padding: '18px', backgroundColor: carrinho.length > 0 ? '#8e44ad' : '#ccc', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: carrinho.length > 0 ? 'pointer' : 'not-allowed', boxShadow: carrinho.length > 0 ? '0 4px 12px rgba(142,68,173,0.3)' : 'none' }}>
                    Selecionar Pagamento →
                  </button>
                ) : (
                  <button type="button" onClick={finalizarVenda} disabled={salvando} style={{ width: '100%', padding: '18px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(39,174,96,0.3)' }}>
                    Confirmar Pagamento ✓
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* MODAL DE AUTORIZAÇÃO DE ADMINISTRADOR */}
      {modalAberto && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
          <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '15px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#d63031', marginTop: 0, fontSize: '20px' }}>Autorização do Administrador</h3>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.5', marginBottom: '20px' }}>
              Somente o gerente pode autorizar a ação de <strong>{acaoPendente?.tipo === 'EXCLUIR' ? 'excluir o produto' : 'diminuir a quantidade'}</strong> desta venda.
            </p>
            
            <input 
              type="text" 
              placeholder="ID do Administrador" 
              value={cpfAdmin} 
              onChange={(e) => setCpfAdmin(e.target.value)} 
              style={{ width: '100%', padding: '12px', marginBottom: '12px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '8px', outline: 'none', fontSize: '14px' }} 
            />
            <input 
              type="password" 
              placeholder="Senha do Administrador" 
              value={senhaAdmin} 
              onChange={(e) => setSenhaAdmin(e.target.value)} 
              style={{ width: '100%', padding: '12px', marginBottom: '25px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '8px', outline: 'none', fontSize: '14px' }} 
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => { setModalAberto(false); setAcaoPendente(null); }} style={{ padding: '12px 20px', border: 'none', background: '#f5f5f5', color: '#555', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Cancelar
              </button>
              <button type="button" onClick={autorizarAcao} style={{ padding: '12px 20px', border: 'none', background: '#d63031', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Autorizar Ação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOVO MODAL DE NOTA FISCAL APÓS A VENDA */}
      {modalNotaAberta && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 20, backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', width: '420px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '50px', marginBottom: '15px', color: '#27ae60' }}>✅</div>  {/*PENSAR EM RETIRAR*/}
            <h2 style={{ color: '#333', marginTop: 0, fontSize: '24px', marginBottom: '10px' }}>Venda Finalizada!</h2>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px' }}>
              O stock foi atualizado. Deseja imprimir a nota fiscal desta transação?
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                type="button" 
                onClick={() => {
                  alert('A integração com a API do Mercado Pago para impressão será implementada na próxima fase!');
                  resetarCaixaPosVenda();
                }} 
                style={{ padding: '16px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 10px rgba(142,68,173,0.3)' }}
              >
                🖨️ Imprimir Nota Fiscal
              </button>
              
              <button 
                type="button" 
                onClick={resetarCaixaPosVenda} 
                style={{ padding: '16px', backgroundColor: '#f1f1f1', color: '#555', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Caixa;