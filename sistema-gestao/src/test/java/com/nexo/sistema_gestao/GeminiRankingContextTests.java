package com.nexo.sistema_gestao;

import com.nexo.sistema_gestao.controller.GeminiController;
import com.nexo.sistema_gestao.model.*;
import com.nexo.sistema_gestao.repository.*;
import com.nexo.sistema_gestao.service.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GeminiRankingContextTests {
    @Test void naturalLanguageQuestionIncludesRealUnitRankingInAiContext() {
        GeminiController controller = new GeminiController();
        var ai = mock(GeminiService.class); var estatisticas = mock(EstatisticaService.class);
        var produtos = mock(ProdutoRepository.class); var vendas = mock(VendaRepository.class);
        ReflectionTestUtils.setField(controller, "geminiService", ai);
        ReflectionTestUtils.setField(controller, "estatisticaService", estatisticas);
        ReflectionTestUtils.setField(controller, "produtoRepository", produtos);
        ReflectionTestUtils.setField(controller, "vendaRepository", vendas);
        Empresa empresa = new Empresa(); empresa.setId(17L); Usuario usuario = new Usuario(); usuario.setEmpresa(empresa);
        Produto p = new Produto(); p.setId("1234567890"); p.setIdInterno("17-1234567890"); p.setNome("Pão integral"); p.setEstoque(2);
        Venda venda = new Venda(); venda.setTotal(BigDecimal.TEN);
        ItemVenda item = new ItemVenda(); item.setProduto(p); item.setQuantidade(10); item.setSubtotal(BigDecimal.TEN); venda.setItens(List.of(item));
        when(produtos.findByEmpresaIdAndAtivoTrue(17L)).thenReturn(List.of(p));
        when(vendas.findByEmpresaId(17L)).thenReturn(List.of(venda));
        when(estatisticas.calcularCurvaABCFluxo(17L)).thenReturn(Map.of("curva", List.of(), "produtoAltaTendencia", "Cesta premium", "rankingQuantidade", RankingProdutos.calcular(List.of(venda))));
        when(estatisticas.calcularTrafego(17L)).thenReturn(Map.of("grafico", List.of()));
        when(ai.perguntarParaIA(anyString())).thenReturn("Resposta de teste");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(usuario, null, List.of()));
        try {
            assertEquals(200, controller.perguntarAoAgente(Map.of("pergunta", "Quais são os mais vendidos?")).getStatusCode().value());
            var contexto = ArgumentCaptor.forClass(String.class); verify(ai).perguntarParaIA(contexto.capture());
            assertTrue(contexto.getValue().contains("Pão integral — 10 unidades"));
            assertTrue(contexto.getValue().contains("Disponível agora: 2"));
            assertTrue(contexto.getValue().contains("Maior receita") || contexto.getValue().contains("maior receita"));
            assertFalse(contexto.getValue().contains("% do lucro"));
        } finally { SecurityContextHolder.clearContext(); }
    }
}
