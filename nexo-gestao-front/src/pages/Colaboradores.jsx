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
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  
  const [modalAberto, setModalAberto] = useState(false);
  const [colaboradorParaRemover, setColaboradorParaRemover] = useState(null);

  const navigate = useNavigate();
  const [dataHoje] = useState(() => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }));

  // --- ESTADOS PARA A EDIÇÃO DE COLABORADOR ---
  const [colaboradorEditando, setColaboradorEditando] = useState(null);
  const dialogoEdicao = useRef(null);
  const inputNomeEdicao = useRef(null);
  const pedidoAutorizacao = useRef(null);
  const [autorizacaoEdicao, setAutorizacaoEdicao] = useState('');
  const [autorizandoEdicao, setAutorizandoEdicao] = useState(false);
  const [erroAutorizacao, setErroAutorizacao] = useState('');
  const [senhaAdminEdit, setSenhaAdminEdit] = useState('');

  // Campos do Formulário de Edição (Sem o CPF!)
  const [nomeEdit, setNomeEdit] = useState('');
  const [senhaEdit, setSenhaEdit] = useState('');
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [dataNascimentoEdit, setDataNascimentoEdit] = useState('');
  const [telefoneEdit, setTelefoneEdit] = useState('');
  const [enderecoEdit, setEnderecoEdit] = useState('');
  const editandoAdmin = colaboradorEditando?.perfil === 'ADMIN';

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
    if (colaboradorEditando && dialogo && !dialogo.open) dialogo.showModal();
  }, [colaboradorEditando]);

  useEffect(() => {
    if (autorizacaoEdicao) inputNomeEdicao.current?.focus();
  }, [autorizacaoEdicao]);

  useEffect(() => () => pedidoAutorizacao.current?.abort(), []);

  const iniciarEdicao = (usuario) => {
    setColaboradorEditando(usuario);
    setSenhaAdminEdit('');
    setErroAutorizacao('');
    setNomeEdit(usuario.nomeCompleto || usuario.nome);
    setSenhaEdit('');
    setAlterandoSenha(false);
    setDataNascimentoEdit(usuario.dataNascimento || '');
    setTelefoneEdit(usuario.telefone || '');
    setEnderecoEdit(usuario.endereco || '');
  };

  const fecharFormularioEdicao = () => {
    pedidoAutorizacao.current?.abort();
    pedidoAutorizacao.current = null;
    dialogoEdicao.current?.close();
    setColaboradorEditando(null);
    setAutorizacaoEdicao('');
    setAutorizandoEdicao(false);
    setSenhaAdminEdit('');
    setSenhaEdit('');
  };

  const autorizarEdicao = async (e) => {
    e.preventDefault();
    if (pedidoAutorizacao.current) return;
    const controller = new AbortController();
    pedidoAutorizacao.current = controller;
    setAutorizandoEdicao(true);
    setErroAutorizacao('');

    try {
      const resposta = await fetch(`${BASE_URL}/api/usuarios/${colaboradorEditando.id}/autorizar-edicao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('token')}`,
        },
        body: JSON.stringify({ senha: senhaAdminEdit }),
        signal: controller.signal,
      });

      if (!resposta.ok) {
        const erro = await readApiError(resposta, 'Não foi possível autorizar a edição');
        if (!controller.signal.aborted) setErroAutorizacao(erro);
        return;
      }
      const dados = await resposta.json();
      if (!controller.signal.aborted) setAutorizacaoEdicao(dados.autorizacaoEdicao);
    } catch {
      if (!controller.signal.aborted) setErroAutorizacao('Erro de conexão ao autorizar a edição.');
    } finally {
      if (pedidoAutorizacao.current === controller) {
        pedidoAutorizacao.current = null;
        setSenhaAdminEdit('');
        setAutorizandoEdicao(false);
      }
    }
  };

  // 3. Envia os dados editados para o Java
  const confirmarEdicao = async (e) => {
    e.preventDefault();
    if (alterandoSenha && !novaSenhaValida(senhaEdit)) {
      notificar(ERRO_NOVA_SENHA, { tipo: 'atencao' });
      return;
    }
    const token = sessionStorage.getItem('token');
    
    const dadosAtualizados = {
      nomeCompleto: nomeEdit,
      dataNascimento: dataNascimentoEdit || null,
      telefone: telefoneEdit,
      endereco: enderecoEdit,
      autorizacaoEdicao,
      ...(alterandoSenha && { senha: senhaEdit }),
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
        const mensagem = alterandoSenha ? 'Senha alterada com sucesso!' : 'Dados atualizados com sucesso!';
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
        notificar('Usuário cadastrado com sucesso!', { tipo: 'sucesso' });
        // Limpa todos os campos
        setNome(''); setCpf(''); setSenha('');
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
              <p style={{ color: '#666', fontSize: '14px' }}>Preencha nome, CPF e senha. Os demais campos são opcionais.</p>
              
              <form onSubmit={cadastrarColaborador} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <LabelInput label="Nome e Sobrenome" type="text" placeholder="Informe o nome e sobrenome" value={nome} onChange={(e) => setNome(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} required />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <LabelInput label="CPF" type="text" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} required />
                </div>

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

      {colaboradorEditando && (
          <dialog ref={dialogoEdicao} className="colaborador-edicao" aria-labelledby="titulo-editar-colaborador"
            onCancel={evento => { evento.preventDefault(); fecharFormularioEdicao(); }}>
          {autorizacaoEdicao ? <>
            <h3 id="titulo-editar-colaborador" style={{ marginTop: 0, color: '#333', fontSize: '22px' }}>
              {editandoAdmin ? 'Editar Administrador' : 'Editar Colaborador'}
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '25px' }}>
              Alterando os dados de <strong>{colaboradorEditando?.nomeCompleto}</strong>. O CPF não pode ser alterado.
            </p>
            
            <form onSubmit={confirmarEdicao} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <LabelInput ref={inputNomeEdicao} label="Nome e Sobrenome" type="text" value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }} required />
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

              <div style={{ display: 'grid', gap: '8px' }}>
                <button type="button" aria-expanded={alterandoSenha} style={{ justifySelf: 'start' }}
                  onClick={() => { setAlterandoSenha(!alterandoSenha); setSenhaEdit(''); }}>
                  {alterandoSenha ? 'Cancelar troca de senha' : 'Alterar senha'}
                </button>
                {alterandoSenha && <LabelInput label="Nova senha" type="password" autoComplete="new-password"
                  minLength={SENHA_MINIMA} maxLength={SENHA_MAX_BYTES} value={senhaEdit}
                  onChange={e => setSenhaEdit(e.target.value)} required />}
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
          </> : <>
            <h3 id="titulo-editar-colaborador" style={{ marginTop: 0, color: '#333', fontSize: '22px' }}>Autorizar edição</h3>
            <p>Confirme sua senha de administrador para editar <strong>{colaboradorEditando.nomeCompleto}</strong>.</p>
            <form onSubmit={autorizarEdicao} style={{ display: 'grid', gap: '15px' }}>
              <LabelInput type="password" label="Sua senha de administrador" autoComplete="current-password"
                maxLength={72} value={senhaAdminEdit} onChange={e => setSenhaAdminEdit(e.target.value)}
                disabled={autorizandoEdicao} required />
              {erroAutorizacao && <p role="alert">{erroAutorizacao}</p>}
              <div className="button-group" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={fecharFormularioEdicao}>Cancelar</button>
                <button type="submit" disabled={autorizandoEdicao} style={{ background: '#8e44ad', color: 'white' }}>
                  {autorizandoEdicao ? 'Autorizando…' : 'Autorizar edição'}
                </button>
              </div>
            </form>
          </>}
          </dialog>
      )}
    </div>
  );
}

export default Colaboradores;
