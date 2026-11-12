import { collectNotifications } from './helpers/notifications';
import { test, expect } from '@playwright/test';

async function openRegistration(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cadastre sua Empresa aqui' }).click();
  await page.getByPlaceholder('Nome da Empresa (Fantasia)').fill('Empresa de demonstração');
  await page.getByPlaceholder('CNPJ', { exact: true }).fill('12.345.678/0001-99');
  await page.getByPlaceholder('Seu Nome Completo').fill('Administrador de demonstração');
  await page.getByPlaceholder('Seu CPF', { exact: true }).fill('111.222.333-44');
  await page.getByLabel('E-mail do administrador').fill('admin@example.com');
  await page.getByPlaceholder('Crie uma senha (mín. 6 caracteres)').fill('senha!');
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
    expect(route.request().postDataJSON().emailAdmin).toBe('admin@example.com');
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

test('a user can request a recovery link using CPF, registered email and company CNPJ', async ({ page }) => {
  const token = 'A'.repeat(43);
  await page.route('**/api/recuperar-senha', route => {
    expect(route.request().postDataJSON()).toEqual({
      cpf: '111.222.333-44', cnpj: '12.345.678/0001-99', email: 'usuario@example.com',
    });
    return route.fulfill({ status: 202, json: { mensagem: 'Se os dados corresponderem a uma conta, você receberá um link.' } });
  });
  await page.route('**/api/redefinir-senha', route => {
    expect(route.request().postDataJSON()).toEqual({ token, senha: 'nova12' });
    return route.fulfill({ status: 204 });
  });
  await page.goto('/');
  await page.getByPlaceholder('CPF do Usuário').fill('111.222.333-44');
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await expect(page.getByLabel('Seu CPF')).toHaveValue('111.222.333-44');
  await page.getByLabel('Seu e-mail cadastrado').fill('usuario@example.com');
  await page.getByLabel('CNPJ da empresa').fill('12.345.678/0001-99');
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'receberá um link' })).toBeVisible();

  await page.goto('/recuperar-senha#token=' + token);
  await page.getByLabel('Nova senha (mín. 6 caracteres)').fill('nova12');
  await page.getByLabel('Repita a nova senha').fill('diferente');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'precisam ser iguais' })).toBeVisible();
  await page.getByLabel('Repita a nova senha').fill('nova12');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByText('Senha alterada. Entre com sua nova senha.')).toBeVisible();
});

test('an administrator can change a collaborator password without completing missing profile data', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'admin');
    sessionStorage.setItem('perfil', 'ADMIN');
  });
  await page.route('**/api/usuarios', route => route.fulfill({
    json: [{ id: 42, nomeCompleto: 'Colaborador de teste', cpf: '111.222.333-44', perfil: 'COLABORADOR' }],
  }));
  await page.route('**/api/usuarios/42', route => {
    expect(route.request().method()).toBe('PUT');
    expect(route.request().headers().authorization).toBe('Bearer admin');
    expect(route.request().postDataJSON()).toMatchObject({ nomeCompleto: 'Colaborador de teste', senha: 'nova12', dataNascimento: null });
    return route.fulfill({ json: { mensagem: 'Colaborador atualizado com sucesso!' } });
  });
  await page.route('**/api/usuarios/42/email', route => route.fulfill({
    json: { emailVerificado: null, emailPendente: null, envioDisponivel: true },
  }));
  await page.goto('/colaboradores');
  await page.getByRole('button', { name: 'Editar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Editar Colaborador' });
  await expect(dialogo.getByLabel('Nome e Sobrenome')).toBeFocused();
  await expect(dialogo.getByLabel('E-mail de recuperação')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole('button', { name: 'Editar' })).toBeFocused();
  await page.getByRole('button', { name: 'Editar' }).press('Enter');
  await dialogo.getByLabel('Nova senha (opcional)').fill('nova12');
  await dialogo.getByRole('button', { name: 'Confirmar Edição' }).click();
  await expect(dialogo).toBeHidden();
});

for (const [perfil, botaoCadastro] of [['ADMIN', '+ Administrador'], ['COLABORADOR', '+ Colaborador']]) {
test(`team registration for ${perfil} requires only name, CPF, email and password`, async ({ page }) => {
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
  const botao = page.getByRole('button', { name: botaoCadastro, exact: true });
  const email = page.getByLabel('E-mail', { exact: true });
  await botao.click();
  await expect(email).toBeFocused();
  expect(cadastro).toBeUndefined();
  await email.fill('nova@example.com');
  await botao.click();
  await expect.poll(() => cadastro).toMatchObject({
    perfil, email: 'nova@example.com', nomeCompleto: 'Novo usuário', cpf: '111.222.333-44',
    senha: 'senha!', dataNascimento: null, telefone: '', endereco: '',
  });
  await expect(email).toHaveValue('');
});
}

test('administrator edit displays the recovery email and sends the target account password when changing it', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'admin');
    sessionStorage.setItem('perfil', 'ADMIN');
  });
  await page.route('**/api/login', route => route.fulfill({ json: { perfil: 'ADMIN' } }));
  await page.route('**/api/usuarios', route => route.fulfill({
    json: [{ id: 18, nomeCompleto: 'Administradora', cpf: '111.222.333-44', perfil: 'ADMIN' }],
  }));
  await page.route('**/api/usuarios/18/email', route => route.fulfill({
    json: { emailVerificado: 'atual@example.com', emailPendente: null, envioDisponivel: true },
  }));
  let edicao;
  await page.route('**/api/usuarios/18', route => {
    edicao = route.request().postDataJSON();
    return route.fulfill({ json: { mensagem: 'Dados atualizados com sucesso!' } });
  });
  await page.goto('/colaboradores');
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByPlaceholder('CPF do Administrador').fill('11122233344');
  await page.getByPlaceholder('Senha do Administrador').fill('senha!');
  await page.getByRole('button', { name: 'Autorizar Edição' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Editar Administrador' });
  const email = dialogo.getByLabel('E-mail de recuperação');
  await expect(email).toHaveValue('atual@example.com');
  await email.fill('novo@example.com');
  await dialogo.getByLabel('Senha atual da conta editada').fill('alvo12');
  await dialogo.getByRole('button', { name: 'Confirmar Edição' }).click();
  await expect(dialogo).toBeHidden();
  expect(edicao).toMatchObject({ email: 'novo@example.com', senhaAtual: 'alvo12' });
});
