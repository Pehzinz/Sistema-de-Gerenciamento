package com.nexo.sistema_gestao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexo.sistema_gestao.model.*;
import com.nexo.sistema_gestao.repository.*;
import com.nexo.sistema_gestao.security.TokenService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:security;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "api.security.token.secret=isolated-tests-only-0123456789abcdef0123456789",
    "telegrambots.enabled=false", "server.forward-headers-strategy=none"
})
class SistemaGestaoApplicationTests {
    @Autowired Environment environment;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired CategoriaRepository categorias;
    @Autowired ProdutoRepository produtos;
    @Autowired VendaRepository vendas;
    @Autowired EventoRepository eventos;
    @Autowired TokenService tokens;
    @Autowired com.nexo.sistema_gestao.service.AcessoContaService acessoConta;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder senhas;
    final ObjectMapper json = new ObjectMapper();
    final HttpClient http = HttpClient.newHttpClient();
    Empresa empresa;
    Usuario admin, colaborador;
    Produto produto;
    String adminToken, colaboradorToken;

    @BeforeEach void setup() {
        empresa = empresas.save(new Empresa("Teste", UUID.randomUUID().toString().substring(0, 18)));
        admin = user("ADMIN"); colaborador = user("COLABORADOR");
        adminToken = tokens.gerarToken(admin); colaboradorToken = tokens.gerarToken(colaborador);
        Categoria categoria = new Categoria("Categoria " + empresa.getId());
        categoria.setEmpresa(empresa); categoria = categorias.save(categoria);
        produto = new Produto(); produto.setId("1234567890");
        produto.setIdInterno(empresa.getId() + "-1234567890"); produto.setEmpresa(empresa);
        produto.setCategoria(categoria); produto.setNome("Produto"); produto.setPreco(10.0); produto.setEstoque(1);
        produto = produtos.save(produto);
    }

    Usuario user(String role) {
        Usuario u = new Usuario(); u.setEmpresa(empresa); u.setPerfil(role);
        u.setNomeCompleto(role); u.setCpf(UUID.randomUUID().toString().substring(0, 14));
        u.setSenha("hash-nao-deve-ser-exposto"); return usuarios.save(u);
    }

