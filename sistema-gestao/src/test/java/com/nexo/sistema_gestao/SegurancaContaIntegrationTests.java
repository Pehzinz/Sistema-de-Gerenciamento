package com.nexo.sistema_gestao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexo.sistema_gestao.model.Empresa;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.EmpresaRepository;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:seguranca-conta;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
        "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
        "api.security.token.secret=isolated-tests-only-0123456789abcdef0123456789",
        "telegrambots.enabled=false", "server.forward-headers-strategy=none"
})
class SegurancaContaIntegrationTests {
    private static final String SENHA = "senha!";
    private static final Instant AGORA = Instant.parse("2026-11-11T14:00:00Z");
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();
    @Autowired Environment ambiente;
    @Autowired UsuarioRepository usuarios;
    @Autowired EmpresaRepository empresas;
    @Autowired PasswordEncoder senhas;
    @MockitoBean Clock clock;

    @BeforeEach void configurar() {
        when(clock.instant()).thenReturn(AGORA);
    }

    @Test void bloqueiaNaQuintaFalhaSemProrrogarBloqueioOuAfetarOutraEmpresa() throws Exception {
        String cpf = "222.333.444-55";
        var alvo = empresas.save(new Empresa("Loja A", "11.111.111/0001-10"));
        var outra = empresas.save(new Empresa("Loja B", "22.222.222/0001-20"));
        cadastrar(alvo, cpf, "ADMIN");
        cadastrar(outra, cpf, "ADMIN");
        for (int i = 0; i < 4; i++) {
            assertEquals(401, login(cpf, alvo.getCnpj(), "errada").statusCode());
        }
        var bloqueio = login("22233344455", "11111111000110", "errada");
        assertEquals(429, bloqueio.statusCode());
        assertEquals("900", bloqueio.headers().firstValue("Retry-After").orElseThrow());
        when(clock.instant()).thenReturn(AGORA.plusSeconds(899));
        assertEquals("1", login(cpf, alvo.getCnpj(), SENHA).headers().firstValue("Retry-After").orElseThrow());
        assertEquals(200, login(cpf, outra.getCnpj(), SENHA).statusCode());
        when(clock.instant()).thenReturn(AGORA.plusSeconds(900));
        assertEquals(401, login(cpf, alvo.getCnpj(), "errada").statusCode());
        assertEquals(200, login(cpf, alvo.getCnpj(), SENHA).statusCode());
    }

    @Test void edicaoDeColaboradorRespeitaEmpresaPerfilESessoes() throws Exception {
        var empresa = empresas.save(new Empresa("Equipe", "33.333.333/0001-30"));
        var outra = empresas.save(new Empresa("Externa", "44.444.444/0001-40"));
        var admin = cadastrar(empresa, "333.444.555-66", "ADMIN");
        var colaborador = cadastrar(empresa, "444.555.666-77", "COLABORADOR");
        var externo = cadastrar(outra, "555.666.777-88", "COLABORADOR");
        externo.setEmail("externo@example.com");
        usuarios.save(externo);
        String sessaoAdmin = token(login(admin.getCpf(), empresa.getCnpj(), SENHA));
        String sessaoColaborador = token(login(colaborador.getCpf(), empresa.getCnpj(), SENHA));
        String caminho = "/api/usuarios/" + colaborador.getId();
        var dados = Map.of("nomeCompleto", colaborador.getNomeCompleto(), "senha", "nova12");
        assertEquals(403, chamar("PUT", caminho, sessaoColaborador, dados).statusCode());
        assertEquals(404, chamar("PUT", "/api/usuarios/" + externo.getId(), sessaoAdmin, dados).statusCode());
        assertEquals(403, chamar("POST", caminho + "/autorizar-edicao",
                sessaoColaborador, Map.of("senha", SENHA)).statusCode());
        var autorizacaoExterna = chamar("POST", "/api/usuarios/" + externo.getId() + "/autorizar-edicao",
                sessaoAdmin, Map.of("senha", SENHA));
        assertEquals(404, autorizacaoExterna.statusCode());
        assertFalse(autorizacaoExterna.body().contains("externo@example.com"));
        String autorizacao = autorizarEdicao(sessaoAdmin, colaborador.getId());
        assertEquals(200, chamar("PUT", caminho, sessaoAdmin, Map.of("nomeCompleto", "Colaborador editado",
                "autorizacaoEdicao", autorizacao)).statusCode());
        var editado = usuarios.findById(colaborador.getId()).orElseThrow();
        assertEquals("Colaborador editado", editado.getNomeCompleto());
        assertEquals(colaborador.getSenha(), editado.getSenha());
        assertEquals(200, chamar("PUT", caminho, sessaoAdmin, Map.of("nomeCompleto", editado.getNomeCompleto(),
                "senha", "nova12", "autorizacaoEdicao", autorizacao)).statusCode());
        assertEquals(401, chamar("GET", "/api/empresas/minha-empresa", sessaoColaborador, null).statusCode());
        assertEquals(200, login(colaborador.getCpf(), empresa.getCnpj(), "nova12").statusCode());
    }

