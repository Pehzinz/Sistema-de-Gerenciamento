import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const datas = ['2026-10-06T23:59:59', '2026-10-07T00:00:00', '2026-10-14T23:59:59.999', '2026-10-15T00:00:00', '2026-10-15T02:59:59Z', '2026-11-07T00:00:00', null];
const totais = [1, 10, 20, 40, 30, 100, 5];
const nomes = ['ProdAntesPeriodo', 'ProdInicioPeriodo', 'ProdFimPeriodo', 'ProdDepoisPeriodo', 'ProdFusoPeriodo', 'ProdFuturoPeriodo', 'ProdSemDataPeriodo'];
const vendas = datas.map((dataVenda, i) => ({ id: i + 1, dataVenda, total: totais[i], formaPagamento: 'PIX',
  itens: [{ produtoId: '1234567890', nomeProduto: nomes[i], quantidade: 1, precoUnitario: totais[i] }] }));

test.use({ timezoneId: 'UTC' });
async function abrir(page) {
  await page.clock.install({ time: new Date('2026-11-06T15:00:00Z') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'test-token'); sessionStorage.setItem('perfil', 'ADMIN');
    localStorage.setItem('empresaNome', 'Loja de teste');
  });
  await page.route('**/api/**', route => {
    const caminho = new URL(route.request().url()).pathname;
    return route.fulfill({ json: caminho === '/api/vendas' ? vendas : caminho === '/api/produtos'
      ? [{ id: '1234567890', nome: 'Produto', preco: 10, estoque: 5, categoria: { nome: 'Doces' } }] : [] });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard Analítico' })).toBeVisible();
}
async function baixar(page, testInfo) {
  const promessa = page.waitForEvent('download');
  await page.getByRole('button', { name: /Baixar Relatório Contábil/ }).click();
  const download = await promessa;
  const destino = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(destino);
  return { nome: download.suggestedFilename(), texto: (await readFile(destino)).toString('latin1') };
}

test('PDF por período inclui os dois dias completos e calcula totais e gráfico correspondentes', async ({ page }, testInfo) => {
  await abrir(page);
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-10-07');
  await page.getByLabel('Data final', { exact: true }).fill('2026-10-14');
  await expect(page.getByRole('status')).toContainText('3 venda(s)');
  await expect(page.getByRole('status')).toContainText('60,00');
  const pdf = await baixar(page, testInfo);
  expect(pdf.nome).toBe('Relatorio_Contabil_Nexo_2026-10-07_a_2026-10-14.pdf');
  expect(pdf.texto).toContain('Faturamento Bruto: R$ 60,00');
  expect(pdf.texto).toContain('07/10/2026'); expect(pdf.texto).toContain('14/10/2026');
  expect(pdf.texto.match(/14\/10\/2026, 23:59:59/g)).toHaveLength(2);
  for (const indice of [1, 2, 4]) expect(pdf.texto).toContain(nomes[indice]);
  for (const indice of [0, 3, 5, 6]) expect(pdf.texto).not.toContain(nomes[indice]);
});

test('sem datas baixa todo o histórico até hoje e limpar as datas restaura o período completo', async ({ page }, testInfo) => {
  await abrir(page);
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-10-07');
  await page.getByRole('button', { name: 'Todo o histórico', exact: true }).click();
  await expect(page.getByLabel('Data inicial', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Data final', { exact: true })).toHaveValue('');
  await expect(page.getByRole('status')).toContainText('6 venda(s)');
  await expect(page.getByRole('status')).toContainText('106,00');
  const pdf = await baixar(page, testInfo);
  expect(pdf.nome).toBe('Relatorio_Contabil_Nexo.pdf');
  expect(pdf.texto).toContain('Faturamento Bruto: R$ 106,00');
  expect(pdf.texto).toContain('ProdAntesPeriodo'); expect(pdf.texto).toContain('ProdSemDataPeriodo');
  expect(pdf.texto).not.toContain('ProdFuturoPeriodo');
});

test('um único dia inclui horários até 23h59 e período sem vendas gera relatório com total zero', async ({ page }, testInfo) => {
  await abrir(page);
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-10-14');
  await page.getByLabel('Data final', { exact: true }).fill('2026-10-14');
  await expect(page.getByRole('status')).toContainText('2 venda(s)');
  await expect(page.getByRole('status')).toContainText('50,00');
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-10-20');
  await page.getByLabel('Data final', { exact: true }).fill('2026-10-21');
  await expect(page.getByRole('status')).toContainText('Nenhuma venda encontrada');
  const pdf = await baixar(page, testInfo);
  expect(pdf.texto).toContain('Faturamento Bruto: R$ 0,00');
  expect(pdf.texto).not.toContain('ProdInicioPeriodo');
});

test('datas parciais funcionam e datas invertidas ou futuras impedem download', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-10-07');
  await expect(page.getByRole('status')).toContainText('100,00');
  await page.getByLabel('Data inicial', { exact: true }).fill('');
  await page.getByLabel('Data final', { exact: true }).fill('2026-10-07');
  await expect(page.getByRole('status')).toContainText('11,00');
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-10-14');
  await expect(page.getByRole('alert')).toContainText('anterior ou igual');
  await expect(page.getByRole('button', { name: /Baixar Relatório Contábil/ })).toBeDisabled();
  await page.getByLabel('Data final', { exact: true }).fill('2026-11-07');
  await expect(page.getByRole('alert')).toContainText('data de hoje');
  await expect(page.getByRole('button', { name: /Baixar Relatório Contábil/ })).toBeDisabled();
});
