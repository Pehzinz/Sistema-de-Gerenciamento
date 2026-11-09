import { test, expect } from '@playwright/test';
const routes = ['/', '/admin', '/caixa', '/cadastrar-produto', '/colaboradores', '/excluir-produto', '/dashboard', '/agente', '/tendencias', '/calendario', '/configuracoes'];
const product = { id: '1234567890', nome: 'Produto com nome longo para testar quebra de texto', marca: 'Nexo', preco: 10, estoque: 5, ativo: true, categoria: { id: 1, nome: 'Categoria' } };
async function seed(page, role = 'ADMIN') {
  await page.addInitScript(role => {
    sessionStorage.setItem('token', 'test-token'); sessionStorage.setItem('perfil', role);
    sessionStorage.setItem('nome', 'Administrador de Testes');
    localStorage.setItem('empresaNome', 'Empresa de testes'); localStorage.setItem('cnpj', '00.000.000/0001-00');
  }, role);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path === '/api/produtos') data = [product];
    else if (path.startsWith('/api/produtos/')) data = product;
    else if (path === '/api/categorias') data = [{ id: 1, nome: 'Categoria' }];
    else if (path === '/api/usuarios') data = [{ id: 1, nomeCompleto: 'Administrador de Testes', perfil: 'ADMIN', cpf: '000.000.000-00' }];
    else if (path === '/api/empresas/minha-empresa') data = { id: 1, nome: 'Empresa de testes', cnpj: '00.000.000/0001-00', email: '', telefone: '', endereco: '' };
    else if (path === '/api/vendas') data = [{ id: 1, total: 10, formaPagamento: 'PIX', dataVenda: '2026-11-05T12:00:00', itens: [{ produtoId: '1234567890', nomeProduto: product.nome, quantidade: 1, precoUnitario: 10, precoOriginalProduto: 10 }] }];
    else if (path.endsWith('/curva-fluxo')) data = { curva: [{ name: 'Curva A', value: 100, color: '#2ecc71', produtos: 'Produto' }], fluxo: [{ mes: 'Sem 1', receitas: 10, despesas: 6 }], produtoAltaTendencia: 'Produto', produtoParado: 'Outro' };
    else if (path.endsWith('/trafego')) data = { grafico: [{ hora: 'Seg', vendas: 1 }] };
    else if (path.endsWith('/previsao-vendas')) data = [{ periodo: 'Hoje', realizado: 10, previsto: 11 }];
    await route.fulfill({ json: data });
  });
  await page.route('https://brasilapi.com.br/**', route => route.fulfill({ json: [] }));
}
async function fits(page) {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth,
    main: document.querySelector('main')?.getBoundingClientRect().toJSON(), mainScroll: document.querySelector('main')?.scrollWidth, mainWidth: document.querySelector('main')?.clientWidth }));
  expect(sizes.page, JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.viewport + 1);
  if (sizes.main) expect(sizes.mainScroll).toBeLessThanOrEqual(sizes.mainWidth + 1);
  if (sizes.main) expect(sizes.main.right).toBeLessThanOrEqual(sizes.viewport + 1);
}
for (const width of [320, 390, 768, 1024, 1440]) {
  for (const path of routes) test(`${width}px ${path}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await seed(page);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(path);
    await expect(page.locator(path === '/' ? '.login-card' : 'main')).toBeVisible();
    await expect(page.getByText('Carregando…', { exact: true })).toHaveCount(0);
    if (path === '/tendencias' || path === '/dashboard') await expect(page.getByRole('heading').first()).toBeVisible();
    await fits(page); expect(errors).toEqual([]);
    if (width === 390 && ['/admin', '/calendario', '/cadastrar-produto'].includes(path)) {
      await page.screenshot({ path: `test-results/mobile-${path.slice(1)}.png`, fullPage: true });
    }
  });
}
test('collaborator creation buttons fit the form on a narrow screen with larger text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await seed(page);
  await page.goto('/colaboradores');
  const admin = page.getByRole('button', { name: '+ Administrador', exact: true });
  const collaborator = page.getByRole('button', { name: '+ Colaborador', exact: true });
  await expect(admin).toBeVisible();
  await admin.locator('..').screenshot({ path: 'test-results/collaborator-actions.png' });
  await page.addStyleTag({ content: 'main form .button-group > button { font-size: 18px; }' });
  await expect(admin).toHaveCSS('white-space', 'nowrap');
  await expect(collaborator).toHaveCSS('white-space', 'nowrap');
  const form = await admin.locator('xpath=ancestor::form').boundingBox();
  const first = await admin.boundingBox();
  const second = await collaborator.boundingBox();
  for (const button of [first, second]) {
    expect(button.x).toBeGreaterThanOrEqual(form.x);
    expect(button.x + button.width).toBeLessThanOrEqual(form.x + form.width + 1);
  }
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
  await fits(page);
  await page.screenshot({ path: 'test-results/mobile-colaboradores.png', fullPage: true });
});

test('mobile menu opens, navigates and closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seed(page); await page.goto('/admin');
  const menu = page.getByRole('button', { name: '☰ Menu' }); await menu.click();
  await expect(page.getByRole('button', { name: '✕ Fechar' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Calendário' }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false'); await fits(page);
});

test('collaborator creation actions are centered within the desktop form', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page); await page.goto('/colaboradores');
  const button = page.getByRole('button', { name: '+ Administrador', exact: true });
  const form = await button.locator('xpath=ancestor::form').boundingBox();
  const actions = await page.locator('.collaborator-create-actions').boundingBox();
  expect(Math.abs((actions.x + actions.width / 2) - (form.x + form.width / 2))).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/centered-collaborator-actions.png' });
});

test('product fields share the same height and top edge on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page); await page.goto('/cadastrar-produto');
  const price = await page.getByLabel('Valor do Produto (R$) *', { exact: true }).boundingBox();
  const cost = await page.getByLabel('Custo unitário (R$) — opcional', { exact: true }).boundingBox();
  expect(Math.abs(price.y - cost.y)).toBeLessThanOrEqual(1);
  expect(price.height).toBe(cost.height);
  const type = page.getByRole('combobox', { name: 'Tipo de controle' });
  for (const [value, name] of [['PADRAO', 'Estoque Inicial'], ['COTA_TEMPO', 'Limite de vendas por intervalo'], ['VALIDADE', 'Validade comercial (horário local)']]) {
    await type.selectOption(value);
    const select = await type.boundingBox();
    const input = await page.getByLabel(name, { exact: true }).boundingBox();
    expect(Math.abs(select.y - input.y)).toBeLessThanOrEqual(1);
    expect(select.height).toBe(input.height);
  }
  await page.getByLabel('Custo unitário (R$) — opcional', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/aligned-product-fields.png' });
});

test('stock column filters retain their compact dimensions', async ({ page }) => {
  await seed(page); await page.goto('/admin');
  await expect(page.getByRole('button', { name: '✕ Limpar Filtros', exact: true })).toBeHidden();
  for (const name of ['Filtrar por marca', 'Filtrar por categoria', 'Tipo de Estoque']) {
    const filter = await page.getByRole('combobox', { name, exact: true }).boundingBox();
    expect(filter.height).toBeLessThanOrEqual(24);
    expect(filter.width).toBeLessThanOrEqual(24);
  }
});

test('sidebar collapses to icons, keeps navigation and remembers the preference', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page); await page.goto('/admin');
  const before = await page.locator('main').boundingBox();
  await page.getByRole('button', { name: 'Recolher barra lateral', exact: true }).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '76px');
  await expect(page.locator('.menu-item-label').first()).toBeHidden();
  const after = await page.locator('main').boundingBox();
  expect(after.width).toBeGreaterThan(before.width);
  await page.screenshot({ path: 'test-results/collapsed-sidebar.png' });
  await page.getByRole('link', { name: 'Configurações', exact: true }).click();
  await expect(page).toHaveURL(/\/configuracoes$/);
  await expect(page.locator('.sidebar')).toHaveCSS('width', '76px');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expandir barra lateral', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '☰ Menu', exact: true }).click();
  await expect(page.locator('.menu-item-label').first()).toBeVisible();
  await fits(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Expandir barra lateral', exact: true }).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '252px');
});
test('mobile calendar modal stays inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await seed(page); await page.goto('/calendario');
  await page.getByRole('button', { name: '+ Novo evento' }).click();
  const modal = page.locator('.modal-overlay > div'); await expect(modal).toBeVisible();
  const box = await modal.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(321);
  await fits(page); await page.screenshot({ path: 'test-results/mobile-modal.png', fullPage: true });
});
test('collaborator is redirected away from admin screens', async ({ page }) => {
  await seed(page, 'COLABORADOR'); await page.goto('/configuracoes'); await expect(page).toHaveURL(/\/caixa$/);
});
test('anonymous user is redirected to login', async ({ page }) => {
  await page.goto('/admin'); await expect(page).toHaveURL('http://127.0.0.1:5173/');
});

test('agent quick queries return server data and preserve the AI conversation', async ({ page }) => {
  await seed(page);
  await page.route('**/api/agente/consultas/estoque', route => route.fulfill({ json: { resposta: 'Estoque confirmado: 7 unidades.' } }));
  await page.route('**/api/agente/perguntar', route => route.fulfill({ json: { resposta: 'Análise da IA disponível.' } }));
  await page.goto('/agente');
  await page.getByRole('button', { name: '📦 Estoque', exact: true }).click();
  await expect(page.getByText('Estoque confirmado: 7 unidades.')).toBeVisible();
  await page.getByRole('textbox').fill('Como melhorar as vendas?');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Análise da IA disponível.')).toBeVisible();
});

test('agent routes typed commands to quick queries without calling AI', async ({ page }) => {
  await seed(page);
  let consultas = 0;
  let chamadasIa = 0;
  await page.route('**/api/agente/consultas/estoque', async route => {
    consultas++;
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: { resposta: 'Estoque confirmado: 7 unidades.' } });
  });
  await page.route('**/api/agente/perguntar', async route => {
    chamadasIa++;
    await route.fulfill({ json: { resposta: 'Não deveria chamar IA para comandos.' } });
  });
  await page.goto('/agente');
  await page.getByRole('textbox').fill(' /ESTOQUE ');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Estoque confirmado: 7 unidades.')).toBeVisible();
  expect(consultas).toBe(1); expect(chamadasIa).toBe(0);
});

test('agent explains when the backend does not support quick queries', async ({ page }) => {
  await seed(page);
  await page.route('**/api/agente/consultas/estoque', route => route.fulfill({ status: 404, json: {} }));
  await page.goto('/agente');
  await page.getByRole('button', { name: '📦 Estoque', exact: true }).click();
  await expect(page.getByText('Esta consulta não está disponível no servidor.', { exact: false })).toBeVisible();
});

test('product photo uses signed upload in the configured Cloudinary account', async ({ page }) => {
  await seed(page);
  const params = { folder: 'nexo/1', public_id: 'photo-test', timestamp: '1793894400', allowed_formats: 'jpg,png,webp', overwrite: 'false' };
  await page.route('**/api/uploads/assinatura', route => route.fulfill({ json: {
    cloudName: 'new-test-cloud', apiKey: 'public-test-key', signature: 'test-signature', params,
  } }));
  let uploaded = false;
  await page.route('https://api.cloudinary.com/**', async route => {
    expect(route.request().url()).toBe('https://api.cloudinary.com/v1_1/new-test-cloud/image/upload');
    const body = route.request().postDataBuffer().toString('utf8');
    for (const [key, value] of Object.entries({ ...params, api_key: 'public-test-key', signature: 'test-signature' })) {
      expect(body).toContain(`name="${key}"`); expect(body).toContain(value);
    }
    expect(body).not.toContain('api_secret'); expect(body).not.toContain('upload_preset');
    uploaded = true;
    await route.fulfill({ json: { secure_url: 'https://res.cloudinary.com/new-test-cloud/image/upload/photo-test.png' } });
  });
  await page.goto('/cadastrar-produto');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByAltText('Preview')).toHaveAttribute('src', /new-test-cloud/);
  expect(uploaded).toBe(true);
});

test('photo upload reports missing backend configuration without calling Cloudinary', async ({ page }) => {
  await seed(page);
  await page.route('**/api/uploads/assinatura', route => route.fulfill({ status: 503,
    json: { erro: 'O upload de imagens ainda não foi configurado pelo administrador.' } }));
  let calls = 0;
  await page.route('https://api.cloudinary.com/**', route => { calls++; return route.abort(); });
  await page.goto('/cadastrar-produto');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('image-test') });
  await expect(page.locator('[data-notification-message]')).toContainText('não foi configurado');
  expect(calls).toBe(0);
});