    @Test void edicaoDeAdministradorExigeAutorizacaoDoGestor() throws Exception {
        var empresa = empresas.save(new Empresa("Equipe administrativa", "66.666.666/0001-60"));
        var gestor = cadastrar(empresa, "777.888.999-00", "ADMIN");
        String sessao = token(login(gestor.getCpf(), empresa.getCnpj(), SENHA));
        var cadastro = chamar("POST", "/api/usuarios", sessao, Map.of("nomeCompleto", "Novo administrador",
                "cpf", "999.000.111-22", "perfil", "ADMIN", "senha", "alvo12", "email", "  admin@example.com  "));
        assertEquals(201, cadastro.statusCode(), cadastro.body());
        long id = json.readTree(cadastro.body()).path("id").asLong();
        String rota = "/api/usuarios/" + id;
        assertEquals(403, chamar("PUT", rota, sessao, Map.of("nomeCompleto", "Alterado")).statusCode());
        assertEquals(400, chamar("POST", rota + "/autorizar-edicao", sessao,
                Map.of("senha", "alvo12")).statusCode());
        var conta = usuarios.findById(id).orElseThrow();
        assertEquals("Novo administrador", conta.getNomeCompleto());
        assertEquals("admin@example.com", conta.getEmail());
        assertFalse(chamar("GET", "/api/usuarios", sessao, null).body().contains("admin@example.com"));
        var respostaAutorizacao = chamar("POST", rota + "/autorizar-edicao", sessao, Map.of("senha", SENHA));
        assertEquals(200, respostaAutorizacao.statusCode(), respostaAutorizacao.body());
        var dadosEdicao = json.readTree(respostaAutorizacao.body());
        assertEquals("admin@example.com", dadosEdicao.path("email").asText());
        String autorizacao = dadosEdicao.path("autorizacaoEdicao").asText();
        assertEquals(401, chamar("GET", "/api/usuarios", autorizacao, null).statusCode());
        assertEquals(403, chamar("PUT", "/api/usuarios/" + gestor.getId(), sessao,
                Map.of("nomeCompleto", "Alterado", "autorizacaoEdicao", autorizacao)).statusCode());
        assertEquals(200, chamar("PUT", rota, sessao,
                Map.of("nomeCompleto", "Alterado", "autorizacaoEdicao", autorizacao)).statusCode());
        assertEquals("admin@example.com", usuarios.findById(id).orElseThrow().getEmail());
        assertEquals(400, chamar("PUT", rota, sessao,
                Map.of("nomeCompleto", "Alterado", "email", "inválido", "autorizacaoEdicao", autorizacao)).statusCode());
        assertEquals(200, chamar("PUT", rota, sessao,
                Map.of("nomeCompleto", "Alterado", "email", "novo@example.com", "autorizacaoEdicao", autorizacao)).statusCode());
        var editado = usuarios.findById(id).orElseThrow();
        assertEquals("Alterado", editado.getNomeCompleto());
        assertEquals("novo@example.com", editado.getEmail());
        assertEquals(conta.getSenha(), editado.getSenha());
        assertEquals(200, chamar("PUT", rota, sessao,
                Map.of("nomeCompleto", "Alterado", "email", "", "autorizacaoEdicao", autorizacao)).statusCode());
        assertNull(usuarios.findById(id).orElseThrow().getEmail());
    }

    private Usuario cadastrar(Empresa empresa, String cpf, String perfil) {
        Usuario usuario = new Usuario();
        usuario.setEmpresa(empresa);
        usuario.setCpf(cpf);
        usuario.setNomeCompleto(perfil);
        usuario.setPerfil(perfil);
        usuario.setSenha(senhas.encode(SENHA));
        return usuarios.save(usuario);
    }

    private String token(HttpResponse<String> resposta) throws Exception {
        assertEquals(200, resposta.statusCode(), resposta.body());
        return json.readTree(resposta.body()).path("token").asText();
    }

    private HttpResponse<String> login(String cpf, String cnpj, String senha) throws Exception {
        return chamar("POST", "/api/login", null, Map.of("cpf", cpf, "cnpj", cnpj, "senha", senha));
    }

    private String autorizarEdicao(String sessao, long usuarioId) throws Exception {
        var resposta = chamar("POST", "/api/usuarios/" + usuarioId + "/autorizar-edicao", sessao,
                Map.of("senha", SENHA));
        assertEquals(200, resposta.statusCode(), resposta.body());
        return json.readTree(resposta.body()).path("autorizacaoEdicao").asText();
    }

    private HttpResponse<String> chamar(String metodo, String rota, String token, Map<String, String> dados) throws Exception {
        return http.send(pedido(metodo, rota, token, dados), HttpResponse.BodyHandlers.ofString());
    }

    private HttpRequest pedido(String metodo, String rota, String token, Map<String, String> dados) throws Exception {
        var uri = URI.create("http://localhost:" + ambiente.getProperty("local.server.port") + rota);
        var builder = HttpRequest.newBuilder(uri).header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return builder.method(metodo, dados == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(dados))).build();
    }
}
