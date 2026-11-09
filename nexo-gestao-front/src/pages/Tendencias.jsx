import { useState, useEffect, useCallback } from 'react';
import { BASE_URL, readApiError, apiFetch as fetch } from '../services/api';
import AnaliseMargens from '../components/AnaliseMargens';
import AnaliseCatalogo from '../components/AnaliseCatalogo';
import Navbar from '../components/Navbar';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

function Tendencias() {
  const [carregando, setCarregando] = useState(false);
  const [erroDados, setErroDados] = useState('');
  const [dadosProntos, setDadosProntos] = useState(false);
  const [margens, setMargens] = useState(null);
  const [catalogoMargens, setCatalogoMargens] = useState(null);
  const [erroCatalogo, setErroCatalogo] = useState('');

  const [produtosReais, setProdutosReais] = useState([]);
  const [ticketMedioReal, setTicketMedioReal] = useState(0);
  const [faturamentoReal, setFaturamentoReal] = useState(0);
  
  const [dadosPrevisao, setDadosPrevisao] = useState([]);
  const [curvaABC, setCurvaABC] = useState([]);
  const [fluxoCaixa, setFluxoCaixa] = useState([]);
  const [dadosHorarios, setDadosHorarios] = useState([]);
  
  // NOVOS ESTADOS DOS INSIGHTS
  const [produtoAltaTendencia, setProdutoAltaTendencia] = useState("Calculando...");
  const [produtoParado, setProdutoParado] = useState("Calculando...");

  const buscarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const headers = { Authorization: `Bearer ${sessionStorage.getItem('token')}` };
      const paths = ['/api/produtos', '/api/vendas', '/api/tendencias/previsao-vendas', '/api/tendencias/curva-fluxo', '/api/tendencias/trafego'];
      const [results, catalogo] = await Promise.all([Promise.all(paths.map(async path => {
        const response = await fetch(BASE_URL + path, { headers, cache: 'no-store' });
        if (!response.ok) throw new Error(await readApiError(response, 'Não foi possível carregar a análise'));
        return response.json();
      })), (async () => {
        try {
          const resposta = await fetch(BASE_URL + '/api/tendencias/margens-catalogo', { headers, cache: 'no-store' });
          if (!resposta.ok) throw new Error(await readApiError(resposta, 'A API não confirmou suporte à análise do catálogo'));
          const dados = await resposta.json();
          if (dados?.versao !== 1 || !Array.isArray(dados.produtos)) throw new Error('A API conectada ainda não oferece esta versão da análise de margens.');
          return { dados, erro: '' };
        } catch (erro) { return { dados: null, erro: erro.message || 'Falha de conexão ao consultar custos.' }; }
      })()]);
      const [produtos, vendas, previsao, curva, trafego] = results;
      setProdutosReais(produtos);
      const total = vendas.reduce((acc, venda) => acc + (venda.total || 0), 0);
      setFaturamentoReal(total); setTicketMedioReal(vendas.length ? total / vendas.length : 0);
      setDadosPrevisao(previsao); setCurvaABC(curva.curva); setFluxoCaixa(curva.fluxo);
      setProdutoAltaTendencia(curva.produtoAltaTendencia); setProdutoParado(curva.produtoParado);
      setDadosHorarios(trafego.grafico);
      setMargens(curva.margens ?? null);
      setCatalogoMargens(catalogo.dados);
      setErroCatalogo(catalogo.erro);
      setDadosProntos(true);
      setErroDados('');
    } catch (error) { setErroDados(error.message || 'Erro de conexão ao carregar a análise.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => {
    let ativo = true;
    Promise.resolve().then(() => { if (ativo) void buscarDados(); });
    return () => { ativo = false; };
  }, [buscarDados]);

  return (
    <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}><Navbar /></div>
      <main className="app-main" style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '40px' }}>
          
          <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>Análise de vendas e margens</div>
              <h1 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Centro de Inteligência de Mercado</h1>
            </div>
            <button type="button" onClick={buscarDados} disabled={carregando} style={{ padding: '12px 24px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(142,68,173,0.3)' }}>
              {carregando ? '⏳ Sincronizando...' : 'Atualizar Análise Completa'}
            </button>
          </div>

          {erroDados ? <p role="alert">Não foi possível atualizar os dados. {erroDados} Use “Atualizar Análise Completa” para tentar novamente.</p> : !dadosProntos ? <p role="status">Carregando análise...</p> : <>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Dados da sua empresa · Todo o histórico de vendas registrado no sistema.</p>
          <div className="responsive-row" style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', borderLeft: '5px solid #2ecc71', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', marginBottom: '5px' }}>FATURAMENTO REAL (BRUTO)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{faturamentoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', borderLeft: '5px solid #e74c3c', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', marginBottom: '5px' }}>PRODUTOS NO CATÁLOGO</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{produtosReais.length}</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', borderLeft: '5px solid #3498db', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', marginBottom: '5px' }}>TICKET MÉDIO REAL</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{ticketMedioReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
          </div>

          <div className="responsive-row" style={{ display: 'flex', gap: '20px' }}>
            <div className="responsive-row" style={{ flex: 1, backgroundColor: '#fcf9ff', padding: '25px', borderRadius: '15px', border: '1px solid #e0c3fc', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '35px' }}>🚀</div>
              <div>
                <div style={{ fontSize: '12px', color: '#8e44ad', fontWeight: 'bold', marginBottom: '5px' }}>PRODUTO COM MAIOR RECEITA</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{produtoAltaTendencia}</div>
                <p style={{ fontSize: '13px', color: '#555', margin: '5px 0 0 0' }}>Maior faturamento acumulado. Receita alta não significa maior lucro.</p>
              </div>
            </div>
            <div className="responsive-row" style={{ flex: 1, backgroundColor: '#fff5f5', padding: '25px', borderRadius: '15px', border: '1px solid #ffcccc', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '35px' }}>📉</div>
              <div>
                <div style={{ fontSize: '12px', color: '#c0392b', fontWeight: 'bold', marginBottom: '5px' }}>MENOR RECEITA ENTRE PRODUTOS VENDIDOS</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{produtoParado}</div>
                <p style={{ fontSize: '13px', color: '#555', margin: '5px 0 0 0' }}>Confira giro, preço e margem antes de decidir uma promoção.</p>
              </div>
            </div>
          </div>

          <div className="responsive-row" style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '5px' }}>Faturamento real por semana</h3>
              <p style={{ fontSize: 12, color: '#666' }}>Total das vendas registradas em cada semana com movimento. Não representa lucro nem saldo em caixa. A semana atual pode estar incompleta.</p>
              <div style={{ height: '250px', width: '100%' }}>
                {fluxoCaixa.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fluxoCaixa} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <XAxis dataKey="mes" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 11, fill: '#888'}} axisLine={false} tickLine={false} tickFormatter={v => Number(v).toLocaleString('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL', maximumFractionDigits: 1 })}/>
                      <Tooltip formatter={value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                      <Bar name="Faturamento" dataKey="receitas" fill="#2ecc71" radius={[4, 4, 0, 0]} maxBarSize={70} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: 'center', color: '#888', paddingTop: '80px' }}>Sem dados de vendas</div>}
              </div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '5px' }}>Projeção Financeira (Regressão Linear)</h3>
              <p style={{ fontSize: 12, color: '#666' }}>Estimativa de faturamento, não é receita garantida. Exige ao menos dois períodos distintos com vendas e pode variar com promoções e sazonalidade.</p>
              <div style={{ height: '250px', width: '100%' }}>
                {dadosPrevisao.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosPrevisao} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <XAxis dataKey="periodo" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 11, fill: '#888'}} axisLine={false} tickLine={false} tickFormatter={v => Number(v).toLocaleString('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL', maximumFractionDigits: 1 })}/>
                      <Tooltip cursor={{fill: '#fcf9ff'}} formatter={(value) => value ? [Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), ''] : ['-', '']} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                      <Line type="monotone" name="Realizado" dataKey="realizado" stroke="#2ecc71" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" name="Projeção linear" dataKey="previsto" stroke="#8e44ad" strokeWidth={3} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: 'center', color: '#888', paddingTop: '80px' }}>Ainda não há histórico de vendas para projetar.</div>}
              </div>
            </div>
          </div>

          <AnaliseCatalogo dados={catalogoMargens} erro={erroCatalogo} />
          <AnaliseMargens dados={margens} />
          <div className="responsive-row" style={{ display: 'flex', gap: '20px' }}>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '15px' }}>Análise de Curva ABC Real</h3>
                <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
                  <div style={{ height: '140px', width: '40%' }}>
                    {curvaABC.length > 0 && curvaABC[0].value > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={curvaABC} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" nameKey="name">
                            {curvaABC.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div style={{textAlign: 'center', color: '#888', paddingTop:'50px'}}>Sem vendas</div>}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {curvaABC.map(item => (
                      <div key={item.name} style={{ backgroundColor: '#f9f9f9', padding: '8px 12px', borderRadius: '8px', borderLeft: `4px solid ${item.color}` }}>
                        <div style={{ fontSize: '13px', color: '#333', fontWeight: 'bold' }}>{item.name}: {item.value}%</div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Ex: {item.produtos}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '15px' }}>Tráfego por Dia da Semana</h3>
              <div style={{ height: '220px', width: '100%' }}>
                {dadosHorarios.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosHorarios} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                      <XAxis dataKey="hora" tick={{fontSize: 11, fill: '#888'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 11, fill: '#888'}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#fcf9ff'}} />
                      <Bar dataKey="vendas" fill="#3498db" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: 'center', color: '#888', paddingTop: '80px' }}>Sem dados</div>}
              </div>
            </div>
          </div>
          </>}
        </div>
      </main>
    </div>
  );
}

export default Tendencias;
