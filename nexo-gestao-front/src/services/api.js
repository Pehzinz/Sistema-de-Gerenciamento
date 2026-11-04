// src/services/api.js
// Aqui ele puxa a variável do Vercel. Se não encontrar (como no seu PC), usa o localhost.
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';