    HttpResponse<String> call(String method, String path, String token, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + environment.getProperty("local.server.port") + path));
        if (token != null) request.header("Authorization", "Bearer " + token);
        request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    String sale(int qty, String total) {
        return "{\"usuarioId\":" + admin.getId() + ",\"formaPagamento\":\"PIX\",\"total\":" + total
            + ",\"itens\":[{\"produtoId\":\"1234567890\",\"quantidade\":" + qty + ",\"precoUnitario\":0.01,\"subtotal\":0.01}]}";
    }

    String produtoComCusto(String custo) {
        return "{\"nome\":\"Produto\",\"preco\":10,\"estoque\":5,\"categoria\":{\"id\":"
                + produto.getCategoria().getId() + "},\"custoUnitario\":" + custo + "}";
    }

    @Test void browserPreflightAllowsCostPatchOnlyFromConfiguredOrigins() throws Exception {
        var uri = URI.create("http://localhost:" + environment.getProperty("local.server.port") + "/api/produtos/" + produto.getId() + "/custo");
        var request = HttpRequest.newBuilder(uri).method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .header("Origin", "http://localhost:5173").header("Access-Control-Request-Method", "PATCH")
                .header("Access-Control-Request-Headers", "authorization,content-type").build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode());
        assertEquals("http://localhost:5173", response.headers().firstValue("Access-Control-Allow-Origin").orElseThrow());
        assertTrue(response.headers().firstValue("Access-Control-Allow-Methods").orElseThrow().contains("PATCH"));
        var estrangeiro = HttpRequest.newBuilder(uri).method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .header("Origin", "https://origem-nao-autorizada.invalid").header("Access-Control-Request-Method", "PATCH").build();
        assertEquals(403, http.send(estrangeiro, HttpResponse.BodyHandlers.ofString()).statusCode());
    }


    @Test void productCostsRespectTenantAndValidateMoney() throws Exception {
        Empresa outra = empresas.save(new Empresa("Outra", "custos-" + empresa.getId()));
        Produto externo = new Produto(); externo.setId(produto.getId()); externo.setIdInterno(outra.getId() + "-" + produto.getId());
        externo.setNome("Outro produto"); externo.setEmpresa(outra); externo.setPreco(10.0); externo.setEstoque(1);
        externo.setCustoUnitario(new java.math.BigDecimal("99.00")); produtos.save(externo);
        Venda vendaExterna = new Venda(); vendaExterna.setEmpresa(outra); vendaExterna.setTotal(new java.math.BigDecimal("10.00")); vendaExterna.setFormaPagamento("PIX");
        ItemVenda itemExterno = new ItemVenda(); itemExterno.setProduto(externo); itemExterno.setQuantidade(1);
        itemExterno.setPrecoUnitario(new java.math.BigDecimal("10.00")); itemExterno.setSubtotal(new java.math.BigDecimal("10.00"));
        itemExterno.setCustoUnitario(new java.math.BigDecimal("99.00")); itemExterno.setVenda(vendaExterna);
        vendaExterna.setItens(List.of(itemExterno)); vendas.save(vendaExterna);
        var isolado = json.readTree(call("GET", "/api/tendencias/curva-fluxo?empresaId=" + outra.getId(), adminToken, null).body());
        assertEquals(0, isolado.path("margens").path("produtos").size());
        assertTrue(isolado.path("margens").path("margemBruta").isNull());
        String caminho = "/api/produtos/" + produto.getId();
        String adulterado = produtoComCusto("7.25").replace("{\"nome\"", "{\"empresa\":{\"id\":" + outra.getId() + "},\"nome\"");
        assertEquals(200, call("PUT", caminho, adminToken, adulterado).statusCode());
        assertEquals(0, produtos.findById(produto.getIdInterno()).orElseThrow().getCustoUnitario().compareTo(new java.math.BigDecimal("7.25")));
        assertEquals(0, produtos.findById(externo.getIdInterno()).orElseThrow().getCustoUnitario().compareTo(new java.math.BigDecimal("99.00")));
        assertFalse(call("GET", "/api/produtos", adminToken, null).body().contains("99.00"));
        assertEquals(403, call("PUT", caminho, colaboradorToken, produtoComCusto("1")).statusCode());
        for (String invalido : List.of("-1", "1.001", "10000000000")) {
            assertEquals(400, call("PUT", caminho, adminToken, produtoComCusto(invalido)).statusCode());
            String cadastro = produtoComCusto(invalido).replace("{\"nome\"", "{\"id\":\"8888888888\",\"nome\"");
            assertEquals(400, call("POST", "/api/produtos", adminToken, cadastro).statusCode());
        }
        // Clientes antigos que omitem custo não apagam o valor existente.
        assertEquals(200, call("PUT", caminho, adminToken, produtoComCusto("null").replace(",\"custoUnitario\":null", "")).statusCode());
        assertEquals(0, produtos.findById(produto.getIdInterno()).orElseThrow().getCustoUnitario().compareTo(new java.math.BigDecimal("7.25")));
        assertEquals(200, call("PUT", caminho, adminToken, produtoComCusto("null")).statusCode());
        assertNull(produtos.findById(produto.getIdInterno()).orElseThrow().getCustoUnitario());
        String cadastro = produtoComCusto("0").replace("{\"nome\"", "{\"id\":\"8888888888\",\"nome\"");
        assertEquals(201, call("POST", "/api/produtos", adminToken, cadastro).statusCode());
        assertEquals(0, produtos.findByIdAndEmpresaId("8888888888", empresa.getId()).orElseThrow().getCustoUnitario().signum());
    }

    @Test void salesKeepCostSnapshotsAndAccountingAfterChangesAndDeletion() throws Exception {
        produto.setEstoque(5); produto.setCustoUnitario(new java.math.BigDecimal("12.00"));
        produto.setPrecoPromocional(7.0);
        var hoje = java.time.LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo"));
        produto.setDataInicioPromocao(hoje); produto.setDataFimPromocao(hoje); produtos.save(produto);
        // O custo enviado pelo cliente é ignorado; o servidor lê o produto da empresa autenticada.
        String adulterado = sale(2, "14.00").replace("\"subtotal\":0.01", "\"subtotal\":0.01,\"custoUnitario\":0");
        assertEquals(201, call("POST", "/api/vendas", colaboradorToken, adulterado).statusCode());
        var item = vendas.findByEmpresaId(empresa.getId()).getFirst().getItens().getFirst();
        assertEquals(0, item.getCustoUnitario().compareTo(new java.math.BigDecimal("12.00")));
        String historico = call("GET", "/api/vendas", adminToken, null).body();
        var antes = json.readTree(call("GET", "/api/tendencias/curva-fluxo", adminToken, null).body());
        assertEquals(-10.0, antes.path("margens").path("margemBruta").asDouble());
        assertEquals(24.0, antes.path("margens").path("custoProdutosVendidos").asDouble());
        assertEquals(1, antes.path("margens").path("produtosComMargemNegativa").asInt());
        assertFalse(antes.path("fluxo").get(0).has("despesas"));
        // Retira a promoção e altera somente o custo das vendas futuras.
        assertEquals(200, call("PUT", "/api/produtos/" + produto.getId(), adminToken, produtoComCusto("1.00")).statusCode());
        assertEquals(antes, json.readTree(call("GET", "/api/tendencias/curva-fluxo", adminToken, null).body()));
        assertEquals(historico, call("GET", "/api/vendas", adminToken, null).body());
        assertEquals(204, call("DELETE", "/api/produtos/" + produto.getId(), adminToken, null).statusCode());
        assertEquals(historico, call("GET", "/api/vendas", adminToken, null).body());
        assertEquals(antes, json.readTree(call("GET", "/api/tendencias/curva-fluxo", adminToken, null).body()));
        // Lê também sem cache para garantir a preservação persistida.
        var novoServico = new com.nexo.sistema_gestao.service.EstatisticaService();
        org.springframework.test.util.ReflectionTestUtils.setField(novoServico, "vendaRepository", vendas);
        assertEquals(new java.math.BigDecimal("-10.00"), ((Map<?, ?>) novoServico.calcularCurvaABCFluxo(empresa.getId()).get("margens")).get("margemBruta"));
    }

    @Test void missingCostsStayUnknownAndZeroCostIsExplicit() throws Exception {
        produto.setEstoque(3); produtos.save(produto);
        assertEquals(201, call("POST", "/api/vendas", colaboradorToken, sale(1, "10.00")).statusCode());
        var antes = json.readTree(call("GET", "/api/tendencias/curva-fluxo", adminToken, null).body()).path("margens");
        assertTrue(antes.path("margemBruta").isNull());
        assertEquals(10.0, antes.path("receitaSemCusto").asDouble());
        assertEquals(200, call("PUT", "/api/produtos/" + produto.getId(), adminToken, produtoComCusto("0")).statusCode());
        assertEquals(201, call("POST", "/api/vendas", colaboradorToken, sale(1, "10.00")).statusCode());
        var depois = json.readTree(call("GET", "/api/tendencias/curva-fluxo", adminToken, null).body()).path("margens");
        assertEquals(1, depois.path("unidadesComCusto").asInt());
        assertEquals(1, depois.path("unidadesSemCusto").asInt());
        assertEquals(10.0, depois.path("margemBruta").asDouble());
        assertEquals(10.0, depois.path("receitaSemCusto").asDouble());
        assertEquals(0.0, depois.path("custoProdutosVendidos").asDouble());
        assertNull(vendas.findByEmpresaId(empresa.getId()).getFirst().getItens().getFirst().getCustoUnitario());
        assertEquals(403, call("GET", "/api/tendencias/curva-fluxo", colaboradorToken, null).statusCode());
        var previsao = json.readTree(call("GET", "/api/tendencias/previsao-vendas", adminToken, null).body());
        assertEquals(1, previsao.size());
        assertTrue(previsao.get(0).path("previsto").isNull());
    }

    @Test void costOnlyUpdatePreservesStockAndPriceAfterSale() throws Exception {
        assertEquals(201, call("POST", "/api/vendas", colaboradorToken, sale(1, "10.00")).statusCode());
        String caminho = "/api/produtos/" + produto.getId() + "/custo";
        assertEquals(200, call("PATCH", caminho, adminToken, "{\"custoUnitario\":8.75}").statusCode());
        var salvo = produtos.findById(produto.getIdInterno()).orElseThrow();
        assertEquals(0, salvo.getEstoque()); assertEquals(10.0, salvo.getPreco());
        assertEquals(0, salvo.getCustoUnitario().compareTo(new java.math.BigDecimal("8.75")));
        assertNull(vendas.findByEmpresaId(empresa.getId()).getFirst().getItens().getFirst().getCustoUnitario());
        assertEquals(403, call("PATCH", caminho, colaboradorToken, "{\"custoUnitario\":0}").statusCode());
        assertEquals(404, call("PATCH", "/api/produtos/0000000000/custo", adminToken, "{\"custoUnitario\":0}").statusCode());
        assertEquals(400, call("PATCH", caminho, adminToken, "{}").statusCode());
        assertEquals(400, call("PATCH", caminho, adminToken, "{\"custoUnitario\":-1}").statusCode());
        assertEquals(200, call("PATCH", caminho, adminToken, "{\"custoUnitario\":null}").statusCode());
        assertNull(produtos.findById(produto.getIdInterno()).orElseThrow().getCustoUnitario());
    }

    @Test void removedEmployeesKeepSalesAndLoseAccess() throws Exception {
        Usuario outroAdmin = user("ADMIN");
        String outroToken = tokens.gerarToken(outroAdmin);
        assertEquals(201, call("POST", "/api/vendas", adminToken, sale(1, "10.00")).statusCode());
        String historico = call("GET", "/api/vendas", outroToken, null).body();
        assertTrue(historico.contains("nomeCategoria"));
        assertEquals(200, call("DELETE", "/api/usuarios/" + admin.getId(), outroToken, null).statusCode());
        assertFalse(usuarios.findById(admin.getId()).orElseThrow().isAtivo());
        assertEquals(401, call("GET", "/api/vendas", adminToken, null).statusCode());
        assertEquals(historico, call("GET", "/api/vendas", outroToken, null).body());
        assertEquals(admin.getId(), vendas.findByEmpresaId(empresa.getId()).getFirst().getUsuario().getId());
        assertEquals(400, call("DELETE", "/api/usuarios/" + outroAdmin.getId(), outroToken, null).statusCode());
        assertEquals(200, call("DELETE", "/api/usuarios/" + colaborador.getId(), outroToken, null).statusCode());
        assertEquals(1, json.readTree(call("GET", "/api/usuarios", outroToken, null).body()).size());
        assertEquals(401, call("GET", "/api/vendas", colaboradorToken, null).statusCode());
        assertEquals(204, call("DELETE", "/api/produtos/" + produto.getId(), outroToken, null).statusCode());
        assertEquals(historico, call("GET", "/api/vendas", outroToken, null).body());
    }

    @Test void concurrentAdminDeletionsKeepOneActiveAdmin() throws Exception {
        Usuario outroAdmin = user("ADMIN");
        String outroToken = tokens.gerarToken(outroAdmin);
        var inicio = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> { inicio.await(); return call("DELETE", "/api/usuarios/" + admin.getId(), outroToken, null).statusCode(); });
            var b = executor.submit(() -> { inicio.await(); return call("DELETE", "/api/usuarios/" + outroAdmin.getId(), adminToken, null).statusCode(); });
            inicio.countDown();
            var respostas = List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
            assertEquals(1, respostas.stream().filter(c -> c == 200).count());
            assertEquals(1, usuarios.countByEmpresaIdAndPerfilAndAtivoTrue(empresa.getId(), "ADMIN"));
        }
    }

    @Test void anonymousAndInvalidTokenAreRejected() throws Exception {
        assertEquals(401, call("GET", "/api/produtos", null, null).statusCode());
        assertEquals(401, call("GET", "/api/produtos", "forged-token", null).statusCode());
    }

    @Test void unitRankingUsesTenantSalesAndRefreshesAfterNewSales() throws Exception {
        produto.setEstoque(20); produtos.save(produto);
        Empresa outra = empresas.save(new Empresa("Outra loja", "ranking-" + empresa.getId()));
        Produto externo = new Produto(); externo.setId("9999999999"); externo.setIdInterno(outra.getId() + "-9999999999");
        externo.setEmpresa(outra); externo.setNome("Produto sigiloso de outra loja"); externo.setPreco(10.0); externo.setEstoque(100);
        produtos.save(externo);
        Venda venda = new Venda(); venda.setEmpresa(outra); venda.setFormaPagamento("PIX"); venda.setTotal(new java.math.BigDecimal("990"));
        ItemVenda item = new ItemVenda(); item.setVenda(venda); item.setProduto(externo); item.setQuantidade(99);
        item.setPrecoUnitario(java.math.BigDecimal.TEN); item.setSubtotal(new java.math.BigDecimal("990"));
        venda.setItens(List.of(item)); vendas.save(venda);
        String path = "/api/tendencias/curva-fluxo?empresaId=" + outra.getId();
        assertEquals(0, json.readTree(call("GET", path, adminToken, null).body()).path("rankingQuantidade").path("totalUnidades").asLong());
        assertEquals(201, call("POST", "/api/vendas", adminToken, sale(2, "20")).statusCode());
        var primeiro = call("GET", path, adminToken, null);
        assertEquals(200, primeiro.statusCode());
        assertEquals(2, json.readTree(primeiro.body()).path("rankingQuantidade").path("produtos").get(0).path("quantidade").asLong());
        assertFalse(primeiro.body().contains("sigiloso"));
        assertEquals(201, call("POST", "/api/vendas", adminToken, sale(1, "10")).statusCode());
        var atualizado = json.readTree(call("GET", path, adminToken, null).body()).path("rankingQuantidade");
        assertEquals(3, atualizado.path("totalUnidades").asLong());
        var consulta = call("GET", "/api/agente/consultas/mais-vendidos?empresaId=" + outra.getId(), adminToken, null);
        assertEquals(200, consulta.statusCode()); assertTrue(consulta.body().contains("3 unidades")); assertFalse(consulta.body().contains("sigiloso"));
        assertEquals(401, call("GET", "/api/agente/consultas/mais-vendidos", null, null).statusCode());
        assertEquals(403, call("GET", "/api/agente/consultas/mais-vendidos", colaboradorToken, null).statusCode());
    }

    @Test void quickQueriesUseAuthenticatedTenantAndKeepAdministrativePermissions() throws Exception {
        Empresa other = empresas.save(new Empresa("Outra loja", "consulta-" + empresa.getId()));
        Produto foreign = new Produto(); foreign.setId("7777777777");
        foreign.setIdInterno(other.getId() + "-7777777777"); foreign.setEmpresa(other);
        foreign.setNome("Produto sigiloso de outra empresa"); foreign.setPreco(5.0); foreign.setEstoque(8);
        produtos.save(foreign);
        var response = call("GET", "/api/agente/consultas/estoque?empresaId=" + other.getId(), adminToken, null);
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("Produto"));
        assertFalse(response.body().contains("sigiloso"));
        assertEquals(401, call("GET", "/api/agente/consultas/estoque", null, null).statusCode());
        assertEquals(403, call("GET", "/api/agente/consultas/estoque", colaboradorToken, null).statusCode());
        assertEquals(400, call("GET", "/api/agente/consultas/desconhecida", adminToken, null).statusCode());
    }

    @Test void telegramLookupAcceptsFormattedCpfAndCnpjWithoutMixingCompanies() {
        empresa.setCnpj("12.345.678/0001-99"); empresas.save(empresa);
        admin.setCpf("123.456.789-00"); admin.setSenha(senhas.encode("senha!")); usuarios.save(admin);
        assertEquals(admin.getId(), acessoConta.autenticar("12345678900", "12345678000199", "senha!").usuario().getId());
        assertNull(acessoConta.autenticar("12345678900", "99999999000199", "senha!").usuario());
    }

    @Test void typedCommandsUseTenantQueriesWithoutCallingAi() throws Exception {
        for (String comando : List.of("/estoque", " /ESTOQUE ", "/alerta", "/promocoes", "/ajuda", "/equipe", "/mais-vendidos", "/ranking", "/insights")) {
            var response = call("POST", "/api/agente/perguntar", adminToken,
                    json.writeValueAsString(Map.of("pergunta", comando)));
            assertEquals(200, response.statusCode(), comando);
            assertTrue(json.readTree(response.body()).get("resposta").isTextual(), comando);
            assertFalse(response.body().contains("não foi configurad"), comando);
            assertFalse(response.body().contains("Por favor, pergunte"), comando);
        }
        assertEquals(400, call("POST", "/api/agente/perguntar", adminToken,
                json.writeValueAsString(Map.of("pergunta", "/comando_inexistente"))).statusCode());
        assertEquals(401, call("POST", "/api/agente/perguntar", null,
                json.writeValueAsString(Map.of("pergunta", "/estoque"))).statusCode());
        assertEquals(403, call("POST", "/api/agente/perguntar", colaboradorToken,
                json.writeValueAsString(Map.of("pergunta", "/estoque"))).statusCode());
    }

    @Test void collaboratorCannotUseAdministrativeEndpoints() throws Exception {
        for (String path : List.of("/api/usuarios", "/api/vendas", "/api/eventos", "/api/tendencias/trafego"))
            assertEquals(403, call("GET", path, colaboradorToken, null).statusCode(), path);
        assertEquals(403, call("POST", "/api/empresas/limpar-estoque", colaboradorToken, "{}").statusCode());
        assertEquals(403, call("DELETE", "/api/empresas/encerrar-conta", colaboradorToken, null).statusCode());
        assertEquals(403, call("POST", "/api/usuarios", colaboradorToken, "{}").statusCode());
        assertEquals(200, call("GET", "/api/produtos", colaboradorToken, null).statusCode());
    }

    @Test void tenantIsolationAndPasswordSecrecy() throws Exception {
        Empresa other = empresas.save(new Empresa("Outra", "outra-" + empresa.getId()));
        Categoria foreign = new Categoria("Outra " + empresa.getId()); foreign.setEmpresa(other); foreign = categorias.save(foreign);
        var response = call("GET", "/api/usuarios", adminToken, null);
        assertEquals(200, response.statusCode());
        assertFalse(response.body().contains("senha")); assertFalse(response.body().contains("hash-nao"));
        String body = "{\"id\":\"9999999999\",\"nome\":\"Intruso\",\"preco\":10,\"estoque\":1,\"categoria\":{\"id\":" + foreign.getId() + "}}";
        assertEquals(400, call("POST", "/api/produtos", adminToken, body).statusCode());
        assertEquals(404, call("DELETE", "/api/categorias/" + foreign.getId(), adminToken, null).statusCode());
    }

    @Test void suppliedEventIdCannotOverwriteAnotherTenant() throws Exception {
        Empresa other = empresas.save(new Empresa("Outra", "evento-" + empresa.getId()));
        Evento event = new Evento("Original", "2026-11-05", "12:00", "Original"); event.setEmpresa(other); event = eventos.save(event);
        String body = "{\"id\":" + event.getId() + ",\"titulo\":\"Novo\",\"data\":\"2026-11-06\",\"hora\":\"12:00\",\"descricao\":\"Teste\"}";
        assertEquals(201, call("POST", "/api/eventos", adminToken, body).statusCode());
        assertEquals("Original", eventos.findById(event.getId()).orElseThrow().getTitulo());
    }

    @Test void tamperedTotalAndNegativeQuantitiesDoNotChangeStock() throws Exception {
        assertEquals(400, call("POST", "/api/vendas", colaboradorToken, sale(1, "0.01")).statusCode());
        assertEquals(400, call("POST", "/api/vendas", colaboradorToken, sale(-1, "-10")).statusCode());
        assertEquals(1, produtos.findById(produto.getIdInterno()).orElseThrow().getEstoque());
        assertTrue(vendas.findByEmpresaId(empresa.getId()).isEmpty());
    }

    @Test void serverSetsOperatorAndPrice() throws Exception {
        assertEquals(201, call("POST", "/api/vendas", colaboradorToken, sale(1, "10.00")).statusCode());
        var saved = vendas.findByEmpresaId(empresa.getId()).getFirst();
        assertEquals(colaborador.getId(), saved.getUsuario().getId());
        assertEquals(0, saved.getItens().getFirst().getPrecoUnitario().compareTo(new java.math.BigDecimal("10.00")));
        assertEquals(0, produtos.findById(produto.getIdInterno()).orElseThrow().getEstoque());
    }

    @Test void dashboardAtualizaAposVendaMesmoComCachePreenchido() throws Exception {
        var antes = call("GET", "/api/vendas", adminToken, null);
        assertEquals(200, antes.statusCode()); assertEquals(0, json.readTree(antes.body()).size());
        var inicio = java.time.LocalDateTime.now(java.time.ZoneId.of("America/Sao_Paulo")).minusSeconds(1);
        assertEquals(201, call("POST", "/api/vendas", colaboradorToken, sale(1, "10.00")).statusCode());
        var depois = call("GET", "/api/vendas", adminToken, null);
        assertEquals(200, depois.statusCode());
        var lista = json.readTree(depois.body()); assertEquals(1, lista.size());
        assertEquals(10.0, lista.get(0).get("total").asDouble());
        assertEquals(1, lista.get(0).get("itens").size());
        var data = java.time.LocalDateTime.parse(lista.get(0).get("dataVenda").asText());
        assertFalse(data.isBefore(inicio));
        assertFalse(data.isAfter(java.time.LocalDateTime.now(java.time.ZoneId.of("America/Sao_Paulo")).plusSeconds(1)));
        var novamente = call("GET", "/api/vendas", adminToken, null);
        assertEquals(lista, json.readTree(novamente.body()));
    }

    @Test void concurrentCheckoutsCannotSellSameLastUnit() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> task = () -> call("POST", "/api/vendas", colaboradorToken, sale(1, "10.00")).statusCode();
            var results = executor.invokeAll(List.of(task, task));
            var statuses = new ArrayList<Integer>();
            for (var result : results) statuses.add(result.get());
            Collections.sort(statuses);
            assertEquals(List.of(201, 400), statuses);
        }
        assertEquals(1, vendas.findByEmpresaId(empresa.getId()).size());
        assertEquals(0, produtos.findById(produto.getIdInterno()).orElseThrow().getEstoque());
    }

    @Test void registrationRejectsWeakPassword() throws Exception {
        var response = call("POST", "/api/registro", null,
            "{\"nomeEmpresa\":\"Teste\",\"cnpj\":\"123\",\"nomeAdmin\":\"Admin\",\"cpfAdmin\":\"123\",\"senhaAdmin\":\"123\"}");
        assertEquals(400, response.statusCode());
    }
    @Test void signedUploadsRequireAdministrator() throws Exception {
        assertEquals(401, call("POST", "/api/uploads/assinatura", null, "{}").statusCode());
        assertEquals(403, call("POST", "/api/uploads/assinatura", colaboradorToken, "{}").statusCode());
        assertEquals(503, call("POST", "/api/uploads/assinatura", adminToken, "{}").statusCode());
    }

    @Test void sameCategoryNameCanExistInDifferentCompanies() {
        Empresa other = empresas.save(new Empresa("Outra", "categoria-" + empresa.getId()));
        Categoria cat = new Categoria(produto.getCategoria().getNome()); cat.setEmpresa(other);
        assertNotNull(categorias.saveAndFlush(cat).getId());
    }

    @Test void categoryWithStockCanBeDeletedById() throws Exception {
        assertEquals(204, call("DELETE", "/api/categorias/" + produto.getCategoria().getId(), adminToken, null).statusCode());
        assertFalse(categorias.findById(produto.getCategoria().getId()).orElseThrow().isAtivo());
        assertFalse(produtos.findByIdAndEmpresaId(produto.getId(), empresa.getId()).orElseThrow().isAtivo());
    }

    @Test void registrationAndLoginUseRealPasswordHashing() throws Exception {
        String cpf = "login-" + empresa.getId();
        String cnpj = "login-company-" + empresa.getId();
        var body = Map.of("nomeEmpresa", "Nova empresa", "cnpj", cnpj, "nomeAdmin", "Admin",
                "cpfAdmin", cpf, "senhaAdmin", "senha-teste-forte-123");
        assertEquals(201, call("POST", "/api/registro", null, json.writeValueAsString(body)).statusCode());
        var login = Map.of("cpf", cpf, "cnpj", cnpj, "senha", "senha-teste-forte-123");
        var response = call("POST", "/api/login", null, json.writeValueAsString(login));
        assertEquals(200, response.statusCode());
        String token = json.readTree(response.body()).path("token").asText();
        assertEquals(200, call("GET", "/api/produtos", token, null).statusCode());
        var decoded = com.auth0.jwt.JWT.decode(token);
        long remaining = decoded.getExpiresAtAsInstant().getEpochSecond() - java.time.Instant.now().getEpochSecond();
        assertTrue(remaining > 7100 && remaining <= 7200);
    }

    @Test void cotaCadastroConsultaEVendaFuncionamPorHttpParaColaborador() throws Exception {
        String body = json.writeValueAsString(Map.of("id", "2121212121", "nome", "Torrada", "preco", 29.90,
                "estoque", 0, "tipoEstoque", "COTA_TEMPO", "limiteCota", 5, "intervaloCotaMinutos", 3,
                "categoria", Map.of("id", produto.getCategoria().getId())));
        var criado = call("POST", "/api/produtos", adminToken, body);
        assertEquals(201, criado.statusCode(), criado.body());
        var dados = json.readTree(criado.body());
        assertEquals("COTA_TEMPO", dados.path("tipoEstoque").asText(), criado.body());
        assertEquals(5, dados.path("quantidadeDisponivel").asInt(), criado.body());
        // A edição real devolve o JSON inteiro, incluindo os campos somente leitura.
        assertEquals(200, call("PUT", "/api/produtos/2121212121", adminToken, criado.body()).statusCode());
        var salvo = produtos.findByIdAndEmpresaId("2121212121", empresa.getId()).orElseThrow();
        assertEquals(TipoEstoque.COTA_TEMPO, salvo.getTipoEstoque());
        assertEquals(5, salvo.getLimiteCota()); assertEquals(3, salvo.getIntervaloCotaMinutos());
        for (var token : List.of(adminToken, colaboradorToken)) {
            var consulta = call("GET", "/api/produtos/catalogo/2121212121", token, null);
            assertEquals(200, consulta.statusCode(), consulta.body());
            assertEquals(5, json.readTree(consulta.body()).path("quantidadeDisponivel").asInt());
        }
        var venda = json.writeValueAsString(Map.of("formaPagamento", "PIX", "total", 149.50,
                "itens", List.of(Map.of("produtoId", "2121212121", "quantidade", 5))));
        assertEquals(201, call("POST", "/api/vendas", colaboradorToken, venda).statusCode());
        assertEquals(400, call("POST", "/api/vendas", colaboradorToken, venda).statusCode());
        assertEquals(200, call("GET", "/api/empresas/minha-empresa", colaboradorToken, null).statusCode());
        var consulta = call("GET", "/api/produtos/catalogo/2121212121", colaboradorToken, null);
        assertEquals(200, consulta.statusCode()); assertEquals(0, json.readTree(consulta.body()).path("quantidadeDisponivel").asInt());
    }

    @Test void validadePersisteNoJsonENoBancoEProdutoVencidoRetorna404SemInvalidarSessao() throws Exception {
        String validade = java.time.Instant.now().plusSeconds(3600).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString();
        var body = json.writeValueAsString(Map.of("nome", "Cookies", "preco", 15.90, "estoque", 4,
                "tipoEstoque", "VALIDADE", "validadeComercial", validade,
                "categoria", Map.of("id", produto.getCategoria().getId())));
        assertEquals(200, call("PUT", "/api/produtos/1234567890", adminToken, body).statusCode());
        var consulta = call("GET", "/api/produtos/catalogo/1234567890", colaboradorToken, null);
        assertEquals(200, consulta.statusCode(), consulta.body());
        var dados = json.readTree(consulta.body()); assertEquals("VALIDADE", dados.path("tipoEstoque").asText());
        assertEquals(java.time.Instant.parse(validade), java.time.Instant.parse(dados.path("validadeComercial").asText()));
        assertEquals(4, dados.path("quantidadeDisponivel").asInt());
        var salvo = produtos.findByIdAndEmpresaId("1234567890", empresa.getId()).orElseThrow();
        salvo.setValidadeComercial(java.time.Instant.now().minusSeconds(1)); produtos.save(salvo);
        assertEquals(404, call("GET", "/api/produtos/catalogo/1234567890", colaboradorToken, null).statusCode());
        assertEquals(404, call("GET", "/api/produtos/catalogo/9999999999", colaboradorToken, null).statusCode());
        assertEquals(200, call("GET", "/api/empresas/minha-empresa", colaboradorToken, null).statusCode());
        assertEquals(401, call("GET", "/api/produtos/catalogo/1234567890", "forged-token", null).statusCode());
        var recursos = call("GET", "/api/produtos/recursos", colaboradorToken, null);
        assertEquals(200, recursos.statusCode()); assertEquals(1, json.readTree(recursos.body()).path("versaoControleEstoque").asInt());
    }

}
