package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Venda;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;

final class FluxoSemanal {
    private FluxoSemanal() {}
    private static final class Semana {
        BigDecimal receitas = BigDecimal.ZERO;
        BigDecimal custos = BigDecimal.ZERO;
        long unidadesSemCusto;
        boolean completo = true;
    }

    static List<Map<String, Object>> calcular(List<Venda> vendas) {
        NavigableMap<LocalDate, Semana> semanas = new TreeMap<>();
        for (var venda : vendas) {
            if (venda.getDataVenda() == null) continue;
            LocalDate inicio = venda.getDataVenda().toLocalDate().with(DayOfWeek.MONDAY);
            Semana semana = semanas.computeIfAbsent(inicio, data -> new Semana());
            semana.receitas = semana.receitas.add(venda.getTotal());
            if (venda.getItens().isEmpty()) semana.completo = false;
            for (var item : venda.getItens()) {
                if (item.getCustoUnitario() == null) {
                    semana.completo = false;
                    semana.unidadesSemCusto += item.getQuantidade();
                } else {
                    semana.custos = semana.custos.add(item.getCustoUnitario().multiply(BigDecimal.valueOf(item.getQuantidade())));
                }
            }
        }
        List<Map<String, Object>> resultado = new ArrayList<>();
        if (semanas.isEmpty()) return resultado;
        for (LocalDate data = semanas.firstKey(); !data.isAfter(semanas.lastKey()); data = data.plusWeeks(1)) {
            Semana semana = semanas.getOrDefault(data, new Semana());
            Map<String, Object> ponto = new LinkedHashMap<>();
            ponto.put("mes", "Sem " + data.getDayOfMonth() + "/" + data.getMonthValue() + "/" + data.getYear());
            ponto.put("inicioSemana", data);
            ponto.put("receitas", semana.receitas);
            // Ausência de custo é uma lacuna, nunca um custo zero ou percentual inventado.
            ponto.put("custos", semana.completo ? semana.custos : null);
            ponto.put("unidadesSemCusto", semana.unidadesSemCusto);
            resultado.add(ponto);
        }
        return resultado;
    }
}
