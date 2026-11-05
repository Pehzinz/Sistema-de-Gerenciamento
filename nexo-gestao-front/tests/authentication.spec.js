import { test, expect } from '@playwright/test';

async function openRegistration(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cadastre sua Empresa aqui' }).click();
  await page.getByPlaceholder('Nome da Empresa (Fantasia)').fill('Empresa de demonstração');
  await page.getByPlaceholder('CNPJ', { exact: true }).fill('12.345.678/0001-99');
  await page.getByPlaceholder('Seu Nome Completo').fill('Administrador de demonstração');
  await page.getByPlaceholder('Seu CPF', { exact: true }).fill('111.222.333-44');
  await page.getByPlaceholder('Crie uma senha (mín. 12 caracteres)').fill('senha-forte-teste-123');
}

for (const scenario of [
  { status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Não foi possível acessar o banco de dados.' }), expected: 'banco de dados' },
  { status: 401, contentType: 'text/plain', body: '', expected: 'HTTP 401' },
  { status: 502, contentType: 'text/html', body: '<html>Bad Gateway</html>', expected: 'HTTP 502' },
]) {
  test(`registration distinguishes HTTP ${scenario.status} from a network failure`, async ({ page }) => {
    await page.route('**/api/registro', route => route.fulfill(scenario));
    const messages = [];
    page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.dismiss(); });
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
  await page.route('**/api/registro', route => route.fulfill({ status: 201, json: { mensagem: 'Cadastro concluído.' } }));
  await page.route('**/api/login', route => {
    loginPayload = route.request().postDataJSON();
    return route.fulfill({ status: 401, json: { erro: 'Credenciais fictícias de teste.' } });
  });
  page.on('dialog', dialog => dialog.dismiss());
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
  const messages = [];
  page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.dismiss(); });
  await page.goto('/');
  await page.getByPlaceholder('CPF do Usuário').fill('111.222.333-44');
  await page.getByPlaceholder('Senha', { exact: true }).fill('senha-forte-teste-123');
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect.poll(() => messages.at(-1)).toContain('banco de dados');
  expect(messages.at(-1)).not.toContain('CPF ou senha incorretos');
});
