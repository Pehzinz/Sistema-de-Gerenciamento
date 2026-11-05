// src/services/api.js
// Endereço do back-end:
//  1) Se existir a variável VITE_API_URL (definida no build), usa ela.
//  2) No seu PC (npm run dev), usa o back-end local.
//  3) Na versão publicada, se a variável não chegar no build, usa o endereço de produção abaixo.
const BACKEND_PRODUCAO = 'https://sistema-de-gerenciamento-production-9d42.up.railway.app';

export const BASE_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8080' : BACKEND_PRODUCAO)
).replace(/\/+$/, '');

// Algumas falhas do proxy/servidor chegam sem JSON. Isso não é uma falha de rede do navegador.
export async function readApiError(response, fallback) {
  const body = await response.json().catch(() => null);
  if (body && typeof body.erro === 'string' && body.erro.trim()) return body.erro;
  if (response.status >= 500) return `O servidor está temporariamente indisponível (HTTP ${response.status}). Tente novamente em instantes.`;
  if (response.status === 429) return 'Muitas tentativas. Aguarde um minuto e tente novamente.';
  return `${fallback} (HTTP ${response.status}).`;
}

export async function apiFetch(input, options) {
  const response = await globalThis.fetch(input, options);
  if (typeof input === 'string' && input.startsWith(BASE_URL + '/api/')
      && !input.endsWith('/login') && !input.endsWith('/registro') && response.status === 401) {
    ['token', 'perfil', 'nome'].forEach(key => sessionStorage.removeItem(key));
    window.location.assign('/');
  }
  return response;
}
