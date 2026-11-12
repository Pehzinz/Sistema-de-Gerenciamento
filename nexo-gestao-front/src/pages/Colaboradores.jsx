import { useNotificacoes } from '../hooks/useNotificacoes';
import { LabelInput } from '../components/label-input';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { BASE_URL, readApiError, apiFetch as fetch } from '../services/api';
import { ERRO_NOVA_SENHA, SENHA_MAX_BYTES, SENHA_MINIMA, novaSenhaValida } from '../utils/senha';

function Colaboradores() {
  const { notificar } = useNotificacoes();
  const [equipe, setEquipe] = useState([]);
  
  // Novos Estados para o Formulário Completo
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  
  const [modalAberto, setModalAberto] = useState(false);
  const [colaboradorParaRemover, setColaboradorParaRemover] = useState(null);

  const navigate = useNavigate();
  const [dataHoje] = useState(() => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }));

  // --- ESTADOS PARA A EDIÇÃO DE COLABORADOR ---
  const [modalAdminEditAberto, setModalAdminEditAberto] = useState(false);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [colaboradorEditando, setColaboradorEditando] = useState(null);
  const dialogoEdicao = useRef(null);

  // Credenciais do Admin
  const [cpfAdminEdit, setCpfAdminEdit] = useState('');
  const [senhaAdminEdit, setSenhaAdminEdit] = useState('');

  // Campos do Formulário de Edição (Sem o CPF!)
  const [nomeEdit, setNomeEdit] = useState('');
  const [senhaEdit, setSenhaEdit] = useState('');
  const [emailEdit, setEmailEdit] = useState('');
  const [estadoEmailEdit, setEstadoEmailEdit] = useState(null);
  const [erroEmailEdit, setErroEmailEdit] = useState('');
  const [solicitandoConfirmacao, setSolicitandoConfirmacao] = useState(false);
  const [senhaAtualEmail, setSenhaAtualEmail] = useState('');
  const [dataNascimentoEdit, setDataNascimentoEdit] = useState('');
  const [telefoneEdit, setTelefoneEdit] = useState('');
  const [enderecoEdit, setEnderecoEdit] = useState('');
  const editandoAdmin = colaboradorEditando?.perfil === 'ADMIN';
  const idUsuarioEditando = modalEdicaoAberto ? colaboradorEditando?.id : null;
  const emailOriginal = estadoEmailEdit?.emailPendente || estadoEmailEdit?.emailVerificado || '';
  const alterouEmail = Boolean(estadoEmailEdit && emailEdit.trim()
    && emailEdit.trim().toLowerCase() !== emailOriginal.toLowerCase()
    && emailEdit.trim().toLowerCase() !== estadoEmailEdit.emailVerificado?.toLowerCase());

  const buscarEquipe = useCallback(async () => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    try {
      const resposta = await fetch(BASE_URL + '/api/usuarios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resposta.ok) {
        const dados = await resposta.json();
        setEquipe(dados);
      }
    } catch (erro) {
      console.error('Erro ao buscar equipe', erro);
    }
  }, [navigate]);

  useEffect(() => {
    let ativo = true;
    Promise.resolve().then(() => { if (ativo) void buscarEquipe(); });
    return () => { ativo = false; };
  }, [buscarEquipe]);

  useEffect(() => {
    const dialogo = dialogoEdicao.current;
    if (modalEdicaoAberto && dialogo && !dialogo.open) dialogo.showModal();
  }, [modalEdicaoAberto]);

  useEffect(() => {
    if (idUsuarioEditando == null) return;
    const controller = new AbortController();

    async function carregarEmail() {
      try {
        const resposta = await fetch(`${BASE_URL}/api/usuarios/${idUsuarioEditando}/email`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
          signal: controller.signal,
        });
        if (!resposta.ok) {
          const mensagem = await readApiError(resposta, 'Não foi possível consultar o e-mail');
          if (!controller.signal.aborted) setErroEmailEdit(mensagem);
          return;
        }
        const dados = await resposta.json();
        if (!controller.signal.aborted) {
          setEstadoEmailEdit({ ...dados, usuarioId: idUsuarioEditando });
          setEmailEdit(dados.emailPendente || dados.emailVerificado || '');
        }
      } catch {
        if (!controller.signal.aborted) setErroEmailEdit('Erro de conexão ao consultar o e-mail.');
      }
    }

    void carregarEmail();
    return () => controller.abort();
  }, [idUsuarioEditando]);

  const solicitarConfirmacaoEmail = async () => {
    setSolicitandoConfirmacao(true);
    try {
      const resposta = await fetch(`${BASE_URL}/api/usuarios/${idUsuarioEditando}/email/confirmacao`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      if (!resposta.ok) {
        notificar(await readApiError(resposta, 'Não foi possível solicitar a confirmação'), { tipo: 'erro' });
        return;
      }
      setEstadoEmailEdit(atual => atual?.usuarioId === idUsuarioEditando
        ? { ...atual, confirmacaoSolicitada: true }
        : atual);
      notificar('Link de confirmação solicitado para o endereço cadastrado.', { tipo: 'sucesso' });
    } catch {
      notificar('Erro de conexão ao solicitar a confirmação.', { tipo: 'erro' });
    } finally {
      setSolicitandoConfirmacao(false);
    }
  };

  const abrirFormularioEdicao = (usuario) => {
    setNomeEdit(usuario.nomeCompleto || usuario.nome);
    setSenhaEdit('');
    setEstadoEmailEdit(null);
    setEmailEdit('');
    setErroEmailEdit('');
    setSenhaAtualEmail('');
    setDataNascimentoEdit(usuario.dataNascimento || '');
    setTelefoneEdit(usuario.telefone || '');
    setEnderecoEdit(usuario.endereco || '');
    setModalEdicaoAberto(true);
  };

  const fecharFormularioEdicao = () => {
    dialogoEdicao.current?.close();
    setModalEdicaoAberto(false);
    setColaboradorEditando(null);
    setSenhaEdit('');
    setSenhaAtualEmail('');
  };

  const iniciarEdicao = (usuario) => {
    setColaboradorEditando(usuario);
    if (usuario.perfil === 'COLABORADOR') {
      abrirFormularioEdicao(usuario);
      return;
    }
    setCpfAdminEdit('');
    setSenhaAdminEdit('');
    setModalAdminEditAberto(true);
  };

  // 2. Valida o gerente e, se ok, abre o formulário de edição
  const validarAdminEdit = async (e) => {
    e.preventDefault();
    
    // Trava de 14 caracteres (formato 000.000.000-00)
    if (cpfAdminEdit.length !== 14) {
      notificar('O CPF do Administrador precisa estar completo (Ex: 000.000.000-00).', { tipo: 'atencao' });
      return;
    }

    try {
      // Usa a mesma rota de login para checar se a credencial é de um ADMIN
      const resposta = await fetch(BASE_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfAdminEdit, senha: senhaAdminEdit, cnpj: localStorage.getItem('cnpj') })
      });

      if (resposta.ok) {
        const dados = await resposta.json();
        if (dados.perfil === 'ADMIN') {
          setModalAdminEditAberto(false);
          setSenhaAdminEdit('');
          abrirFormularioEdicao(colaboradorEditando);
        } else {
          notificar('Ação negada: As credenciais não pertencem a um Administrador.', { tipo: 'atencao' });
        }
      } else {
        notificar(await readApiError(resposta, 'Credenciais do Administrador inválidas'), { tipo: 'atencao' });
      }
    } catch {
      notificar('Erro ao validar administrador.', { tipo: 'erro' });
    }
  };

  // 3. Envia os dados editados para o Java
  const confirmarEdicao = async (e) => {
    e.preventDefault();
    if (senhaEdit && !novaSenhaValida(senhaEdit)) {
      notificar(ERRO_NOVA_SENHA, { tipo: 'atencao' });
      return;
    }
    const token = sessionStorage.getItem('token');
    
    const dadosAtualizados = {
      nomeCompleto: nomeEdit,
      dataNascimento: dataNascimentoEdit || null,
      telefone: telefoneEdit,
      endereco: enderecoEdit,
      ...(senhaEdit && { senha: senhaEdit }),
      ...(alterouEmail && { email: emailEdit.trim(), senhaAtual: senhaAtualEmail }),
    };

    try {
      // CORREÇÃO: Utilizando a BASE_URL
      const url = `${BASE_URL}/api/usuarios/${colaboradorEditando.id}`;

      const resposta = await fetch(url, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(dadosAtualizados)
      });

      if (resposta.ok) {
        let mensagem = senhaEdit ? 'Senha alterada com sucesso!' : 'Dados atualizados com sucesso!';
        if (alterouEmail) mensagem += ' O novo e-mail ficará pendente até ser confirmado.';
        notificar(mensagem, { tipo: 'sucesso' });
        fecharFormularioEdicao();
        
        // Em vez de recarregar a página, busca a equipe atualizada suavemente
        buscarEquipe(); 
      } else {
        notificar(await readApiError(resposta, 'Não foi possível atualizar o colaborador'), { tipo: 'erro' });
      }
    } catch {
      notificar('Erro de conexão ao atualizar o colaborador.', { tipo: 'erro' });
    }
  };

  const cadastrarColaborador = async (e) => {
    e.preventDefault();
    if (!novaSenhaValida(senha)) { notificar(ERRO_NOVA_SENHA, { tipo: 'atencao' }); return; }
    const perfilSelecionado = e.nativeEvent.submitter?.value || 'COLABORADOR';
    const token = sessionStorage.getItem('token');

    // Montando o pacote completo para o Java
    const novoUsuario = {
      nomeCompleto: nome,
      cpf: cpf,
      senha: senha,
      dataNascimento: dataNascimento || null,
      telefone: telefone,
      endereco: endereco,
      perfil: perfilSelecionado,
      email: email.trim(),
    };

    try {
      const resposta = await fetch(BASE_URL + '/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(novoUsuario)
      });

      if (resposta.status === 201 || resposta.ok) {
        notificar('Usuário cadastrado. O e-mail ficará pendente até ser confirmado.', { tipo: 'sucesso' });
        // Limpa todos os campos
        setNome(''); setCpf(''); setSenha(''); setEmail('');
        setDataNascimento(''); setTelefone(''); setEndereco('');
        buscarEquipe(); 
      } else {
        notificar(await readApiError(resposta, 'Não foi possível cadastrar o usuário'), { tipo: 'erro' });
      }
    } catch {
      notificar('Erro de conexão ao salvar usuário.', { tipo: 'erro' });
    }
  };

  const tentarRemover = (colaborador) => {
    // 2. Regra matemática: Impede a exclusão se for o último Administrador
    if (colaborador.perfil === 'ADMIN') {
      const totalAdmins = equipe.filter(u => u.perfil === 'ADMIN').length;
      
      if (totalAdmins <= 1) {
        notificar('Ação negada: O sistema deve manter pelo menos 1 Administrador cadastrado.', { tipo: 'atencao' });
        return;
      }
    }
    
    // Se passou pelas regras acima, libera o modal de exclusão
    setColaboradorParaRemover(colaborador);
    setModalAberto(true);
  };

  const confirmarRemocao = async () => {
    const token = sessionStorage.getItem('token');
    try {
      // CORREÇÃO: Utilizando a BASE_URL
      const resposta = await fetch(`${BASE_URL}/api/usuarios/${colaboradorParaRemover.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resposta.ok) {
        notificar('Colaborador removido com sucesso.', { tipo: 'sucesso' });
        setModalAberto(false);
        buscarEquipe();
      } else {
        notificar(await readApiError(resposta, 'Não foi possível remover este funcionário.'), { tipo: 'erro' });
        setModalAberto(false);
      }
    } catch {
      notificar('Erro de conexão ao tentar remover usuário.', { tipo: 'erro' });
    }
  };

  const getIniciais = (nomeCompleto) => {
    if (!nomeCompleto) return 'US';
    const nomes = nomeCompleto.split(' ');
    return nomes.length > 1 
      ? (nomes[0][0] + nomes[nomes.length - 1][0]).toUpperCase()
      : nomes[0].substring(0, 2).toUpperCase();
  };

  const mascararCpf = (cpfOriginal) => {
    if (!cpfOriginal || cpfOriginal.length < 2) return '***.***.***-**';
    const ultimosDigitos = cpfOriginal.slice(-2);
    return `***.***.***-${ultimosDigitos}`;
  };

  return (
    <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* Navbar Fixa na Esquerda */}
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      {/* ÁREA CENTRAL ROLÁVEL - Centralizada (justifyContent) e alinhada ao topo (alignItems) */}
      <main className="app-main" style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        
        {/* CONTAINER RESTRITOR: Define a largura máxima e organiza os blocos */}
        <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* Cabeçalho da Página Alinhado com a Data */}
          <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: '5px', color: '#333' }}>Gestão de Colaboradores</h2>
              <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Gerencie os acessos e administradores do sistema.</p>
            </div>

            {/* Pílula de Data */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', fontSize: '13px', color: '#666', border: '1px solid #eee', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e44ad" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span>{dataHoje}</span>
            </div>
          </div>

          {/* O Seu Container Original (Formulário e Lista Lado a Lado) */}
          <div className="responsive-row" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
            
            {/* Lado Esquerdo: Formulário de Cadastro Completo */}
            <div style={{ flex: 1, backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0 }}>Adicionar colaborador ou Administrador</h3>
              <p style={{ color: '#666', fontSize: '14px' }}>Preencha nome, CPF, e-mail e senha. Os demais campos são opcionais.</p>
              
              <form onSubmit={cadastrarColaborador} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <LabelInput label="Nome e Sobrenome" type="text" placeholder="Informe o nome e sobrenome" value={nome} onChange={(e) => setNome(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} required />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <LabelInput label="CPF" type="text" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} required />
                </div>

                <LabelInput label="E-mail" type="email" autoComplete="email" maxLength={254}
                  value={email} onChange={e => setEmail(e.target.value)} required />

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <LabelInput label="Senha de Acesso" type="password" autoComplete="new-password" placeholder="Senha (mín. 6 caracteres)" minLength={SENHA_MINIMA} maxLength={SENHA_MAX_BYTES} value={senha} onChange={(e) => setSenha(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} required />
                </div>

                {/* Linha com Data de Nascimento e Telefone Lado a Lado */}
                <div className="responsive-row" style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <LabelInput label="Data de Nascimento" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <LabelInput label="Número de Telefone" type="text" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <LabelInput label="Endereço" type="text" placeholder="Rua, número, bairro, cidade e CEP" value={endereco} onChange={(e) => setEndereco(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} />
                </div>
                
                <div className="button-group collaborator-create-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="submit" value="ADMIN" style={{ flex: 1, padding: '15px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    + Administrador
                  </button>
                  <button type="submit" value="COLABORADOR" style={{ flex: 1, padding: '15px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    + Colaborador
                  </button>
                </div>
              </form>
            </div>

            {/* Lado Direito: Lista da Equipe */}
            <div style={{ flex: 2, backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0 }}>Sua equipe</h3>
              <p style={{ color: '#666', fontSize: '14px' }}>Somente o Administrador pode adicionar e remover colaboradores da loja.</p>

              <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela com rolagem horizontal"><table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '20px' }}>
                <thead>
                  <tr style={{ color: '#888', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '10px 0' }}>COLABORADOR / CPF</th>
                    <th style={{ padding: '10px 0' }}>PERFIL</th>
                    <th style={{ padding: '10px 0' }}>AÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {equipe.length > 0 ? equipe.map((usuario) => (
                    <tr key={usuario.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '15px 0', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: '#f3e5f5', color: '#8e44ad', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                          {getIniciais(usuario.nomeCompleto)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#333' }}>{usuario.nomeCompleto}</div>
                          <div style={{ fontSize: '13px', color: '#888', marginTop: '3px' }}>
                            {mascararCpf(usuario.cpf)}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: '#666' }}>
                          {usuario.perfil === 'ADMIN' ? 'Administrador' : 'Colaborador'}
                        </span>
                      </td>
                      <td>
                        <div className="button-group" style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => iniciarEdicao(usuario)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', backgroundColor: '#fcf9ff', color: '#8e44ad', border: '1px solid #e0c3fc', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                            ✏️ Editar
                          </button>
                          
                          <button className="button-danger" onClick={() => tentarRemover(usuario)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', backgroundColor: 'transparent', color: '#e31b0c', border: '1px solid #ffccd5', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                            🗑 Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                        Nenhum colaborador encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table></div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '20px', fontSize: '12px', color: '#888' }}>
                🔒 CPF mascarado. Dados pessoais não são exibidos na lista.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL DE REMOÇÃO */}
      {modalAberto && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
          <div style={{ backgroundColor: '#f9f5fa', padding: '40px', borderRadius: '15px', width: '400px', textAlign: 'center', border: '1px solid #e0c3fc' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
               <div style={{ width: '50px', height: '50px', borderRadius: '8px', backgroundColor: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', border: '1px solid #eee' }}>🗑</div>
            </div>
            
            <h3 style={{ marginTop: 0, color: '#333' }}>Remover {colaboradorParaRemover?.nomeCompleto}?</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '30px', lineHeight: '1.5' }}>
              Ao confirmar, o funcionário será removido da equipe e perderá o acesso à loja. Suas vendas e o histórico contábil serão preservados.
            </p>
            
            <div className="button-group" style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
              <button onClick={() => setModalAberto(false)} style={{ padding: '12px 25px', border: 'none', background: 'white', color: '#8e44ad', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                Cancelar
              </button>
              <button className="button-danger" onClick={confirmarRemocao} style={{ padding: '12px 25px', border: 'none', background: '#e31b0c', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(227,27,12,0.2)' }}>
                Confirmar remoção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: AUTORIZAÇÃO DO ADMINISTRADOR PARA EDIÇÃO */}
      {modalAdminEditAberto && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 15 }}>
          <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '15px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#8e44ad', marginTop: 0, fontSize: '20px' }}>Autorização Necessária</h3>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.5', marginBottom: '20px' }}>
              Somente o Administrador pode autorizar a edição do colaborador <strong>{colaboradorEditando?.nomeCompleto}</strong>.
            </p>
            
            <form onSubmit={validarAdminEdit}>
              {/* Máscara de CPF aplicada no onChange */}
              <LabelInput
                type="text" 
                maxLength="14"
                placeholder="CPF do Administrador" 
                value={cpfAdminEdit} 
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, ''); 
                  if (v.length > 11) v = v.substring(0, 11); 
                  
                  v = v.replace(/(\d{3})(\d)/, '$1.$2');
                  v = v.replace(/(\d{3})(\d)/, '$1.$2');
                  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                  
                  setCpfAdminEdit(v);
                }} 
                style={{ width: '100%', padding: '12px', marginBottom: '12px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '8px', outline: 'none', fontSize: '14px' }} 
                required
              />
              <LabelInput
                type="password" 
                placeholder="Senha do Administrador" 
                value={senhaAdminEdit} 
                onChange={(e) => setSenhaAdminEdit(e.target.value)} 
                style={{ width: '100%', padding: '12px', marginBottom: '25px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '8px', outline: 'none', fontSize: '14px' }} 
                required
              />
              
              <div className="button-group" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => { setModalAdminEditAberto(false); setColaboradorEditando(null); }} style={{ padding: '12px 20px', border: 'none', background: '#f5f5f5', color: '#555', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '12px 20px', border: 'none', background: '#8e44ad', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Autorizar Edição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: FORMULÁRIO DE EDIÇÃO (SEM CPF) */}
      {modalEdicaoAberto && (
          <dialog ref={dialogoEdicao} className="colaborador-edicao" aria-labelledby="titulo-editar-colaborador"
            onCancel={evento => { evento.preventDefault(); fecharFormularioEdicao(); }}>
            <h3 id="titulo-editar-colaborador" style={{ marginTop: 0, color: '#333', fontSize: '22px' }}>
              {editandoAdmin ? 'Editar Administrador' : 'Editar Colaborador'}
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '25px' }}>
              Alterando os dados de <strong>{colaboradorEditando?.nomeCompleto}</strong>. O CPF não pode ser alterado.
            </p>
            
            <form onSubmit={confirmarEdicao} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <LabelInput label="Nome e Sobrenome" type="text" value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} required />
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                  <LabelInput label="E-mail de recuperação" type="email" autoComplete="email" maxLength={254}
                    value={emailEdit} onChange={e => setEmailEdit(e.target.value)} disabled={!estadoEmailEdit}
                    aria-describedby="estado-email-edicao" />
                  {erroEmailEdit ? <small role="alert" id="estado-email-edicao">{erroEmailEdit}</small> : (
                    <small id="estado-email-edicao">
                      {mensagemEmailRecuperacao(estadoEmailEdit)}
                    </small>
                  )}
                  {estadoEmailEdit?.envioDisponivel && estadoEmailEdit.emailPendente
                    && emailEdit.trim() === estadoEmailEdit.emailPendente && (
                      <button type="button" onClick={solicitarConfirmacaoEmail} disabled={solicitandoConfirmacao}
                        style={{ justifySelf: 'start' }}>
                        {solicitandoConfirmacao ? 'Solicitando…'
                          : estadoEmailEdit.confirmacaoSolicitada ? 'Reenviar confirmação' : 'Enviar confirmação'}
                      </button>
                    )}
                  {alterouEmail && <LabelInput label="Senha atual da conta editada" type="password"
                    autoComplete="current-password" maxLength={72} value={senhaAtualEmail}
                    onChange={e => setSenhaAtualEmail(e.target.value)} required />}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <LabelInput label="Nova senha (opcional)" type="password" autoComplete="new-password"
                  minLength={SENHA_MINIMA} maxLength={SENHA_MAX_BYTES} aria-describedby="ajuda-nova-senha"
                  value={senhaEdit} onChange={(e) => setSenhaEdit(e.target.value)} />
                <small id="ajuda-nova-senha">Preencha com pelo menos 6 caracteres para trocar a senha.</small>
              </div>

              <div className="responsive-row" style={{ display: 'flex', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <LabelInput label="Data de Nascimento" type="date" value={dataNascimentoEdit} onChange={(e) => setDataNascimentoEdit(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <LabelInput label="Número de Telefone" type="text" value={telefoneEdit} onChange={(e) => setTelefoneEdit(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <LabelInput label="Endereço" type="text" value={enderecoEdit} onChange={(e) => setEnderecoEdit(e.target.value)} />
              </div>
              
              <div className="button-group" style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px' }}>
                <button type="button" onClick={fecharFormularioEdicao} style={{ padding: '15px 25px', border: 'none', background: '#f5f5f5', color: '#555', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '15px 25px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 10px rgba(142,68,173,0.3)' }}>
                  Confirmar Edição
                </button>
              </div>
            </form>
          </dialog>
      )}
    </div>
  );
}

function mensagemEmailRecuperacao(estado) {
  if (!estado) return 'Carregando e-mail…';
  if (!estado.envioDisponivel) {
    return estado.emailPendente
      ? 'Endereço salvo. O envio do link de confirmação está indisponível.'
      : 'O envio de e-mails de segurança está indisponível.';
  }
  if (estado.emailPendente) {
    return estado.confirmacaoSolicitada
      ? 'Confirmação solicitada. Confira a caixa de entrada e o spam.'
      : 'Endereço salvo. Solicite o link para confirmar.';
  }
  return estado.emailVerificado
    ? 'O endereço atual está confirmado.'
    : 'Cadastre um endereço para habilitar a recuperação de senha.';
}

export default Colaboradores;
