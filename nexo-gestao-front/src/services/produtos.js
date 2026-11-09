import { BASE_URL, apiFetch, readApiError } from './api';

export function lerCustoUnitario(texto) {
  const valor = String(texto ?? '').trim().replace(',', '.');
  if (!valor) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(valor) || !Number.isFinite(Number(valor)) || Number(valor) > 9999999999.99) {
    throw new Error('Informe um custo de zero a 9.999.999.999,99, com até duas casas decimais, ou deixe em branco.');
  }
  return Number(valor);
}

export async function garantirSuporteCustos(token) {
  const resposta = await apiFetch(BASE_URL + '/api/produtos/recursos', {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  const recursos = resposta.ok ? await resposta.json() : null;
  if (recursos?.versaoCustosProdutos !== 1) throw new Error('Atualize o back-end antes de salvar custos de produtos. Os dados do formulário foram mantidos.');
}

export function validarCustoPersistido(produto, esperado) {
  if (esperado != null && (produto.custoUnitario == null || Number(produto.custoUnitario) !== esperado)
      || esperado == null && produto.custoUnitario != null) {
    throw new Error('O servidor não confirmou a gravação do custo. Recarregue o produto e confira os dados antes de continuar.');
  }
}

export const API_ESTOQUE_DESATUALIZADA = 'O servidor ainda não confirmou suporte a cota de tempo e validade comercial. Atualize o back-end no Railway antes de salvar. Os dados do formulário foram mantidos.';

export async function garantirSuporteControleEstoque(token) {
  const resposta = await apiFetch(BASE_URL + '/api/produtos/recursos', {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (resposta.status === 401 || resposta.status === 403 || resposta.status >= 500) {
    throw new Error(await readApiError(resposta, API_ESTOQUE_DESATUALIZADA));
  }
  const recursos = resposta.ok ? await resposta.json() : null;
  if (recursos?.versaoControleEstoque !== 1) throw new Error(API_ESTOQUE_DESATUALIZADA);
}

export function validarControlePersistido(produto, esperado) {
  if (produto.tipoEstoque !== esperado.tipoEstoque
      || (esperado.tipoEstoque === 'COTA_TEMPO' && (produto.limiteCota !== esperado.limiteCota
          || produto.intervaloCotaMinutos !== esperado.intervaloCotaMinutos))
      || (esperado.tipoEstoque === 'VALIDADE' && new Date(produto.validadeComercial).getTime() !== new Date(esperado.validadeComercial).getTime())) {
    throw new Error('O servidor não confirmou a gravação do controle de estoque. Confira o deploy do back-end e recarregue o produto antes de tentar novamente.');
  }
}
