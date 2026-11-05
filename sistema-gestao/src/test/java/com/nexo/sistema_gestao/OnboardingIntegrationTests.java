package com.nexo.sistema_gestao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.security.TokenService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.net.URI;
import java.net.http.*;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:onboarding;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "api.security.token.secret=isolated-tests-only-0123456789abcdef0123456789",
    "telegrambots.enabled=false", "server.forward-headers-strategy=none"
})
@Import(OnboardingIntegrationTests.ErrorTestConfiguration.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class OnboardingIntegrationTests {
    @Autowired Environment environment;
    @Autowired UsuarioRepository usuarios;
    @Autowired TokenService tokens;
    @Autowired JdbcTemplate jdbc;
    final ObjectMapper json = new ObjectMapper();
    final HttpClient http = HttpClient.newHttpClient();

    String registration() throws Exception {
        return json.writeValueAsString(Map.of("nomeEmpresa", "Demonstração", "cnpj", "12.345.678/0001-99",
                "nomeAdmin", "Administrador", "cpfAdmin", "111.222.333-44", "senhaAdmin", "senha-forte-teste-123"));
    }

    HttpResponse<String> post(String path, String body) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(base() + path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
    String base() { return "http://localhost:" + environment.getProperty("local.server.port"); }

    @Test @Order(1) void firstCompanyCanRegisterAndLoginInAnEmptyDatabase() throws Exception {
        assertEquals(0, usuarios.count());
        assertEquals(201, post("/api/registro", registration()).statusCode());
        var login = post("/api/login", json.writeValueAsString(Map.of("cpf", "111.222.333-44", "senha", "senha-forte-teste-123")));
        assertEquals(200, login.statusCode());
        assertFalse(json.readTree(login.body()).path("token").asText().isBlank());
    }

    @Test @Order(2) void missingTableIsReportedAsDatabaseFailureInsteadOfUnauthorized() throws Exception {
        // Apenas o H2 isolado do teste: simula tabela removida com o servidor já em execução.
        jdbc.execute("ALTER TABLE usuarios RENAME TO usuarios_indisponiveis");
        try {
            for (var response : java.util.List.of(
                    post("/api/login", "{\"cpf\":\"111.222.333-44\",\"senha\":\"senha-forte-teste-123\"}"),
                    post("/api/registro", registration().replace("12.345.678/0001-99", "98.765.432/0001-88")))) {
                assertEquals(503, response.statusCode());
                assertTrue(json.readTree(response.body()).path("erro").asText().contains("banco de dados"));
                assertFalse(response.body().contains("usuarios_indisponiveis"));
                assertFalse(response.body().contains("jdbc:"));
            }
        } finally { jdbc.execute("ALTER TABLE usuarios_indisponiveis RENAME TO usuarios"); }
    }

    @Test @Order(3) void internalErrorDispatchPreserves500WithoutOpeningProtectedUrls() throws Exception {
        var user = usuarios.findByCpf("111.222.333-44").getFirst();
        var response = http.send(HttpRequest.newBuilder(URI.create(base() + "/api/produtos/erro-diagnostico"))
                .header("Authorization", "Bearer " + tokens.gerarToken(user)).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(500, response.statusCode());
        assertEquals(500, json.readTree(response.body()).path("status").asInt());
        var direct = http.send(HttpRequest.newBuilder(URI.create(base() + "/error")).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(401, direct.statusCode());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ErrorTestConfiguration {
        @Bean ErrorEndpoint errorEndpoint() { return new ErrorEndpoint(); }
    }
    @RestController
    static class ErrorEndpoint {
        @GetMapping("/api/produtos/erro-diagnostico")
        void fail(HttpServletResponse response) throws java.io.IOException { response.sendError(500); }
    }
}
