// Fallback de segurança para quando a variável de ambiente falhar em produção
export const BASE_URL = import.meta.env.VITE_API_URL || 'https://sistema-de-gerenciamento-production-9d42.up.railway.app' || 'http://localhost:8080';
