import { BASE_URL, apiFetch, readApiError } from './api';

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
