import { useNotificacoes } from '../hooks/useNotificacoes';
import { LabelInput } from '../components/label-input';
import { filtrarVendasPeriodo, descricaoPeriodo, dataHoraGeracao, formatarDataVenda } from '../utils/relatorioVendas';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BASE_URL, readApiError, apiFetch as fetch } from '../services/api';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

function RotuloCategoria({ x, y, payload, larguraRotulo }) {
  const nome = String(payload.value);
  const limite = Math.max(3, Math.min(16, Math.floor(larguraRotulo / 6)));
  const palavras = nome.split(/\s+/).flatMap(p => p.match(new RegExp(`.{1,${limite}}`, 'gu')) || []);
  const linhas = [];
  palavras.forEach(palavra => {
    const ultima = linhas.length - 1;
    if (ultima >= 0 && `${linhas[ultima]} ${palavra}`.length <= limite) linhas[ultima] += ` ${palavra}`;
    else linhas.push(palavra);
  });
  const visiveis = linhas.slice(0, 3);
  if (linhas.length > 3) visiveis[2] = `${visiveis[2].slice(0, limite - 1)}…`;
  return <text x={x} y={y + 12} textAnchor="middle" fill="#666" fontSize={11}>
    <title>{nome}</title>
    {visiveis.map((linha, i) => <tspan key={i} x={x} dy={i ? 14 : 0}>{linha}</tspan>)}
  </text>;
}

