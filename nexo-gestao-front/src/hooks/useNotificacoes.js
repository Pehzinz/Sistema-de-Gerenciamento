import { createContext, useContext } from 'react';

export const ContextoNotificacoes = createContext(null);

export function useNotificacoes() {
  const contexto = useContext(ContextoNotificacoes);
  if (!contexto) throw new Error('Notificações precisam de NotificacoesProvider.');
  return contexto;
}
