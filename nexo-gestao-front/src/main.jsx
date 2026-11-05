import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apaga credenciais persistentes da versão anterior; o novo login dura apenas a sessão da aba.
['token', 'perfil', 'nome'].forEach(key => localStorage.removeItem(key));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
