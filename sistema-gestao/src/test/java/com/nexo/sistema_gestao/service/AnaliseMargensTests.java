package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class AnaliseMargensTests {
    ItemVenda item(String id, String receita, String custo, int quantidade) {
        Produto produto = new Produto(); produto.setId(id); produto.setIdInterno("1-" + id); produto.setNome("Mesmo nome");
        produto.setCustoUnitario(new BigDecimal("999")); // O custo atual nunca substitui o da venda.
        ItemVenda item = new ItemVenda(); item.setProduto(produto); item.setQuantidade(quantidade);
        item.setSubtotal(new BigDecimal(receita));
        item.setCustoUnitario(custo == null ? null : new BigDecimal(custo)); return item;
    }

    @Test void ranksLossesByProductIdentityAndUsesOnlyKnownHistoricalCosts() {
        Venda venda = new Venda(); venda.setItens(List.of(
                item("1", "5.00", "10.00", 1), item("2", "2.00", "10.00", 2),
                item("3", "50.00", null, 10), item("4", "1.00", "0.00", 1),
                item("1", "1.00", null, 1)));
        var dados = AnaliseMargens.calcular(List.of(venda));
        assertEquals(new BigDecimal("8.00"), dados.get("receitaComCusto"));
        assertEquals(new BigDecimal("51.00"), dados.get("receitaSemCusto"));
        assertEquals(new BigDecimal("30.00"), dados.get("custoProdutosVendidos"));
        assertEquals(new BigDecimal("-22.00"), dados.get("margemBruta"));
        assertEquals(new BigDecimal("-275.00"), dados.get("margemPercentual"));
        assertEquals(2L, dados.get("produtosComMargemNegativa"));
        assertEquals(4L, dados.get("unidadesComCusto"));
        assertEquals(11L, dados.get("unidadesSemCusto"));
        var produtos = (List<?>) dados.get("produtos");
        assertEquals(4, produtos.size()); // Produtos homônimos não são mesclados.
        assertEquals("2", ((Map<?, ?>) produtos.get(0)).get("produtoId"));
        assertEquals(new BigDecimal("-18.00"), ((Map<?, ?>) produtos.get(0)).get("margemBruta"));
        assertEquals("1", ((Map<?, ?>) produtos.get(1)).get("produtoId"));
        assertEquals(1L, ((Map<?, ?>) produtos.get(1)).get("unidadesSemCusto"));
        assertNull(((Map<?, ?>) produtos.get(3)).get("margemBruta"));
    }

    @Test void noSalesOrOnlyUnknownCostsNeverProduceFictitiousProfit() {
        assertNull(AnaliseMargens.calcular(List.of()).get("margemBruta"));
        Venda venda = new Venda(); venda.setItens(List.of(item("1", "10.00", null, 1)));
        var dados = AnaliseMargens.calcular(List.of(venda));
        assertNull(dados.get("margemBruta"));
        assertEquals(new BigDecimal("10.00"), dados.get("receitaSemCusto"));
        assertEquals(0L, dados.get("produtosComMargemNegativa"));
    }

    @Test void realWeeklyRevenueAndAbcDoNotMergeProductsWithSameName() {
        Venda venda = new Venda(); venda.setDataVenda(java.time.LocalDateTime.of(2026, 11, 9, 12, 0));
        venda.setTotal(new BigDecimal("160.10"));
        venda.setItens(List.of(item("1", "100.05", null, 1), item("2", "60.05", null, 1)));
        var repositorio = org.mockito.Mockito.mock(com.nexo.sistema_gestao.repository.VendaRepository.class);
        org.mockito.Mockito.when(repositorio.findByEmpresaId(1L)).thenReturn(List.of(venda));
        var service = new EstatisticaService();
        org.springframework.test.util.ReflectionTestUtils.setField(service, "vendaRepository", repositorio);
        var dados = service.calcularCurvaABCFluxo(1L);
        assertEquals("Mesmo nome (1)", dados.get("produtoAltaTendencia"));
        assertEquals("Mesmo nome (2)", dados.get("produtoParado"));
        var semana = (Map<?, ?>) ((List<?>) dados.get("fluxo")).getFirst();
        assertEquals(new BigDecimal("160.10"), semana.get("receitas"));
        assertFalse(semana.containsKey("despesas"));
    }
}
