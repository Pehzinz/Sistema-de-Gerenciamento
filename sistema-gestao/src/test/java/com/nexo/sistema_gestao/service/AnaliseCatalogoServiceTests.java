package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Produto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AnaliseCatalogoServiceTests {
    final LocalDate hoje = LocalDate.of(2026, 11, 9);
    Produto produto(String id, String custo) {
        Produto p = new Produto(); p.setId(id); p.setIdInterno("1-" + id); p.setNome("Nome igual"); p.setPreco(10.0);
        p.setCustoUnitario(custo == null ? null : new BigDecimal(custo)); return p;
    }
    void numero(String esperado, Object valor) { assertNotNull(valor); assertEquals(0, new BigDecimal(esperado).compareTo((BigDecimal) valor)); }

    @Test void quartilesAndMedianExcludeUnknownCostsAndKeepProductsWithoutSales() {
        var dados = AnaliseCatalogoService.calcular(List.of(produto("1", "9"), produto("2", "8"),
                produto("3", "5"), produto("4", "2"), produto("5", null)), Map.of("1-1", 50L), hoje);
        assertEquals(4, dados.get("produtosComCusto")); assertEquals(1, dados.get("produtosSemCusto"));
        numero("35", dados.get("medianaMargemPercentual")); numero("17.5", dados.get("primeiroQuartilPercentual"));
        var pontos = (List<?>) dados.get("produtos"); assertEquals(4, pontos.size());
        var primeiro = (Map<?, ?>) pontos.getFirst();
        assertEquals("1", primeiro.get("produtoId")); assertEquals("QUARTIL_INFERIOR", primeiro.get("faixa"));
        assertEquals(50L, primeiro.get("unidadesVendidas"));
        assertEquals(0L, ((Map<?, ?>) pontos.get(1)).get("unidadesVendidas"));
    }

    @Test void activePromotionAndZeroCostAreExplicitAndNotProfitHistory() {
        var promocao = produto("1", "9"); promocao.setPrecoPromocional(7.0);
        promocao.setDataInicioPromocao(hoje); promocao.setDataFimPromocao(hoje);
        var vencida = produto("2", "8"); vencida.setPrecoPromocional(1.0);
        vencida.setDataInicioPromocao(hoje.minusDays(2)); vencida.setDataFimPromocao(hoje.minusDays(1));
        var dados = AnaliseCatalogoService.calcular(List.of(promocao, vencida, produto("3", "0")), Map.of(), hoje);
        var pontos = (List<?>) dados.get("produtos");
        var primeiro = (Map<?, ?>) pontos.getFirst(); numero("-2", primeiro.get("margemUnitaria"));
        numero("-28.57", primeiro.get("margemPercentual")); assertEquals(true, primeiro.get("promocaoAtiva"));
        assertEquals("ABAIXO_DO_CUSTO", primeiro.get("faixa")); assertEquals(1L, dados.get("produtosAbaixoDoCusto"));
        numero("10", ((Map<?, ?>) pontos.get(1)).get("precoVenda"));
        numero("100", ((Map<?, ?>) pontos.get(2)).get("margemPercentual"));
        assertNull(dados.get("primeiroQuartilPercentual"));
    }

    @Test void emptyCatalogOrMissingCostsNeverProduceArtificialStatistics() {
        var dados = AnaliseCatalogoService.calcular(List.of(produto("1", null)), Map.of(), hoje);
        assertEquals(0, dados.get("produtosComCusto")); assertNull(dados.get("medianaMargemPercentual"));
        assertNull(dados.get("primeiroQuartilPercentual")); assertTrue(((List<?>) dados.get("produtos")).isEmpty());
        var zero = AnaliseCatalogoService.calcular(List.of(produto("1", "10")), Map.of(), hoje);
        assertEquals("SEM_MARGEM", ((Map<?, ?>) ((List<?>) zero.get("produtos")).getFirst()).get("faixa"));
    }
}
