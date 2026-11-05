import { BASE_URL, apiFetch } from './api';

export async function uploadImage(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      || file.size > 5 * 1024 * 1024) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.');
  }
  const signed = await apiFetch(BASE_URL + '/api/uploads/assinatura', {
    method: 'POST', headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
  });
  const config = await signed.json().catch(() => ({}));
  if (signed.status === 401) throw new Error('Sua sessão expirou. Entre novamente.');
  if (signed.status === 403) throw new Error('Somente administradores podem enviar imagens.');
  if (!signed.ok) throw new Error(config.erro || 'Não foi possível autorizar o upload.');
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', config.apiKey);
  form.append('signature', config.signature);
  Object.entries(config.params).forEach(([key, value]) => form.append(key, value));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
    method: 'POST', body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) {
    throw new Error(`Não foi possível enviar a imagem ao Cloudinary (HTTP ${response.status}). Confira a configuração do serviço e tente novamente.`);
  }
  return data.secure_url;
}
