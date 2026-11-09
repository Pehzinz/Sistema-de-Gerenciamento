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
        admin.setCpf("123.456.789-00"); usuarios.save(admin);
        assertEquals(admin.getId(), usuarios.findByCredenciaisTelegram("12345678900", "12345678000199").orElseThrow().getId());
        assertTrue(usuarios.findByCredenciaisTelegram("12345678900", "99999999000199").isEmpty());
    }

    @Test void typedCommandsUseTenantQueriesWithoutCallingAi() throws Exception {
        for (String comando : List.of("/estoque", " /ESTOQUE ", "/alerta", "/promocoes", "/ajuda", "/equipe")) {
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
