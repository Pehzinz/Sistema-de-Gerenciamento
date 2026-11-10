export function calcularVariacao(atual, anterior) {
  if (typeof atual !== 'number' || !Number.isFinite(atual) || typeof anterior !== 'number' || !Number.isFinite(anterior)) return null;
  if (anterior === 0) return atual === 0 ? 0 : null;
  const variacao = (atual - anterior) / Math.abs(anterior);
  return Number.isFinite(variacao) ? variacao : null;
}

export function prepararProjecao(pontos) {
  return pontos.map((ponto, indice) => {
    const anterior = pontos[indice - 1];
    const basePrevisto = anterior?.previsto ?? anterior?.realizado;
    return {
      ...ponto,
      periodoAnterior: anterior?.periodo,
      baseRealizado: anterior?.realizado,
      basePrevisto,
      variacaoRealizado: calcularVariacao(ponto.realizado, anterior?.realizado),
      variacaoPrevisto: calcularVariacao(ponto.previsto, basePrevisto),
    };
  });
}
