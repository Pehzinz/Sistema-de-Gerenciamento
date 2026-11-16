const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });

export function diaEmSaoPaulo(agora = Date.now()) {
  return formatoDia.format(agora);
}

export function periodoPromocao({ precoPromocional, dataInicioPromocao, dataFimPromocao }) {
  if (!precoPromocional || !dataInicioPromocao || !dataFimPromocao) return null;
  const inicio = String(dataInicioPromocao).split('T')[0];
  const fim = String(dataFimPromocao).split('T')[0];
  return inicio <= fim ? { inicio, fim } : null;
}

export function promocaoAtiva(produto, dia = diaEmSaoPaulo()) {
  const periodo = periodoPromocao(produto);
  return periodo !== null && periodo.inicio <= dia && dia <= periodo.fim;
}
