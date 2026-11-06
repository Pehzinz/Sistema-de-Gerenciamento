export const controleInicial = { tipoEstoque: 'PADRAO', estoque: '', limiteCota: '', intervaloCotaMinutos: '', validadeComercial: '' };

export function controleDoProduto(produto) {
  const data = produto.validadeComercial ? new Date(produto.validadeComercial) : null;
  const local = data ? new Date(data.getTime() - data.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return { ...controleInicial, ...produto, validadeComercial: local };
}

export function payloadControle(dados) {
  return {
    tipoEstoque: dados.tipoEstoque || 'PADRAO',
    estoque: dados.tipoEstoque === 'COTA_TEMPO' ? 0 : (dados.estoque === '' ? null : Number(dados.estoque)),
    limiteCota: dados.tipoEstoque === 'COTA_TEMPO' ? Number(dados.limiteCota) : null,
    intervaloCotaMinutos: dados.tipoEstoque === 'COTA_TEMPO' ? Number(dados.intervaloCotaMinutos) : null,
    validadeComercial: dados.tipoEstoque === 'VALIDADE' && dados.validadeComercial ? new Date(dados.validadeComercial).toISOString() : null,
  };
}

export function indicadorEstoque(produto) {
  if (produto.tipoEstoque === 'COTA_TEMPO') return `Cota: ${produto.quantidadeDisponivel ?? produto.limiteCota}/${produto.limiteCota} a cada ${produto.intervaloCotaMinutos} min`;
  if (produto.tipoEstoque === 'VALIDADE') return `${produto.estoque} un. • ${new Date(produto.validadeComercial).getTime() <= Date.now() ? 'Vencido em' : 'Válido até'} ${new Date(produto.validadeComercial).toLocaleString('pt-BR')}`;
  return `${produto.estoque} un.`;
}

