package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.ItemVenda;
import com.nexo.sistema_gestao.model.Venda;
import com.nexo.sistema_gestao.repository.VendaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@Service
public class EstatisticaService {

    @Autowired
    private VendaRepository vendaRepository;

    // --- 1. REGRESSÃO LINEAR (BLINDADA NA MEMÓRIA POR EMPRESA) ---
    @Cacheable(value = "estatisticasRegressao", key = "#empresaId")
    public List<Map<String, Object>> calcularRegressaoLinearVendas(Long empresaId) {
        List<Venda> vendas = vendaRepository.findByEmpresaId(empresaId);
        if (vendas.isEmpty()) return new ArrayList<>();

        Map<String, Double> dadosAgrupados = new LinkedHashMap<>();
        boolean usarDias = false;

        Map<LocalDate, Double> vendasPorSemana = new TreeMap<>();
        for (Venda v : vendas) {
            if (v.getDataVenda() != null && v.getTotal() != null) {
                LocalDate inicioSemana = v.getDataVenda().toLocalDate().with(java.time.DayOfWeek.MONDAY);
                vendasPorSemana.put(inicioSemana, vendasPorSemana.getOrDefault(inicioSemana, 0.0) + v.getTotal().doubleValue());
            }
        }

        if (vendasPorSemana.size() < 2) {
            usarDias = true;
            Map<LocalDate, Double> vendasPorDia = new TreeMap<>();
            for (Venda v : vendas) {
                if (v.getDataVenda() != null && v.getTotal() != null) {
                    LocalDate dia = v.getDataVenda().toLocalDate();
                    vendasPorDia.put(dia, vendasPorDia.getOrDefault(dia, 0.0) + v.getTotal().doubleValue());
                }
            }
            for (Map.Entry<LocalDate, Double> entry : vendasPorDia.entrySet()) {
                dadosAgrupados.put(entry.getKey().getDayOfMonth() + "/" + entry.getKey().getMonthValue() + "/" + entry.getKey().getYear(), entry.getValue());
            }
        } else {
            for (Map.Entry<LocalDate, Double> entry : vendasPorSemana.entrySet()) {
                dadosAgrupados.put("Sem " + entry.getKey().getDayOfMonth() + "/" + entry.getKey().getMonthValue() + "/" + entry.getKey().getYear(), entry.getValue());
            }
        }

        int n = dadosAgrupados.size();
        double somaX = 0, somaY = 0, somaXY = 0, somaX2 = 0;
        int x = 1;
        List<Map<String, Object>> resultado = new ArrayList<>();
        Double ultimaVendaReal = 0.0;

        for (Map.Entry<String, Double> entry : dadosAgrupados.entrySet()) {
            double y = entry.getValue();
            somaX += x; somaY += y; somaXY += x * y; somaX2 += x * x;
            
            Map<String, Object> ponto = new HashMap<>();
            ponto.put("periodo", entry.getKey());
            ponto.put("realizado", y);
            ponto.put("previsto", null);
            resultado.add(ponto);
            ultimaVendaReal = y;
            x++;
        }

        double denom = (n * somaX2 - somaX * somaX);
        double m = (denom == 0) ? 0 : (n * somaXY - somaX * somaY) / denom;
        double b = (somaY - m * somaX) / n;

        // Um único período não sustenta uma tendência; não inventa um período anterior.
        if (n < 2) return resultado;
        resultado.get(resultado.size() - 1).put("previsto", ultimaVendaReal);

        for (int i = 1; i <= 2; i++) {
            double yPrevisto = Math.max(0, (m * x) + b);
            Map<String, Object> pontoFuturo = new HashMap<>();
            pontoFuturo.put("periodo", usarDias ? "Dia +" + i : "Sem +" + i);
            pontoFuturo.put("realizado", null);
            pontoFuturo.put("previsto", BigDecimal.valueOf(yPrevisto).setScale(2, RoundingMode.HALF_UP));
            resultado.add(pontoFuturo);
            x++;
        }
        return resultado;
    }

