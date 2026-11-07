import { useEffect } from 'react';

// A tela consulta o servidor na virada da janela; não cria saldo localmente.
export default function useAtualizacaoCotas(produtos, atualizar) {
  const configuracao = JSON.stringify(produtos.filter(p => p?.tipoEstoque === 'COTA_TEMPO')
    .map(p => [p.id, p.inicioJanelaCota, p.intervaloCotaMinutos]));

  useEffect(() => {
    const cotas = JSON.parse(configuracao);
    if (!cotas.length) return;
    let encerrado = false;
    let consultando = false;
    const proximaVirada = agora => Math.min(...cotas.map(([, inicio, minutos]) => {
      const ancora = new Date(inicio).getTime();
      const periodo = minutos * 60000;
      if (!inicio || !Number.isFinite(ancora) || !Number.isFinite(periodo) || periodo <= 0) return Infinity;
      return ancora + Math.max(1, Math.floor((agora - ancora) / periodo) + 1) * periodo;
    }));
    let virada = proximaVirada(Date.now());
    let consultaPeriodica = Date.now() + 30000;
    const consultar = async () => {
      if (encerrado || consultando || document.visibilityState === 'hidden') return;
      consultando = true;
      try { await atualizar(); }
      catch (erro) { console.error('Erro ao atualizar cotas', erro); }
      finally { consultando = false; }
    };
    const aoRetornar = () => {
      virada = proximaVirada(Date.now());
      consultaPeriodica = Date.now() + 30000;
      void consultar();
    };
    const intervalo = setInterval(() => {
      const agora = Date.now();
      if (agora >= virada || agora >= consultaPeriodica) {
        virada = proximaVirada(agora);
        consultaPeriodica = agora + 30000;
        void consultar();
      }
    }, 1000);
    window.addEventListener('focus', aoRetornar);
    document.addEventListener('visibilitychange', aoRetornar);
    return () => {
      encerrado = true;
      clearInterval(intervalo);
      window.removeEventListener('focus', aoRetornar);
      document.removeEventListener('visibilitychange', aoRetornar);
    };
  }, [configuracao, atualizar]);
}
