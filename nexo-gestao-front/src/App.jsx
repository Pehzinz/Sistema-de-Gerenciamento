import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './App.css';
const Login = lazy(() => import('./pages/Login'));
const Admin = lazy(() => import('./pages/Admin'));
const Caixa = lazy(() => import('./pages/Caixa'));
const CadastroProduto = lazy(() => import('./pages/CadastroProduto'));
const Colaboradores = lazy(() => import('./pages/Colaboradores'));
const ExcluirProduto = lazy(() => import('./pages/ExcluirProduto'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Agente = lazy(() => import('./pages/Agente'));
const Tendencias = lazy(() => import('./pages/Tendencias'));
const Calendario = lazy(() => import('./pages/Calendario'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));

function ProtectedRoute({ admin = false }) {
  const token = sessionStorage.getItem('token');
  if (!token) return <Navigate to="/" replace />;
  if (admin && sessionStorage.getItem('perfil') !== 'ADMIN') return <Navigate to="/caixa" replace />;
  return <Outlet />;
}

function LoginRoute() {
  // Navegar para a raiz ou usar Voltar não encerra a sessão do totem.
  if (sessionStorage.getItem('token') && sessionStorage.getItem('perfil') === 'COLABORADOR') return <Navigate to="/caixa" replace />;
  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-page" role="status">Carregando…</div>}>
        <Routes>
          <Route path="/" element={<LoginRoute />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/caixa" element={<Caixa />} />
          </Route>
          <Route element={<ProtectedRoute admin />}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/cadastrar-produto" element={<CadastroProduto />} />
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/excluir-produto" element={<ExcluirProduto />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/agente" element={<Agente />} />
            <Route path="/tendencias" element={<Tendencias />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