    // --- 2. CURVA ABC E FLUXO DE CAIXA SEMANAL POR EMPRESA ---
    @Cacheable(value = "estatisticasCurva", key = "#empresaId")
    public Map<String, Object> calcularCurvaABCFluxo(Long empresaId) {
        List<Venda> vendas = vendaRepository.findByEmpresaId(empresaId);
        Map<String, Double> faturamentoPorProduto = new HashMap<>();
        Map<String, String> nomesProdutos = new HashMap<>();
        double faturamentoTotal = 0;

        for (Venda v : vendas) {
            for (ItemVenda item : v.getItens()) {
                var produto = item.getProduto();
                String chave = produto == null ? "desconhecido" : produto.getIdInterno();
                String nome = produto == null ? "Produto não identificado" : produto.getNome();
                nomesProdutos.put(chave, nome);
                double sub = item.getSubtotal().doubleValue();
                faturamentoPorProduto.put(chave, faturamentoPorProduto.getOrDefault(chave, 0.0) + sub);
                faturamentoTotal += sub;
            }
        }

        List<Map.Entry<String, Double>> listaProd = new ArrayList<>(faturamentoPorProduto.entrySet());
        listaProd.sort((a, b) -> b.getValue().compareTo(a.getValue()));

        double acumulado = 0;
        List<String> prodA = new ArrayList<>(), prodB = new ArrayList<>(), prodC = new ArrayList<>();
        double valA = 0, valB = 0, valC = 0;

        for (Map.Entry<String, Double> entry : listaProd) {
            if (faturamentoTotal == 0) break;
            double pct = (entry.getValue() / faturamentoTotal) * 100;
            if (acumulado < 80) { prodA.add(nomesProdutos.get(entry.getKey())); valA += pct; }
            else if (acumulado < 95) { prodB.add(nomesProdutos.get(entry.getKey())); valB += pct; }
            else { prodC.add(nomesProdutos.get(entry.getKey())); valC += pct; }
            acumulado += pct;
        }

        List<Map<String, Object>> abc = List.of(
            Map.of("name", "Curva A", "value", Math.round(valA), "color", "#2ecc71", "produtos", prodA.isEmpty() ? "Nenhum" : String.join(", ", prodA.subList(0, Math.min(3, prodA.size())))),
            Map.of("name", "Curva B", "value", Math.round(valB), "color", "#f1c40f", "produtos", prodB.isEmpty() ? "Nenhum" : String.join(", ", prodB.subList(0, Math.min(3, prodB.size())))),
            Map.of("name", "Curva C", "value", Math.round(valC), "color", "#e74c3c", "produtos", prodC.isEmpty() ? "Nenhum" : String.join(", ", prodC.subList(0, Math.min(3, prodC.size()))))
        );

        List<Map<String, Object>> fluxo = FluxoSemanal.calcular(vendas);

        String produtoAltaTendencia = "Aguardando Vendas";
        String produtoParado = "Aguardando vendas";
        
        if (!listaProd.isEmpty()) {
            produtoAltaTendencia = nomesProdutos.get(listaProd.get(0).getKey());
            produtoParado = nomesProdutos.get(listaProd.get(listaProd.size() - 1).getKey());
        }

        return Map.of("curva", abc, "fluxo", fluxo, "produtoAltaTendencia", produtoAltaTendencia,
                "produtoParado", produtoParado, "margens", AnaliseMargens.calcular(vendas), "rankingQuantidade", RankingProdutos.calcular(vendas));
    }

    // --- 3. TRÁFEGO POR DIA DA SEMANA POR EMPRESA ---
    @Cacheable(value = "estatisticasTrafego", key = "#empresaId")
    public Map<String, Object> calcularTrafego(Long empresaId) {
        List<Venda> vendas = vendaRepository.findByEmpresaId(empresaId);
        double[] diasSemana = new double[8]; 
        
        for (Venda v : vendas) {
            if (v.getDataVenda() != null) {
                diasSemana[v.getDataVenda().getDayOfWeek().getValue()]++;
            }
        }

        String[] nomesDias = {"", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"};
        List<Map<String, Object>> grafico = new ArrayList<>();

        for (int i = 1; i <= 7; i++) {
            grafico.add(Map.of("hora", nomesDias[i], "vendas", (int) diasSemana[i]));
        }

        return Map.of("grafico", grafico);
    }

    public List<Map<String, String>> calcularCrossSelling(Long empresaId) {
        return new ArrayList<>(); 
    }
}
