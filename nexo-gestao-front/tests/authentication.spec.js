import { collectNotifications } from './helpers/notifications';
import { test, expect } from '@playwright/test';

async function openRegistration(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cadastre sua Empresa aqui' }).click();
  await page.getByPlaceholder('Nome da Empresa (Fantasia)').fill('Empresa de demonstração');
  await page.getByPlaceholder('CNPJ', { exact: true }).fill('12.345.678/0001-99');
  await page.getByPlaceholder('Seu Nome Completo').fill('Administrador de demonstração');
  await page.getByPlaceholder('Seu CPF', { exact: true }).fill('111.222.333-44');
  await page.getByPlaceholder('Crie uma senha (mín. 6 caracteres)').fill('senha!');
}

async function mockAutorizacaoEdicao(page, id, email = null) {
  await page.route(`**/api/usuarios/${id}/autorizar-edicao`, route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers().authorization).toBe('Bearer admin');
    expect(route.request().postDataJSON()).toEqual({ senha: 'senha!' });
    return route.fulfill({ json: { autorizacaoEdicao: 'edicao-autorizada', email } });
  });
}

async function autorizarEdicao(page) {
  const dialogo = page.getByRole('dialog', { name: 'Autorizar edição' });
  await dialogo.getByLabel('Sua senha de administrador').fill('senha!');
  await dialogo.getByRole('button', { name: 'Autorizar edição' }).click();
}

for (const scenario of [
  { status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Não foi possível acessar o banco de dados.' }), expected: 'banco de dados' },
  { status: 401, contentType: 'text/plain', body: '', expected: 'HTTP 401' },
  { status: 502, contentType: 'text/html', body: '<html>Bad Gateway</html>', expected: 'HTTP 502' },
]) {
  test(`registration distinguishes HTTP ${scenario.status} from a network failure`, async ({ page }) => {
    await page.route('**/api/registro', route => route.fulfill(scenario));
    const messages = await collectNotifications(page);
    await openRegistration(page);
    await page.getByRole('button', { name: 'Concluir Cadastro' }).click();
    await expect.poll(() => messages.at(-1)).toContain(scenario.expected);
    expect(messages.at(-1)).not.toContain('Erro de conexão');
    expect(messages.at(-1)).not.toContain('<html>');
  });
}

test('new company registration binds the next login to its CNPJ and clears the previous session', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('token', 'old-session'));
  let loginPayload;
  await page.route('**/api/registro', route => {
    expect(route.request().postDataJSON()).not.toHaveProperty('emailAdmin');
    return route.fulfill({ status: 201, json: { mensagem: 'Cadastro concluído.' } });
  });
  await page.route('**/api/login', route => {
    loginPayload = route.request().postDataJSON();
    return route.fulfill({ status: 401, json: { erro: 'Credenciais fictícias de teste.' } });
  });

  await openRegistration(page);
  await page.getByRole('button', { name: 'Concluir Cadastro' }).click();
  await expect(page.getByPlaceholder('CPF do Usuário')).toHaveValue('111.222.333-44');
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('cnpj'))).toBe('12.345.678/0001-99');
  await page.getByPlaceholder('Senha', { exact: true }).fill('senha-forte-teste-123');
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect.poll(() => loginPayload?.cnpj).toBe('12.345.678/0001-99');
});

test('login displays a database failure instead of blaming the password', async ({ page }) => {
  await page.route('**/api/login', route => route.fulfill({ status: 503,
    json: { erro: 'Não foi possível acessar o banco de dados.' } }));
  const messages = await collectNotifications(page);
  await page.goto('/');
  await page.getByPlaceholder('CPF do Usuário').fill('111.222.333-44');
  await page.getByPlaceholder('Senha', { exact: true }).fill('senha-forte-teste-123');
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect.poll(() => messages.at(-1)).toContain('banco de dados');
  expect(messages.at(-1)).not.toContain('CPF ou senha incorretos');
});

test('login no longer offers recovery by email', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Entrar no Sistema' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toHaveCount(0);
});

