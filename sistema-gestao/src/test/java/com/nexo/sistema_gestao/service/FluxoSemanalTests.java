package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class FluxoSemanalTests {
    Venda venda(String data, String receita, String custo, int quantidade) {
        Venda venda = new Venda(); venda.setDataVenda(LocalDateTime.parse(data)); venda.setTotal(new BigDecimal(receita));
        ItemVenda item = new ItemVenda(); item.setQuantidade(quantidade); item.setSubtotal(new BigDecimal(receita));
        item.setCustoUnitario(custo == null ? null : new BigDecimal(custo)); venda.setItens(List.of(item)); return venda;
    }
    void numero(String esperado, Object valor) { assertEquals(0, new BigDecimal(esperado).compareTo((BigDecimal) valor)); }

    @Test void mondayToSundayUsesActualRevenueAndQuantityTimesSaleCost() {
        var segunda = venda("2026-11-02T00:00:00", "20.00", "4.00", 2);
        var domingo = venda("2026-11-08T23:59:59", "10.00", "3.00", 1);
        var seguinte = venda("2026-11-09T00:00:00", "8.00", "2.00", 1);
        var dados = FluxoSemanal.calcular(List.of(seguinte, domingo, segunda));
        assertEquals(2, dados.size()); assertEquals("Sem 2/11/2026", dados.getFirst().get("mes"));
        numero("30", dados.getFirst().get("receitas")); numero("11", dados.getFirst().get("custos"));
        numero("8", dados.get(1).get("receitas")); numero("2", dados.get(1).get("custos"));
        var produto = new Produto(); produto.setCustoUnitario(new BigDecimal("999")); segunda.getItens().getFirst().setProduto(produto);
        assertEquals(dados, FluxoSemanal.calcular(List.of(seguinte, domingo, segunda)));
    }

    @Test void missingCostsAreGapsAndZeroCostIsARealValue() {
        var dados = FluxoSemanal.calcular(List.of(venda("2026-11-02T12:00:00", "10", null, 1),
                venda("2026-11-03T12:00:00", "10", "2", 1), venda("2026-11-09T12:00:00", "10", "0", 1)));
        assertNull(dados.getFirst().get("custos")); numero("20", dados.getFirst().get("receitas"));
        assertEquals(1L, dados.getFirst().get("unidadesSemCusto")); numero("0", dados.get(1).get("custos"));
    }

    @Test void emptyWeeksAreZeroAndSalesWithoutItemsHaveUnknownCosts() {
        var semItens = venda("2026-11-16T12:00:00", "10", "1", 1); semItens.setItens(List.of());
        var dados = FluxoSemanal.calcular(List.of(venda("2026-11-02T12:00:00", "10", "1", 1), semItens));
        assertEquals(3, dados.size()); numero("0", dados.get(1).get("receitas")); numero("0", dados.get(1).get("custos"));
        assertNull(dados.get(2).get("custos")); assertTrue(FluxoSemanal.calcular(List.of()).isEmpty());
    }
}
