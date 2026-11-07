const fuso = 'America/Sao_Paulo';

export function diaVenda(dataVenda) {
  if (!dataVenda) return null;
  const texto = String(dataVenda);
  // A API atual devolve LocalDateTime sem fuso: preserva a data registrada.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(texto)) return /^\d{4}-\d{2}-\d{2}(T|$)/.test(texto) ? texto.slice(0, 10) : null;
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data.toLocaleDateString('en-CA', { timeZone: fuso });
}

export function filtrarVendasPeriodo(vendas, inicio, fim, hoje) {
  const limiteFinal = fim || hoje;
  return vendas.filter(venda => {
    const dia = diaVenda(venda.dataVenda);
    // Mantém registros legados sem data no histórico completo.
    if (!dia) return !inicio && !fim;
    return (!inicio || dia >= inicio) && dia <= limiteFinal;
  });
}

export function descricaoPeriodo(inicio, fim, hoje) {
  const formatar = dia => dia.split('-').reverse().join('/');
  return `${inicio ? formatar(inicio) : 'Início do histórico'} até ${formatar(fim || hoje)}`;
}

export function dataHoraGeracao() {
  return new Date().toLocaleString('pt-BR', { timeZone: fuso });
}

export function formatarDataVenda(dataVenda) {
  if (!dataVenda) return 'Data não registrada';
  const texto = String(dataVenda);
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(texto)) {
    const data = new Date(texto);
    return Number.isNaN(data.getTime()) ? 'Data não registrada' : data.toLocaleString('pt-BR', { timeZone: fuso });
  }
  const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}, ${partes[4]}` : 'Data não registrada';
}