test('an administrator can change a collaborator password without completing missing profile data', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'admin');
    sessionStorage.setItem('perfil', 'ADMIN');
  });
  await page.route('**/api/usuarios', route => route.fulfill({
    json: [{ id: 42, nomeCompleto: 'Colaborador de teste', cpf: '111.222.333-44', perfil: 'COLABORADOR' }],
  }));
  await mockAutorizacaoEdicao(page, 42);
  await page.route('**/api/usuarios/42', route => {
    expect(route.request().method()).toBe('PUT');
    expect(route.request().headers().authorization).toBe('Bearer admin');
    expect(route.request().postDataJSON()).toMatchObject({
      nomeCompleto: 'Colaborador de teste', senha: 'nova12', dataNascimento: null, autorizacaoEdicao: 'edicao-autorizada',
    });
    return route.fulfill({ json: { mensagem: 'Colaborador atualizado com sucesso!' } });
  });
  await page.goto('/colaboradores');
  await page.getByRole('button', { name: 'Editar' }).click();
  await autorizarEdicao(page);
  const dialogo = page.getByRole('dialog', { name: 'Editar Colaborador' });
  await expect(dialogo.getByLabel('Nome e Sobrenome')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole('button', { name: 'Editar' })).toBeFocused();
  await page.getByRole('button', { name: 'Editar' }).press('Enter');
  await autorizarEdicao(page);
  await dialogo.getByRole('button', { name: 'Alterar senha' }).click();
  await dialogo.getByLabel('Nova senha').fill('nova12');
  await dialogo.getByRole('button', { name: 'Confirmar Edição' }).click();
  await expect(dialogo).toBeHidden();
});

for (const [perfil, botaoCadastro, email] of [
  ['ADMIN', '+ Administrador', 'admin@example.com'],
  ['COLABORADOR', '+ Colaborador', ''],
]) {
test(`team registration for ${perfil} accepts an optional contact email`, async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'admin');
    sessionStorage.setItem('perfil', 'ADMIN');
  });
  let cadastro;
  await page.route('**/api/usuarios', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] });
    cadastro = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: 18 } });
  });
  await page.goto('/colaboradores');
  await page.getByLabel('Nome e Sobrenome').fill('Novo usuário');
  await page.getByLabel('CPF', { exact: true }).fill('111.222.333-44');
  await page.getByLabel('Senha de Acesso').fill('senha!');
  const campoEmail = page.getByLabel('E-mail de contato (opcional)');
  await campoEmail.fill(email);
  const botao = page.getByRole('button', { name: botaoCadastro, exact: true });
  await botao.click();
  await expect.poll(() => cadastro).toMatchObject({
    perfil, nomeCompleto: 'Novo usuário', cpf: '111.222.333-44',
    senha: 'senha!', dataNascimento: null, telefone: '', endereco: '',
    ...(email && { email }),
  });
  if (!email) expect(cadastro).not.toHaveProperty('email');
  await expect(campoEmail).toHaveValue('');
  await expect(page.getByLabel('Nome e Sobrenome')).toHaveValue('');
});
}

test('administrator can edit the contact email after authorization without changing the password', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'admin');
    sessionStorage.setItem('perfil', 'ADMIN');
  });
  await mockAutorizacaoEdicao(page, 18, 'anterior@example.com');
  await page.route('**/api/usuarios', route => route.fulfill({
    json: [{ id: 18, nomeCompleto: 'Administradora', cpf: '111.222.333-44', perfil: 'ADMIN' }],
  }));
  let edicao;
  await page.route('**/api/usuarios/18', route => {
    edicao = route.request().postDataJSON();
    return route.fulfill({ json: { mensagem: 'Dados atualizados com sucesso!' } });
  });
  await page.goto('/colaboradores');
  await page.getByRole('button', { name: 'Editar' }).click();
  await autorizarEdicao(page);
  const dialogo = page.getByRole('dialog', { name: 'Editar Administrador' });
  const campoEmail = dialogo.getByLabel('E-mail de contato (opcional)');
  await expect(campoEmail).toHaveValue('anterior@example.com');
  await campoEmail.fill('novo@example.com');
  await expect(dialogo.locator('input[type="password"]')).toHaveCount(0);
  await dialogo.getByRole('button', { name: 'Confirmar Edição' }).click();
  await expect(dialogo).toBeHidden();
  expect(edicao).toMatchObject({ nomeCompleto: 'Administradora', email: 'novo@example.com', autorizacaoEdicao: 'edicao-autorizada' });
  expect(edicao).not.toHaveProperty('senha');
  expect(edicao).not.toHaveProperty('senhaAtual');
});