function Dashboard() {
  const { notificar } = useNotificacoes();
  const [produtos, setProdutos] = useState([]);
  const [larguraGrafico, setLarguraGrafico] = useState(600);
  const [vendas, setVendas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroDados, setErroDados] = useState('');
  const [hoje, setHoje] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }));
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [dataInicioRelatorio, setDataInicioRelatorio] = useState('');
  const [dataFimRelatorio, setDataFimRelatorio] = useState('');
  const navigate = useNavigate();
  
  const graficosRef = useRef(null);


  const buscarDados = useCallback(async () => {
    const token = sessionStorage.getItem('token');
    if (!token) return navigate('/');

    try {
      const [resProdutos, resVendas] = await Promise.all([
        fetch(BASE_URL + '/api/produtos', { headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store' }),
        fetch(BASE_URL + '/api/vendas', { headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store' })
      ]);
      
      if (!resProdutos.ok) throw new Error(await readApiError(resProdutos, 'Erro ao carregar estoque'));
      if (!resVendas.ok) throw new Error(await readApiError(resVendas, 'Erro ao carregar vendas'));
      const [dadosProdutos, dadosVendas] = await Promise.all([resProdutos.json(), resVendas.json()]);
      setProdutos(dadosProdutos);
      setVendas(dadosVendas);
      setErroDados('');
      setHoje(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }));
    } catch (erro) {
      setErroDados(erro.message || 'Erro de conexão ao carregar o Dashboard.');
    } finally {
        setCarregando(false);
    }
  }, [navigate]);

  useEffect(() => {
    let ativo = true;
    Promise.resolve().then(() => { if (ativo) void buscarDados(); });
    const atualizarAoRetornar = () => {
      if (document.visibilityState !== 'hidden') void buscarDados();
    };
    window.addEventListener('focus', atualizarAoRetornar);
    document.addEventListener('visibilitychange', atualizarAoRetornar);
    return () => {
      ativo = false;
      window.removeEventListener('focus', atualizarAoRetornar);
      document.removeEventListener('visibilitychange', atualizarAoRetornar);
    };
  }, [buscarDados]);



  const erroPeriodo = dataInicioRelatorio && dataFimRelatorio && dataInicioRelatorio > dataFimRelatorio
    ? 'A data inicial deve ser anterior ou igual à data final.'
    : (dataInicioRelatorio > hoje || dataFimRelatorio > hoje ? 'O período não pode ultrapassar a data de hoje.' : '');
  const vendasRelatorio = filtrarVendasPeriodo(vendas, dataInicioRelatorio, dataFimRelatorio, hoje);
  const periodoRelatorio = descricaoPeriodo(dataInicioRelatorio, dataFimRelatorio, hoje);
  const faturamentoRelatorio = vendasRelatorio.reduce((acc, venda) => acc + (venda.total || 0), 0);

  const gerarBalancoPDF = async () => {
    if (gerandoPdf || erroPeriodo) return;
    setGerandoPdf(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const dataAtual = dataHoraGeracao();

      doc.setFontSize(22);
      doc.setTextColor(142, 68, 173);
      doc.text('Relatório Contábil e Histórico de Vendas', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const nomeEmpresa = localStorage.getItem('empresaNome') || 'Nexo Gestão';
      doc.text(`Empresa: ${nomeEmpresa} | Documento gerado em: ${dataAtual}`, 14, 28);

      doc.text(`Período: ${periodoRelatorio} (datas inclusivas)`, 14, 34);
      const faturamentoTotal = faturamentoRelatorio;
      const totalPedidos = vendasRelatorio.length;
      
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text(`Faturamento Bruto: R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`, 14, 44);
      doc.text(`Total de Transações: ${totalPedidos}`, 14, 50);

      let startY = 61;
      if (graficosRef.current) {
        const canvas = await html2canvas(graficosRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const escala = Math.min(260 / canvas.width, 120 / canvas.height);
        const imgWidth = canvas.width * escala;
        const imgHeight = canvas.height * escala;
        
        doc.addImage(imgData, 'PNG', 14, startY, imgWidth, imgHeight);
        startY += imgHeight + 15;
      }

      if (startY > 170) { doc.addPage(); startY = 25; }
      doc.setFontSize(14);
      doc.setTextColor(142, 68, 173);
      doc.text('Livro Razão - Detalhamento de Transações', 14, startY - 5);

      const colunas = ['Data/Hora', 'ID', 'Forma Pag.', 'Produtos Vendidos (Qtd | Nome | Valor)', 'Total (R$)'];
      
      const linhas = vendasRelatorio.map(v => {
        const dataVenda = formatarDataVenda(v.dataVenda);
        const itensDaVenda = v.itens || [];
        
        let detalhesProdutos = '';
        itensDaVenda.forEach(item => {
            // Lê diretamente do VendaResponseDTO gerado pelo Java
            const produtoNome = item.nomeProduto || item.produto?.nome || 'Falha ao identificar produto'; 
            const precoCobrado = item.precoUnitario || 0;
            const qtd = item.quantidade || 0;
            
            // Adicionado o formato exato solicitado: "1x Controle PS5"
            detalhesProdutos += `${qtd}x ${produtoNome} - R$ ${precoCobrado.toFixed(2).replace('.', ',')} un.\n`;
        });

        if (detalhesProdutos === '') detalhesProdutos = 'Nenhum produto processado nesta venda';

        return [
          dataVenda,
          `#${v.id || '-'}`,
          (v.formaPagamento || 'N/A').replace('_', ' '), 
          detalhesProdutos.trim(), 
          (v.total || 0).toFixed(2).replace('.', ',')
        ];
      });

      autoTable(doc, {
        startY: startY,
        head: [colunas],
        body: linhas,
        theme: 'grid',
        headStyles: { fillColor: [142, 68, 173] },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 
            3: { cellWidth: 130 } 
        },
        alternateRowStyles: { fillColor: [249, 245, 250] }
      });

      if (!linhas.length) {
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text('Nenhuma venda encontrada neste período.', 14, (doc.lastAutoTable?.finalY || startY) + 10);
      }
      doc.save(dataInicioRelatorio || dataFimRelatorio
        ? `Relatorio_Contabil_Nexo_${dataInicioRelatorio || 'inicio'}_a_${dataFimRelatorio || hoje}.pdf`
        : 'Relatorio_Contabil_Nexo.pdf');
    } catch (erro) {
      console.error('Erro ao gerar o relatório:', erro);
      notificar('Ocorreu um erro ao processar o PDF.', { tipo: 'erro' });
    } finally {
      setGerandoPdf(false);
    }
  };

  const ofertasAtivas = produtos.filter(p => 
    p.precoPromocional && p.dataInicioPromocao && p.dataFimPromocao && 
    hoje >= p.dataInicioPromocao && hoje <= p.dataFimPromocao
  ).length;

  const totalProdutosCadastrados = produtos.length;
  const valorTotalEstoque = produtos.reduce((acc, p) => acc + (p.preco * p.estoque), 0);
  const produtosEstoqueBaixo = produtos.filter(p => p.tipoEstoque !== 'COTA_TEMPO' && p.estoque > 0 && p.estoque <= 5).length;
  const produtosEsgotados = produtos.filter(p => p.tipoEstoque !== 'COTA_TEMPO' && p.estoque === 0).length;

  const contagemCategorias = produtos.reduce((acc, p) => {
    const nomeCat = p.categoria?.nome?.trim() || 'Categoria não informada';
    acc[nomeCat] = (acc[nomeCat] || 0) + 1;
    return acc;
  }, {});
  
  const dadosGraficoPizza = Object.keys(contagemCategorias).map(chave => ({
    name: chave,
    quantidade: contagemCategorias[chave]
  }));

  const receitaPorCategoria = new Map();
  vendasRelatorio.forEach(venda => {
      const listaItens = venda.itens || [];
      listaItens.forEach(item => {
      const idDoProduto = item.produtoId || item.produto?.id;
      const produtoReferencia = produtos.find(p => String(p.id) === String(idDoProduto));
      
      const nomeCat = item.nomeCategoria?.trim() || produtoReferencia?.categoria?.nome?.trim()
        || item.produto?.categoria?.nome?.trim() || 'Categoria não informada';

      const valorSubtotal = item.subtotal || (item.quantidade * (item.precoUnitario || 0)) || 0;
      receitaPorCategoria.set(nomeCat, (receitaPorCategoria.get(nomeCat) || 0) + valorSubtotal);
      });
  });

  const dadosGraficoBarras = Array.from(receitaPorCategoria, ([name, receita]) => ({
      name,
      receita
  }));

  const CORES = ['#8e44ad', '#3498db', '#2ecc71', '#f1c40f', '#e74c3c'];

  if (carregando) return <div style={{ padding: '50px', textAlign: 'center' }}>A carregar métricas...</div>;
  if (erroDados) return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif' }}>
      <Navbar />
      <main className="app-main" style={{ padding: '40px' }}>
        <h1>Dashboard Analítico</h1>
        <p role="alert">Não foi possível atualizar os dados. {erroDados}</p>
        <button type="button" onClick={buscarDados} style={{ padding: '12px 20px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Tentar novamente</button>
      </main>
    </div>
  );


  return (
    <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      <main className="app-main" style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Visão Geral
              </div>
              <h1 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Dashboard Analítico</h1>
            </div>
            
            <div className="button-group" style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={buscarDados} disabled={gerandoPdf} style={{ padding: '12px 20px', backgroundColor: '#f9f5fa', color: '#8e44ad', border: '1px solid #e0c3fc', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Atualizar Dashboard</button>
            <button 
              onClick={gerarBalancoPDF} 
              disabled={gerandoPdf || !!erroPeriodo}
              style={{ 
                padding: '12px 24px', backgroundColor: gerandoPdf ? '#ccc' : '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: gerandoPdf ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(142,68,173,0.3)', transition: 'background 0.3s ease' 
              }}>
              {gerandoPdf ? 'A processar documento...' : '📄 Baixar Relatório Contábil'}
            </button>
            </div>
          </div>

          <section aria-label="Período do relatório contábil" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0c3fc' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '16px', color: '#71358b' }}>Período do relatório contábil</h2>
            <div className="responsive-row" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}><LabelInput label="Data inicial" type="date" max={hoje} value={dataInicioRelatorio} disabled={gerandoPdf} onChange={e => setDataInicioRelatorio(e.target.value)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px', width: '100%' }} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}><LabelInput label="Data final" type="date" max={hoje} value={dataFimRelatorio} disabled={gerandoPdf} onChange={e => setDataFimRelatorio(e.target.value)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px', width: '100%' }} /></div>
              <button type="button" disabled={gerandoPdf} onClick={() => { setDataInicioRelatorio(''); setDataFimRelatorio(''); }} style={{ padding: '10px 16px', border: '1px solid #e0c3fc', borderRadius: '6px', color: '#71358b', backgroundColor: '#fcf9ff' }}>Todo o histórico</button>
            </div>
            <p style={{ marginBottom: '8px', fontSize: '13px', color: '#666' }}>Sem datas, o PDF inclui todo o histórico até hoje. Você também pode preencher apenas o início ou o fim. O dia final é incluído por completo.</p>
            {erroPeriodo ? <p role="alert" style={{ color: '#b91c1c', marginBottom: 0 }}>{erroPeriodo}</p> : <p role="status" style={{ marginBottom: 0, color: '#555' }}>
              {periodoRelatorio} · {vendasRelatorio.length} venda(s) · Faturamento: R$ {faturamentoRelatorio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {vendasRelatorio.length === 0 && ' · Nenhuma venda encontrada neste período.'}
            </p>}
          </section>

          <div className="responsive-row" style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderLeft: '5px solid #2ecc71' }}>
              <div style={{ fontSize: '13px', color: '#888', fontWeight: 'bold', marginBottom: '10px' }}>VALOR TOTAL EM ESTOQUE</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderLeft: '5px solid #3498db' }}>
              <div style={{ fontSize: '13px', color: '#888', fontWeight: 'bold', marginBottom: '10px' }}>PRODUTOS REGISTADOS</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>{totalProdutosCadastrados}</div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderLeft: '5px solid #f1c40f' }}>
              <div style={{ fontSize: '13px', color: '#888', fontWeight: 'bold', marginBottom: '10px' }}>ESTOQUE BAIXO (≤ 5)</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f39c12' }}>{produtosEstoqueBaixo}</div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderLeft: '5px solid #e74c3c' }}>
              <div style={{ fontSize: '13px', color: '#888', fontWeight: 'bold', marginBottom: '10px' }}>PRODUTOS ESGOTADOS</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#e74c3c' }}>{produtosEsgotados}</div>
            </div>

            <div style={{ backgroundColor: '#fff5f5', padding: '20px', borderRadius: '15px', border: '1px solid #ffb8b8', flex: 1, minWidth: '150px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#d63031', fontSize: '14px', textTransform: 'uppercase' }}>🏷️ Ofertas Ativas</h3>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>{ofertasAtivas}</span>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#d63031' }}>Produtos com desconto hoje</p>
            </div>
          </div>

          <div ref={graficosRef} style={{ display: 'flex', gap: '20px', marginTop: '10px', backgroundColor: '#f4f7f6', padding: '10px', borderRadius: '15px' }}>
            <div style={{ flex: 2, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '5px' }}>Receita por Categoria (R$)</h3>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px', marginTop: 0 }}>Receita das vendas no período selecionado</p>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" onResize={largura => setLarguraGrafico(largura)}>
                  <BarChart data={dadosGraficoBarras} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" interval={0} height={62} tick={<RotuloCategoria larguraRotulo={(larguraGrafico - 50) / Math.max(1, dadosGraficoBarras.length) - 6} />} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: '#fcf9ff'}} 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'}} 
                      formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                    <Bar dataKey="receita" fill="#2ecc71" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '5px' }}>Volume do Catálogo</h3>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px', marginTop: 0 }}>Quantidade de produtos registados atualmente</p>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosGraficoPizza} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="quantidade" isAnimationActive={false}>
                      {dadosGraficoPizza.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
