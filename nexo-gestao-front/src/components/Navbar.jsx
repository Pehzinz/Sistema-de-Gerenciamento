import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

function MenuItem({ to, icon, label, onNavigate }) {
    const active = useLocation().pathname === to;
    
    return (
      <Link to={to} onClick={onNavigate} aria-current={active ? 'page' : undefined} style={{
        display: 'flex', 
        alignItems: 'center', 
        padding: '12px 15px', 
        marginBottom: '10px',
        backgroundColor: active ? '#f9f5fa' : 'transparent', // Fundo roxo clarinho se ativo
        borderRadius: '12px',
        textDecoration: 'none',
        color: active ? '#333' : '#666',
        fontWeight: active ? 'bold' : '500',
        transition: 'all 0.2s ease'
      }}>
        {/* Quadrado do Ícone */}
        <div style={{
          width: '35px', 
          height: '35px', 
          borderRadius: '10px',
          backgroundColor: active ? '#8e44ad' : '#f3e8ff', // Roxo forte se ativo, claro se inativo
          color: active ? 'white' : '#8e44ad',
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          marginRight: '15px',
          boxShadow: active ? '0 4px 10px rgba(142, 68, 173, 0.3)' : 'none'
        }}>
          {icon}
        </div>
        {label}
      </Link>
    );
  };


function Navbar() {
  const [menuAberto, setMenuAberto] = useState(false);

  const nomeUsuario = sessionStorage.getItem('nome') || 'Usuário';
  const perfil = sessionStorage.getItem('perfil');

  const getIniciais = (nome) => {
    if (!nome) return 'US';
    const partes = nome.trim().split(' ').filter(p => p.length > 0);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0].substring(0, 2).toUpperCase();
  };

  // Função para fazer logout
  const handleLogout = () => {
      // Remove apenas a identidade do funcionário (simula o fim do turno)
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('perfil');
      sessionStorage.removeItem('nome');

      // Redireciona para o login (o navegador vai usar o CNPJ mantido para carregar a empresa correta)
      window.location.href = '/';
  };


  return (
    <nav className={`sidebar ${menuAberto ? 'is-open' : ''}`} aria-label="Menu principal" style={{
      width: '280px', 
      height: '100vh', 
      backgroundColor: '#ffffff', 
      display: 'flex', 
      flexDirection: 'column', 
      padding: '25px', 
      boxSizing: 'border-box',
      borderRight: '1px solid #f0f0f0',
      fontFamily: 'sans-serif'
    }}>
      
      {/* LOGO */}
      <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ 
          width: '45px', height: '45px', backgroundColor: '#8e44ad', borderRadius: '12px', 
          display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', marginRight: '15px',
          boxShadow: '0 4px 12px rgba(142, 68, 173, 0.4)'
        }}>
          {/* Ícone improvisado do Nexo (Três camadas) */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 12 12 17 22 12"></polyline>
            <polyline points="2 17 12 22 22 17"></polyline>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#2d3436', letterSpacing: '-0.5px' }}>nexo</h1>
          <span style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>GESTÃO DE PRODUTOS</span>
        </div>
        <button className="menu-toggle" type="button" aria-expanded={menuAberto} aria-controls="navigation-links" onClick={() => setMenuAberto(!menuAberto)}>
          {menuAberto ? '✕ Fechar' : '☰ Menu'}
        </button>
      </div>

      <div className="sidebar-caption" style={{ fontSize: '11px', fontWeight: 'bold', color: '#aaa', letterSpacing: '0.5px', marginBottom: '15px', marginLeft: '5px' }}>
        SEU CATÁLOGO
      </div>

      {/* LINKS DO MENU (DINÂMICOS POR PERFIL) */}
      <div id="navigation-links" className="sidebar-links" style={{ flex: 1 }}>
        {perfil === 'ADMIN' ? (
          <>
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/cadastrar-produto" label="Cadastrar produto" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><line x1="12" y1="22" x2="12" y2="12"></line><line x1="12" y1="12" x2="22.5" y2="6"></line><line x1="12" y1="12" x2="1.5" y2="6"></line></svg>
            } />
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/admin" label="Visualizar Estoque" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            } />
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/excluir-produto" label="Excluir produto" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            } />
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/agente" label="Agente" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>
            } />
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/colaboradores" label="Colaboradores" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            } />
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/caixa" label="Caixa PDV" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            } />
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/dashboard" label="Dashboard" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            } />
            {/* CORREÇÃO: Ícone e Texto da aba Tendências/Inteligência */}
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/tendencias" label="Inteligência" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            } />
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/calendario" label="Calendário" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            } />
            {/* NOVO MENU: CONFIGURAÇÕES DA EMPRESA */}
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/configuracoes" label="Configurações" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            } />
          </>
        ) : (
          /* MENU PARA COLABORADOR */
          <>
            <MenuItem onNavigate={() => setMenuAberto(false)} to="/caixa" label="Caixa PDV" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            } />
          </>
        )}
      </div>


      {/* PERFIL DINÂMICO DO USUÁRIO LOGADO */}
      <div className="sidebar-profile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 5px', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          
          {/* Círculo com Iniciais Automáticas (ex: "Marina Silva" -> "MS") */}
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '50%', 
            backgroundColor: '#f3e8ff', 
            color: '#8e44ad', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            fontWeight: 'bold', 
            fontSize: '14px', 
            marginRight: '12px',
            flexShrink: 0
          }}>
            {getIniciais(nomeUsuario)}
          </div>

          {/* Nome e Cargo do Usuário Logado */}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nomeUsuario}
            </div>
            <div style={{ fontSize: '11px', color: '#888' }}>
              {perfil === 'ADMIN' ? 'Administrador' : 'Colaborador'}
            </div>
          </div>
        </div>
        
        {/* Botão de Logout */}
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', flexShrink: 0 }} title="Sair do Sistema">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
      
    </nav>
  );
}

export default Navbar;
