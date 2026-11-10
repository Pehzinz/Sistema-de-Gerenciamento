package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class RankingProdutosTests {
    Produto produto(String id, String nome) {
        Produto p = new Produto(); p.setId(id); p.setIdInterno("1-" + id); p.setNome(nome); return p;
    }
    ItemVenda item(Produto produto, Integer quantidade, String receita) {
        ItemVenda i = new ItemVenda(); i.setProduto(produto); i.setQuantidade(quantidade); i.setSubtotal(new BigDecimal(receita)); return i;
    }
    Venda venda(ItemVenda... itens) { Venda v = new Venda(); v.setItens(Arrays.asList(itens)); return v; }
    @SuppressWarnings("unchecked") List<Map<String, Object>> produtos(Map<String, Object> dados) { return (List<Map<String, Object>>) dados.get("produtos"); }

    @Test void sumsUnitsAcrossSalesAndIgnoresRevenueForOrder() {
        Produto barato = produto("1", "Pão"), caro = produto("2", "Cesta");
        var dados = RankingProdutos.calcular(List.of(venda(item(barato, 3, "3"), item(caro, 1, "999")), venda(item(barato, 7, "7"))));
        assertEquals(11L, dados.get("totalUnidades"));
        assertEquals("Pão", produtos(dados).getFirst().get("nome"));
        assertEquals(10L, produtos(dados).getFirst().get("quantidade"));
        assertEquals(new BigDecimal("90.91"), produtos(dados).getFirst().get("participacaoPercentual"));
        assertTrue(RankingProdutos.resumir(dados).contains("10 unidades"));
    }

    @Test void keepsInactiveProductsAndSameNamesSeparateAndBreaksTiesConsistently() {
        Produto a = produto("1", "Mesmo nome"), b = produto("2", "Mesmo nome"); b.setAtivo(false);
        var dados = RankingProdutos.calcular(List.of(venda(item(b, 4, "1"), item(a, 4, "1"))));
        assertEquals(2, produtos(dados).size());
        assertEquals("1", produtos(dados).getFirst().get("produtoId"));
        assertEquals("2", produtos(dados).getLast().get("produtoId"));
    }

    @Test void reportsUnidentifiedUnitsAndIncompleteRecordsWithoutInventingQuantities() {
        var semItens = new Venda(); semItens.setItens(List.of());
        var dados = RankingProdutos.calcular(List.of(semItens, venda(item(null, 5, "5"), item(produto("1", "Pão"), null, "10"), item(produto("2", "Cesta"), 0, "20"))));
        assertEquals(5L, dados.get("totalUnidades")); assertEquals(5L, dados.get("unidadesSemIdentificacao"));
        assertEquals(2L, dados.get("itensSemQuantidade")); assertEquals(1L, dados.get("vendasSemItens"));
        assertTrue(produtos(dados).isEmpty());
        assertTrue(RankingProdutos.resumir(dados).contains("incompleto"));
    }

    @Test void emptyHistoryIsEmptyAndTotalsDoNotOverflowAnInteger() {
        assertEquals(0L, RankingProdutos.calcular(List.of()).get("totalUnidades"));
        Produto p = produto("1", "Pão");
        var dados = RankingProdutos.calcular(List.of(venda(item(p, Integer.MAX_VALUE, "1"), item(p, Integer.MAX_VALUE, "1"))));
        assertEquals(4294967294L, dados.get("totalUnidades"));
        assertEquals(4294967294L, produtos(dados).getFirst().get("quantidade"));
    }
}
