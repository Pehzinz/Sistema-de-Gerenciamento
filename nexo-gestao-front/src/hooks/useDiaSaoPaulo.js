import { useEffect, useState } from 'react';
import { diaEmSaoPaulo } from '../utils/promocoes';

export default function useDiaSaoPaulo() {
  const [dia, setDia] = useState(diaEmSaoPaulo);

  useEffect(() => {
    const atualizar = () => setDia(diaEmSaoPaulo());
    const intervalo = setInterval(atualizar, 1000);
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, []);

  return dia;
}
