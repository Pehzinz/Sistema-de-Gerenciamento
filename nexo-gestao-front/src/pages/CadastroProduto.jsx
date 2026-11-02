import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { BASE_URL } from '../services/api';

function CadastroProduto() {
  const [modo, setModo] = useState('CADASTRAR');

  // --- Estados para CADASTRAR PRODUTO ---
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [preco, setPreco] = useState('');
  const [estoque, setEstoque] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');

  const [imagemUrl, setImagemUrl] = useState('');
  const [fazendoUpload, setFazendoUpload] = useState(false);

  // NOVOS ESTADOS: Promoção (Cadastro)
  const [precoPromo, setPrecoPromo] = useState('');
  const [dataInicioPromo, setDataInicioPromo] = useState(''); 
  const [dataFimPromo, setDataFimPromo] = useState('');

  // --- Estados para REPOR ESTOQUE / EDITAR ---
  const [codigoBarrasReposicao, setCodigoBarrasReposicao] = useState('');
  const [produtoEncontrado, setProdutoEncontrado] = useState(null);
  const [quantidadeAdicional, setQuantidadeAdicional] = useState(1);
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [fazendoUploadEdicao, setFazendoUploadEdicao] = useState(false); 

  // NOVOS ESTADOS: Promoção (Edição)
  const [precoPromoEdicao, setPrecoPromoEdicao] = useState('');
  const [dataInicioPromoEdicao, setDataInicioPromoEdicao] = useState(''); 
  const [dataFimPromoEdicao, setDataFimPromoEdicao] = useState('');

  const [categorias, setCategorias] = useState([]);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [nomeNovaCategoria, setNomeNovaCategoria] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    buscarCategorias();
  }, []);

  const buscarCategorias = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const resposta = await fetch(BASE_URL + '/api/categorias', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resposta.ok) {
        const dados = await resposta.json();
        setCategorias(dados);
        if (dados.length > 0 && !categoriaSelecionada) {
          setCategoriaSelecionada(dados[0].id);
        }
      }
    } catch (erro) {
      console.error('Erro ao buscar categorias:', erro);
    }
  };

  const salvarNovaCategoria = async () => {
    if (!nomeNovaCategoria.trim()) {
      alert('Digite o nome da categoria.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const resposta = await fetch(BASE_URL + '/api/categorias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nome: nomeNovaCategoria })
      });

      if (resposta.ok || resposta.status === 201) {
        const categoriaSalva = await resposta.json();
        alert('Categoria criada com sucesso!');
        setCategorias([...categorias, categoriaSalva]);
        setCategoriaSelecionada(categoriaSalva.id);
        setModalCategoriaAberto(false);
        setNomeNovaCategoria('');
      } else {
        alert('Erro ao criar categoria.');
      }
    } catch (erro) {
      alert('Erro de conexão ao criar categoria.');
    }
  };

  // --- UPLOAD PARA NOVO PRODUTO ---
  const fazerUploadImagem = async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    setFazendoUpload(true);
    const formData = new FormData();
    formData.append('file', arquivo);
    formData.append('upload_preset', 'df9czwxs'); 
    formData.append('cloud_name', 'mhdmaebz');    

    try {
      const resposta = await fetch('https://api.cloudinary.com/v1_1/mhdmaebz/image/upload', {
        method: 'POST',
        body: formData
      });
      const dados = await resposta.json();
      setImagemUrl(dados.secure_url); 
    } catch (erro) {
      alert('Erro ao enviar a imagem.');
    } finally {
      setFazendoUpload(false);
    }
  };

  // --- UPLOAD PARA EDITAR PRODUTO EXISTENTE ---
  const fazerUploadImagemEdicao = async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo || !produtoEncontrado) return;

    setFazendoUploadEdicao(true);
    const formData = new FormData();
    formData.append('file', arquivo);
    formData.append('upload_preset', 'df9czwxs'); 
    formData.append('cloud_name', 'mhdmaebz');    

    try {
      const resposta = await fetch('https://api.cloudinary.com/v1_1/mhdmaebz/image/upload', {
        method: 'POST',
        body: formData
      });
      const dados = await resposta.json();
      
      const produtoAtualizado = { ...produtoEncontrado, imagemUrl: dados.secure_url };
      setProdutoEncontrado(produtoAtualizado);
      
      salvarEdicaoProduto(produtoAtualizado, 'Foto do produto atualizada com sucesso!');
      
    } catch (erro) {
      alert('Erro ao enviar a imagem.');
    } finally {
      setFazendoUploadEdicao(false);
    }
  };

  // SALVAR EDIÇÃO DO PRODUTO NO BANCO DE DADOS
  const salvarEdicaoProduto = async (produtoEditado, mensagemSucesso = 'Alteração salva com sucesso!') => {
    const token = localStorage.getItem('token');
    try {
      // CORREÇÃO: Utilizando a BASE_URL
      const resposta = await fetch(`${BASE_URL}/api/produtos/${produtoEditado.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(produtoEditado)
      });

      if (resposta.ok) {
        alert(mensagemSucesso);
      } else {
        alert('Erro ao salvar as alterações no banco de dados.');
      }
    } catch (erro) {
      alert('Erro de conexão ao atualizar os dados.');
    }
  };

  const aplicarPromocaoExistente = () => {
    const pPromo = precoPromoEdicao ? parseFloat(precoPromoEdicao.replace(',', '.')) : null;
    const dInicio = dataInicioPromoEdicao || null;
    const dFim = dataFimPromoEdicao || null;

    if (pPromo && (!dInicio || !dFim || isNaN(pPromo) || pPromo >= produtoEncontrado.preco)) {
      return alert("Atenção: A promoção exige preço válido (menor que o original), data de início e data de fim.");
    }
    if (dInicio && dFim && dInicio > dFim) {
      return alert("Falha de segurança: A data de início não pode ser depois da data de fim!");
    }

    const produtoAtualizado = { 
      ...produtoEncontrado, 
      precoPromocional: pPromo, 
      dataInicioPromocao: dInicio,
      dataFimPromocao: dFim 
    };
    
    setProdutoEncontrado(produtoAtualizado);
    salvarEdicaoProduto(produtoAtualizado, "Promoção ativada com sucesso!");
  };  

  const removerPromocaoExistente = () => {
    setPrecoPromoEdicao('');
    setDataInicioPromoEdicao(''); 
    setDataFimPromoEdicao('');
    
    const produtoAtualizado = { 
      ...produtoEncontrado, 
      precoPromocional: null, 
      dataInicioPromocao: null, 
      dataFimPromocao: null 
    };
    
    setProdutoEncontrado(produtoAtualizado);
    salvarEdicaoProduto(produtoAtualizado, "Promoção removida!");
  };

  //Cadastrar Novo Produto;
  const salvarProduto = async (e) => {
    e.preventDefault();
    const regexApenasNumeros = /^\d+$/;
    if (codigoBarras.length !== 10 || !regexApenasNumeros.test(codigoBarras)) {
      alert('Atenção: O código de barras do produto deve conter exatamente 10 dígitos numéricos!');
      return;
    }
    const precoFormatado = preco.toString().replace(',', '.');
    const regexPreco = /^\d+(\.\d{1,2})?$/;
    const precoNumerico = parseFloat(precoFormatado);

    if (!regexPreco.test(precoFormatado) || isNaN(precoNumerico) || precoNumerico <= 0) {
      alert('Atenção: Insira um preço válido (ex: 49.90 ou 49,90) maior que zero.');
      return;
    }

    // VALIDAÇÃO DA PROMOÇÃO NO CADASTRO
    let pPromo = precoPromo ? parseFloat(precoPromo.replace(',', '.')) : null;
    if (pPromo && (!dataInicioPromo || !dataFimPromo || pPromo >= precoNumerico)) {
      return alert("A promoção exige preço menor que o original, data de início e data de fim.");
    }
    if (dataInicioPromo && dataFimPromo && dataInicioPromo > dataFimPromo) {
      return alert("Falha de segurança: A data de início não pode ser depois da data de fim!");
    }

    const token = localStorage.getItem('token');
    const novoProduto = {
      id: codigoBarras,
      nome: nome,
      marca: marca,
      preco: precoNumerico,
      estoque: parseInt(estoque),
      categoria: { id: parseInt(categoriaSelecionada) },
      imagemUrl: imagemUrl,
      precoPromocional: pPromo,
      dataInicioPromocao: dataInicioPromo || null, 
      dataFimPromocao: dataFimPromo || null
    };

    try {
      const resposta = await fetch(BASE_URL + '/api/produtos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(novoProduto)
      });

      if (resposta.status === 201 || resposta.ok) {
        navigate('/admin');
      } else {
        alert('Erro ao cadastrar. O código já existe.');
      }
    } catch (erro) {
      alert('Erro de conexão com o servidor.');
    }
  };

  // --- BUSCAR PRODUTO (REPOSIÇÃO/EDIÇÃO) ---
  const buscarProdutoParaReposicao = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setBuscandoProduto(true);
    setProdutoEncontrado(null);

    try {
      // CORREÇÃO: Utilizando a BASE_URL
      const resposta = await fetch(`${BASE_URL}/api/produtos/${codigoBarrasReposicao}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resposta.ok) {
        const prod = await resposta.json();
        setProdutoEncontrado(prod);
        setQuantidadeAdicional(1);
        
        // CARREGA A PROMOÇÃO PARA OS INPUTS
        setPrecoPromoEdicao(prod.precoPromocional ? prod.precoPromocional.toString() : '');
        setDataInicioPromoEdicao(prod.dataInicioPromocao || ''); 
        setDataFimPromoEdicao(prod.dataFimPromocao || '');
      } else {
        alert('Produto não encontrado!');
      }
    } catch (erro) {
      alert('Erro ao buscar o produto.');
    } finally {
      setBuscandoProduto(false);
    }
  };


  // --- ADICIONAR ESTOQUE ---
  const confirmarReposicaoEstoque = async () => {
    if (!produtoEncontrado) return;
    const token = localStorage.getItem('token');

    try {
      // CORREÇÃO: Utilizando a BASE_URL
      const resposta = await fetch(`${BASE_URL}/api/produtos/${produtoEncontrado.id}/adicionar-estoque`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quantidade: quantidadeAdicional })
      });

      if (resposta.ok) {
        setProdutoEncontrado(null);
        setCodigoBarrasReposicao('');
        setQuantidadeAdicional(1);
        alert('Estoque atualizado com sucesso!');
      } else {
        alert('Erro ao atualizar o estoque.');
      }
    } catch (erro) {
      alert('Erro de conexão.');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        
        <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Área de Gerenciamento
              </div>
              <h1 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Gestão de Estoque e Produtos</h1>
            </div>
          </div>

          <div style={{ display: 'flex', backgroundColor: '#e9ecef', padding: '5px', borderRadius: '12px', width: 'fit-content', gap: '5px' }}>
            <button 
              type="button"
              onClick={() => { setModo('CADASTRAR'); setProdutoEncontrado(null); }}
              style={{
                padding: '12px 25px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
                backgroundColor: modo === 'CADASTRAR' ? 'white' : 'transparent',
                color: modo === 'CADASTRAR' ? '#8e44ad' : '#666',
                boxShadow: modo === 'CADASTRAR' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              + Cadastrar Novo Produto
            </button>

            <button 
              type="button"
              onClick={() => { setModo('REPOR_ESTOQUE'); }}
              style={{
                padding: '12px 25px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
                backgroundColor: modo === 'REPOR_ESTOQUE' ? 'white' : 'transparent',
                color: modo === 'REPOR_ESTOQUE' ? '#8e44ad' : '#666',
                boxShadow: modo === 'REPOR_ESTOQUE' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              ✏️ Editar ou Adicionar Estoque
            </button>
          </div>

          {/* MODO 1: CADASTRAR */}
          {modo === 'CADASTRAR' && (
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <form onSubmit={salvarProduto} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>Código de Barras (10 dígitos) *</label>
                  <input type="text" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value.replace(/\D/g, ''))} required maxLength="10" placeholder="Ex: 7891020304" style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: '15px', outline: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 2 }}>
                    <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>Nome do Produto *</label>
                    <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Ex: Mouse Gamer" style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: '15px', outline: 'none' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>Marca *</label>
                    <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} required placeholder="Ex: Razer" style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: '15px', outline: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>Categoria *</label>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <select value={categoriaSelecionada} onChange={(e) => setCategoriaSelecionada(e.target.value)} required style={{ flex: 1, padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: '15px', outline: 'none', cursor: 'pointer' }}>
                      <option value="" disabled>Escolha a Categoria</option>
                      {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                    </select>
                    <button type="button" onClick={() => setModalCategoriaAberto(true)} style={{ padding: '0 20px', backgroundColor: '#f3e8ff', color: '#8e44ad', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>+ Nova Categoria</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>Foto do Produto</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <input type="file" accept="image/*" onChange={fazerUploadImagem} style={{ padding: '12px', border: '1px dashed #ccc', borderRadius: '8px', backgroundColor: '#fafafa', cursor: 'pointer', flex: 1 }} />
                    {fazendoUpload ? <span style={{ fontSize: '13px', color: '#8e44ad', fontWeight: 'bold' }}>Enviando... ⏳</span> : imagemUrl && <img src={imagemUrl} alt="Preview" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e0c3fc' }} />}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>Valor do Produto (R$) *</label>
                    <input type="text" value={preco} onChange={(e) => setPreco(e.target.value)} required placeholder="R$ 0,00" style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: '15px', outline: 'none' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>Estoque Inicial *</label>
                    <input type="number" value={estoque} onChange={(e) => setEstoque(e.target.value)} required placeholder="Ex: 50" style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: '15px', outline: 'none' }} />
                  </div>
                </div>

                {/* AREA DE PROMOÇÃO (CADASTRO) - ATUALIZADA COM A DATA DE INÍCIO */}
                <div style={{ backgroundColor: '#fff5f5', padding: '20px', borderRadius: '10px', border: '1px dashed #ffb8b8', display: 'flex', gap: '15px', alignItems: 'center', marginTop: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, color: '#d63031', fontSize: '16px' }}>Oferta Especial (Opcional)</h4>
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>Se preenchido, o desconto aplica-se automaticamente no período.</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', width: '130px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d63031', marginBottom: '5px' }}>Preço Promo (R$)</label>
                    <input type="text" value={precoPromo} onChange={(e) => setPrecoPromo(e.target.value)} placeholder="0.00" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ffcccc', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', width: '135px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d63031', marginBottom: '5px' }}>Início</label>
                    <input type="date" value={dataInicioPromo} onChange={(e) => setDataInicioPromo(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ffcccc', outline: 'none', cursor: 'pointer' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', width: '135px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d63031', marginBottom: '5px' }}>Válido até</label>
                    <input type="date" value={dataFimPromo} onChange={(e) => setDataFimPromo(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ffcccc', outline: 'none', cursor: 'pointer' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="submit" disabled={fazendoUpload} style={{ padding: '15px 40px', backgroundColor: fazendoUpload ? '#ccc' : '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', cursor: fazendoUpload ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>+ Cadastrar produto</button>
                </div>
              </form>
            </div>
          )}

          {/* MODO 2: EDITAR / REPOR ESTOQUE */}
          {modo === 'REPOR_ESTOQUE' && (
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              
              <form onSubmit={buscarProdutoParaReposicao} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', marginBottom: '30px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>Buscar por Código de Barras *</label>
                  <input type="text" maxLength="10" placeholder="10 dígitos numéricos" value={codigoBarrasReposicao} onChange={(e) => setCodigoBarrasReposicao(e.target.value.replace(/\D/g, ''))} style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', fontSize: '15px', outline: 'none' }} required />
                </div>
                <button type="submit" disabled={buscandoProduto} style={{ padding: '15px 30px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                  {buscandoProduto ? 'Buscando...' : 'Buscar'}
                </button>
              </form>

              {produtoEncontrado && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* CABEÇALHO DO PRODUTO ENCONTRADO */}
                  <div style={{ backgroundColor: '#fcf9ff', border: '2px dashed #e0c3fc', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {produtoEncontrado.imagemUrl ? (
                        <img src={produtoEncontrado.imagemUrl} alt={produtoEncontrado.nome} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e0c3fc' }} />
                      ) : (
                        <div style={{ width: '60px', height: '60px', borderRadius: '8px', backgroundColor: '#eee', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>📦</div>
                      )}
                      <div>
                        <h4 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{produtoEncontrado.nome}</h4>
                        <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '13px' }}>
                          Preço Original: R$ {produtoEncontrado.preco.toFixed(2).replace('.',',')} | Estoque: {produtoEncontrado.estoque} un.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BLOCO DUPLO DE EDIÇÕES (Flexbox) */}
                  <div style={{ display: 'flex', gap: '20px' }}>
                    
                    {/* COLUNA ESQUERDA: FOTO E ESTOQUE */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ border: '1px solid #eee', padding: '20px', borderRadius: '10px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Atualizar Foto</label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input type="file" accept="image/*" onChange={fazerUploadImagemEdicao} style={{ padding: '8px', flex: 1, border: '1px dashed #ccc', borderRadius: '5px' }} />
                          {fazendoUploadEdicao && <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#8e44ad' }}>Enviando...</span>}
                        </div>
                      </div>

                      <div style={{ border: '1px solid #eee', padding: '20px', borderRadius: '10px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Adicionar ao Estoque</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input type="number" min="1" value={quantidadeAdicional} onChange={(e) => setQuantidadeAdicional(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: '80px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '15px' }} />
                          <button type="button" onClick={confirmarReposicaoEstoque} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', padding: '0 20px', fontWeight: 'bold', cursor: 'pointer' }}>Confirmar</button>
                        </div>
                      </div>
                    </div>

                    {/* COLUNA DIREITA: GESTÃO DE PROMOÇÕES */}
                    <div style={{ flex: 1, backgroundColor: '#fff5f5', border: '1px dashed #ffb8b8', padding: '20px', borderRadius: '10px' }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#d63031', fontSize: '16px' }}>Definir Oferta Especial</h4>
                      
                      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d63031', marginBottom: '5px', display: 'block' }}>Preço Promo (R$)</label>
                          <input type="text" value={precoPromoEdicao} onChange={(e) => setPrecoPromoEdicao(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '5px', border: '1px solid #ffcccc', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d63031', marginBottom: '5px', display: 'block' }}>Início</label>
                          <input type="date" value={dataInicioPromoEdicao} onChange={(e) => setDataInicioPromoEdicao(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '5px', border: '1px solid #ffcccc', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d63031', marginBottom: '5px', display: 'block' }}>Fim</label>
                          <input type="date" value={dataFimPromoEdicao} onChange={(e) => setDataFimPromoEdicao(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '5px', border: '1px solid #ffcccc', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={aplicarPromocaoExistente} style={{ flex: 1, padding: '12px', backgroundColor: '#d63031', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Salvar Oferta</button>
                        {produtoEncontrado.precoPromocional && (
                          <button onClick={removerPromocaoExistente} style={{ padding: '12px', backgroundColor: '#ffe0e0', color: '#d63031', border: '1px solid #ffb8b8', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Encerrar Oferta</button>
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

        </div>
      </main>

      {/* MODAL PARA NOVA CATEGORIA */}
      {modalCategoriaAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
          <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '15px', width: '380px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#333', fontSize: '20px' }}>Nova Categoria</h3>
            <input type="text" placeholder="Ex: Monitores" value={nomeNovaCategoria} onChange={(e) => setNomeNovaCategoria(e.target.value)} style={{ width: '100%', padding: '15px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '25px', outline: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <button onClick={() => setModalCategoriaAberto(false)} style={{ padding: '12px 20px', border: 'none', background: '#f5f5f5', color: '#555', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
              <button onClick={salvarNovaCategoria} style={{ padding: '12px 20px', border: 'none', background: '#8e44ad', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar Categoria</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CadastroProduto;