import { useState, useEffect } from 'react';
import { BASE_URL } from '../services/api';
import Navbar from '../components/Navbar';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';

function Tendencias() {
  const [carregando, setCarregando] = useState(false);

  const [produtosReais, setProdutosReais] = useState([]);
  const [alertasRupturaReais, setAlertasRupturaReais] = useState([]);
  const [ticketMedioReal, setTicketMedioReal] = useState(0);
  const [faturamentoReal, setFaturamentoReal] = useState(0);
  
  const [dadosPrevisao, setDadosPrevisao] = useState([]);
  const [crossSelling, setCrossSelling] = useState([]);
  const [curvaABC, setCurvaABC] = useState([]);
  const [fluxoCaixa, setFluxoCaixa] = useState([]);
  const [dadosHorarios, setDadosHorarios] = useState([]);
  
  // NOVOS ESTADOS DOS INSIGHTS
  const [produtoAltaTendencia, setProdutoAltaTendencia] = useState("Calculando...");
  const [produtoParado, setProdutoParado] = useState("Calculando...");

  useEffect(() => {
    const buscarDados = async () => {
      setCarregando(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      if (token) {
        try {
          const resProdutos = await fetch(BASE_URL + '/api/produtos', { headers });
          if (resProdutos.ok) {
            const dadosProd = await resProdutos.json();
            setProdutosReais(dadosProd);
            setAlertasRupturaReais(dadosProd.filter(p => p.estoque <= 5 && p.ativo !== false).sort((a, b) => a.estoque - b.estoque).slice(0, 4).map(p => ({
              produto: p.nome, estoque: p.estoque, previsaoEsgotar: p.estoque === 0 ? 'Esgotado!' : 'Risco'
            })));
          }

          const resVendas = await fetch(BASE_URL + '/api/vendas', { headers });
          if (resVendas.ok) {
            const dadosVendas = await resVendas.json();
            if (dadosVendas.length > 0) {
              const totalFaturado = dadosVendas.reduce((acc, v) => acc + (v.total || 0), 0);
              setFaturamentoReal(totalFaturado);
              setTicketMedioReal(totalFaturado / dadosVendas.length);
            }
          }

          const resPrevisao = await fetch(BASE_URL + '/api/tendencias/previsao-vendas', { headers });
          if (resPrevisao.ok) setDadosPrevisao(await resPrevisao.json());

          const resCross = await fetch(BASE_URL + '/api/tendencias/cross-selling', { headers });
          if (resCross.ok) setCrossSelling(await resCross.json());

          const resCurva = await fetch(BASE_URL + '/api/tendencias/curva-fluxo', { headers });
          if (resCurva.ok) {
            const dadosCurva = await resCurva.json();
            setCurvaABC(dadosCurva.curva);
            setFluxoCaixa(dadosCurva.fluxo);
            setProdutoAltaTendencia(dadosCurva.produtoAltaTendencia);
            setProdutoParado(dadosCurva.produtoParado);
          }

          const resTrafego = await fetch(BASE_URL + '/api/tendencias/trafego', { headers });
          if (resTrafego.ok) {
            const dadosTrafego = await resTrafego.json();
            setDadosHorarios(dadosTrafego.grafico);
          }

        } catch (e) { console.error("Erro ao buscar dados reais", e); }
      }
      setCarregando(false);
    };
    buscarDados();
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}><Navbar /></div>
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '40px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>Machine Learning & Controladoria</div>
              <h1 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Centro de Inteligência de Mercado</h1>
            </div>
            <button style={{ padding: '12px 24px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(142,68,173,0.3)' }}>
              {carregando ? '⏳ Sincronizando...' : 'Atualizar Análise Completa'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
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

          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, backgroundColor: '#fcf9ff', padding: '25px', borderRadius: '15px', border: '1px solid #e0c3fc', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '35px' }}>🚀</div>
              <div>
                <div style={{ fontSize: '12px', color: '#8e44ad', fontWeight: 'bold', marginBottom: '5px' }}>PRODUTO EM ALTA TENDÊNCIA</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{produtoAltaTendencia}</div>
                <p style={{ fontSize: '13px', color: '#555', margin: '5px 0 0 0' }}>Principal motor de receita (Curva A).</p>
              </div>
            </div>
            <div style={{ flex: 1, backgroundColor: '#fff5f5', padding: '25px', borderRadius: '15px', border: '1px solid #ffcccc', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '35px' }}>📉</div>
              <div>
                <div style={{ fontSize: '12px', color: '#c0392b', fontWeight: 'bold', marginBottom: '5px' }}>OPORTUNIDADE</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{produtoParado}</div>
                <p style={{ fontSize: '13px', color: '#555', margin: '5px 0 0 0' }}>Produto com menor saída. Ideal para promoções.</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '5px' }}>Fluxo de Caixa (DRE Simplificado)</h3>
              <div style={{ height: '250px', width: '100%' }}>
                {fluxoCaixa.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fluxoCaixa} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2ecc71" stopOpacity={0.3}/><stop offset="95%" stopColor="#2ecc71" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e74c3c" stopOpacity={0.3}/><stop offset="95%" stopColor="#e74c3c" stopOpacity={0}/></linearGradient>
                      </defs>
                      <XAxis dataKey="mes" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 11, fill: '#888'}} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}/>
                      <Tooltip cursor={{fill: '#fcf9ff'}} formatter={(value) => [Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), '']} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                      <Area type="monotone" name="Receitas" dataKey="receitas" stroke="#2ecc71" fillOpacity={1} fill="url(#colorRec)" />
                      <Area type="monotone" name="Despesas Sim." dataKey="despesas" stroke="#e74c3c" fillOpacity={1} fill="url(#colorDesp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: 'center', color: '#888', paddingTop: '80px' }}>Sem dados de vendas</div>}
              </div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '5px' }}>Projeção Financeira (Regressão Linear)</h3>
              <div style={{ height: '250px', width: '100%' }}>
                {dadosPrevisao.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosPrevisao} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <XAxis dataKey="periodo" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 11, fill: '#888'}} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}/>
                      <Tooltip cursor={{fill: '#fcf9ff'}} formatter={(value) => value ? [Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), ''] : ['-', '']} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                      <Line type="monotone" name="Realizado" dataKey="realizado" stroke="#2ecc71" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" name="Previsão ML" dataKey="previsto" stroke="#8e44ad" strokeWidth={3} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: 'center', color: '#888', paddingTop: '80px' }}>Realize pelo menos uma venda para traçar a projeção.</div>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ marginTop: 0, color: '#333', fontSize: '16px', marginBottom: '15px' }}>Análise de Curva ABC Real</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
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
        </div>
      </main>
    </div>
  );
}

export default Tendencias;