import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Caixa from './pages/Caixa'; 
import CadastroProduto from './pages/CadastroProduto'; 
import Colaboradores from './pages/Colaboradores';
import ExcluirProduto from './pages/ExcluirProduto';
import Dashboard from './pages/Dashboard';
import Agente from './pages/Agente'; 
import Tendencias from './pages/Tendencias'; // <--- O CULPADO: Faltava importar a nova tela aqui!
import Calendario from './pages/Calendario';
import Configuracoes from './pages/Configuracoes';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/caixa" element={<Caixa />} /> 
        <Route path="/cadastrar-produto" element={<CadastroProduto />} /> 
        <Route path="/colaboradores" element={<Colaboradores/>} />
        <Route path="/excluir-produto" element={<ExcluirProduto/>} /> 
        <Route path="/dashboard" element={<Dashboard/>} />
        <Route path="/agente" element={<Agente/>} />
        <Route path="/tendencias" element={<Tendencias/>} />  
        <Route path="/calendario" element={<Calendario/>} />
        <Route path="/configuracoes" element={<Configuracoes/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;