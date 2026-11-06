package com.nexo.sistema_gestao;

import com.nexo.sistema_gestao.model.*;
import com.nexo.sistema_gestao.repository.*;
import com.nexo.sistema_gestao.service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:estoque;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "api.security.token.secret=isolated-tests-only-0123456789abcdef0123456789", "telegrambots.enabled=false"
})
class ProdutoEstoqueIntegrationTests {
    @Autowired com.nexo.sistema_gestao.controller.ProdutoController controller;
    @Autowired ProdutoRepository produtos;
    @Autowired VendaRepository vendas;
    @Autowired VendaService service;
    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager manager;
    Empresa empresa;
    Produto produto;
    TransactionTemplate tx;
    Categoria categoria;

    @BeforeEach void preparar() {
        tx = new TransactionTemplate(manager);
        tx.executeWithoutResult(status -> {
            empresa = new Empresa("Loja", UUID.randomUUID().toString().substring(0, 15)); em.persist(empresa);
            categoria = new Categoria(); categoria.setNome("Categoria"); categoria.setEmpresa(empresa); em.persist(categoria);
            produto = novo("1234567890", TipoEstoque.COTA_TEMPO, 0);
            produto.setLimiteCota(1); produto.setIntervaloCotaMinutos(60);
            ControleEstoque.configurar(produto, produto, Instant.now(), true); em.persist(produto);
        });
        var usuario = new Usuario(); usuario.setEmpresa(empresa);
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(usuario, null, List.of()));
    }
    @AfterEach void limparContexto() { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }
    Produto novo(String id, TipoEstoque tipo, int saldo) {
        var p = new Produto(); p.setId(id); p.setIdInterno(empresa.getId() + "-" + id);
        p.setEmpresa(empresa); p.setCategoria(categoria); p.setNome("Teste"); p.setPreco(10.0); p.setEstoque(saldo); p.setTipoEstoque(tipo); return p;
    }
    ItemVenda item(Produto p, int quantidade) {
        var item = new ItemVenda(); item.setProduto(p); item.setQuantidade(quantidade); return item;
    }
    Venda vender(List<ItemVenda> itens, String total) {
        var venda = new Venda(); venda.setEmpresa(empresa); venda.setFormaPagamento("PIX"); venda.setTotal(new BigDecimal(total));
        return service.finalizarVenda(venda, new ArrayList<>(itens));
    }
    Produto recarregar() { return produtos.findByIdAndEmpresaId(produto.getId(), empresa.getId()).orElseThrow(); }

    @Test void vendasSimultaneasNaoUltrapassamACota() throws Exception {
        var inicio = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> tarefa = () -> {
                inicio.await();
                try { vender(List.of(item(produto, 1)), "10.00"); return true; }
                catch (IllegalStateException e) { return false; }
            };
            var a = executor.submit(tarefa); var b = executor.submit(tarefa); inicio.countDown();
            int aceitas = (a.get(15, TimeUnit.SECONDS) ? 1 : 0) + (b.get(15, TimeUnit.SECONDS) ? 1 : 0);
            assertEquals(1, aceitas); assertEquals(1, recarregar().getVendasNaJanela());
            assertEquals(1, vendas.findByEmpresaId(empresa.getId()).size());
        }
    }
    @Test void precoIncorretoReverteConsumoDaCota() {
        assertThrows(IllegalArgumentException.class, () -> vender(List.of(item(produto, 1)), "1.00"));
        assertEquals(0, recarregar().getVendasNaJanela());
        assertTrue(vendas.findByEmpresaId(empresa.getId()).isEmpty());
    }
    @Test void linhasRepetidasCompartilhamACotaERevertemAVendaInteira() {
        assertThrows(IllegalStateException.class, () -> vender(List.of(item(produto, 1), item(produto, 1)), "20.00"));
        assertEquals(0, recarregar().getVendasNaJanela());
    }
    @Test void vendaRenovaJanelaPersistidaSemAgendador() {
        tx.executeWithoutResult(status -> {
            var p = produtos.buscarParaVenda(produto.getId(), empresa.getId()).orElseThrow();
            p.setInicioJanelaCota(Instant.now().minusSeconds(7201)); p.setVendasNaJanela(1);
        });
        vender(List.of(item(produto, 1)), "10.00");
        assertEquals(1, recarregar().getVendasNaJanela());
        assertTrue(recarregar().getInicioJanelaCota().isAfter(Instant.now().minusSeconds(10)));
    }
    @Test void legadoNuloContinuaVendendoEValidadeVencidaReverteOutrosItens() {
        Produto[] fisico = new Produto[1]; Produto[] vencido = new Produto[1];
        tx.executeWithoutResult(status -> {
            fisico[0] = novo("1111111111", null, 5); em.persist(fisico[0]);
            vencido[0] = novo("9999999999", TipoEstoque.VALIDADE, 5);
            vencido[0].setValidadeComercial(Instant.now().minusSeconds(1)); em.persist(vencido[0]);
        });
        vender(List.of(item(fisico[0], 1)), "10.00");
        assertThrows(IllegalStateException.class, () -> vender(List.of(item(fisico[0], 1), item(vencido[0], 1)), "20.00"));
        assertEquals(4, produtos.findByIdAndEmpresaId("1111111111", empresa.getId()).orElseThrow().getEstoque());
    }
    @Test void bloqueioRespeitaEmpresa() {
        tx.executeWithoutResult(status -> assertTrue(produtos.buscarParaVenda(produto.getId(), empresa.getId() + 1000).isEmpty()));
    }
    @Test void catalogoOcultaVencidosEZeradosMasGestaoPermiteRecuperalos() {
        tx.executeWithoutResult(status -> {
            var vencido = novo("3333333333", TipoEstoque.VALIDADE, 5);
            vencido.setValidadeComercial(Instant.now().minusSeconds(1)); em.persist(vencido);
            var zerado = novo("4444444444", TipoEstoque.VALIDADE, 0);
            zerado.setValidadeComercial(Instant.now().plusSeconds(3600)); em.persist(zerado);
            var valido = novo("5555555555", TipoEstoque.VALIDADE, 2);
            valido.setValidadeComercial(Instant.now().plusSeconds(3600)); em.persist(valido);
            var cota = produtos.buscarParaVenda(produto.getId(), empresa.getId()).orElseThrow();
            cota.setVendasNaJanela(1);
        });
        var ids = controller.listarCatalogo().getBody().stream().map(Produto::getId).toList();
        assertFalse(ids.contains("3333333333")); assertFalse(ids.contains("4444444444"));
        assertTrue(ids.contains("5555555555")); assertTrue(ids.contains(produto.getId()));
        assertEquals(404, controller.buscarNoCatalogo("3333333333").getStatusCode().value());
        assertEquals(200, controller.buscarPorId("3333333333").getStatusCode().value());
        assertEquals(4, controller.listarTodos().getBody().size());
    }
    @Test void edicaoReposicaoExclusaoEReativacaoSuportamOsTipos() {
        assertThrows(IllegalArgumentException.class, () -> controller.adicionarEstoque(produto.getId(), Map.of("quantidade", 3)));
        var dados = novo(produto.getId(), TipoEstoque.PADRAO, 7);
        assertEquals(200, controller.atualizarProduto(produto.getId(), dados).getStatusCode().value());
        assertEquals(7, recarregar().getEstoque()); assertNull(recarregar().getLimiteCota());
        controller.adicionarEstoque(produto.getId(), Map.of("quantidade", 3));
        assertEquals(10, recarregar().getEstoque());
        assertEquals(400, controller.inativarProduto(produto.getId()).getStatusCode().value());
        dados.setTipoEstoque(TipoEstoque.COTA_TEMPO); dados.setLimiteCota(5); dados.setIntervaloCotaMinutos(60);
        controller.atualizarProduto(produto.getId(), dados);
        assertEquals(204, controller.inativarProduto(produto.getId()).getStatusCode().value());
        assertTrue(controller.listarCatalogo().getBody().isEmpty());
        var reativado = novo(produto.getId(), TipoEstoque.VALIDADE, 0);
        reativado.setValidadeComercial(Instant.now().plusSeconds(3600));
        assertEquals(200, controller.salvarProduto(reativado).getStatusCode().value());
        assertEquals(TipoEstoque.VALIDADE, recarregar().getTipoEstoque());
        assertEquals(204, controller.inativarProduto(produto.getId()).getStatusCode().value());
    }

}
