package com.nexo.sistema_gestao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexo.sistema_gestao.model.Empresa;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.EmpresaRepository;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.service.EmailContaService;
import com.nexo.sistema_gestao.service.RecuperacaoContaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

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
    @Autowired RecuperacaoContaService recuperacao;
    @MockitoBean EmailContaService emails;
    @MockitoBean Clock clock;

    @BeforeEach void configurar() {
        when(emails.configurado()).thenReturn(true);
        when(clock.instant()).thenReturn(AGORA);
    }

    @Test void confirmaEmailDaContaEConsomeLinkDeRecuperacaoUmaVez() throws Exception {
        String cpf = "111.222.333-44";
        String cnpj = "12.345.678/0001-99";
        String email = "admin@example.com";
        assertEquals(201, chamar("POST", "/api/registro", null, Map.of("nomeEmpresa", "Empresa A", "cnpj", cnpj,
                "nomeAdmin", "Admin A", "cpfAdmin", cpf, "senhaAdmin", SENHA, "emailAdmin", email)).statusCode());
        String sessaoAnterior = token(login(cpf, cnpj, SENHA));
        var busca = Map.of("cpf", "11122233344", "cnpj", "12345678000199", "email", "ADMIN@example.com");
        var emailDiferente = chamar("POST", "/api/recuperar-senha", null, Map.of(
                "cpf", cpf, "cnpj", cnpj, "email", "outro@example.com"));
        assertEquals(202, emailDiferente.statusCode());
        verify(emails, never()).enviarLink(any(), anyString(), anyString(), anyString(), eq("/recuperar-senha"), anyString());
        var conhecido = chamar("POST", "/api/recuperar-senha", null, busca);
        assertEquals(202, conhecido.statusCode());
        String confirmar = link(email, "/confirmar-email");
        assertEquals(204, chamar("POST", "/api/confirmar-email", null, Map.of("token", confirmar)).statusCode());
        assertEquals(400, chamar("POST", "/api/confirmar-email", null, Map.of("token", confirmar)).statusCode());
        assertEquals(email, json.readTree(chamar("GET", "/api/usuarios/meu-email", sessaoAnterior, null).body())
                .path("emailVerificado").asText());
        assertFalse(chamar("GET", "/api/usuarios", sessaoAnterior, null).body().contains(email));

        var outra = empresas.save(new Empresa("Empresa B", "98.765.432/0001-22"));
        cadastrar(outra, cpf, "ADMIN", "outro@example.com");
        var desconhecido = chamar("POST", "/api/recuperar-senha", null,
                Map.of("cpf", cpf, "cnpj", outra.getCnpj(), "email", email));
        assertEquals(conhecido.body(), desconhecido.body());
        assertEquals(conhecido.body(), emailDiferente.body());
        String recuperar = link(email, "/recuperar-senha");
        verify(emails, never()).enviarLink(any(), eq("outro@example.com"), anyString(), anyString(), anyString(), anyString());
        assertEquals(400, chamar("POST", "/api/redefinir-senha", null, Map.of("token", recuperar, "senha", "12345")).statusCode());

        var redefinicao = pedido("POST", "/api/redefinir-senha", null, Map.of("token", recuperar, "senha", "nova12"));
        var primeira = http.sendAsync(redefinicao, HttpResponse.BodyHandlers.ofString());
        var segunda = http.sendAsync(redefinicao, HttpResponse.BodyHandlers.ofString());
        CompletableFuture.allOf(primeira, segunda).join();
        assertEquals(List.of(204, 400), List.of(primeira.join().statusCode(), segunda.join().statusCode()).stream().sorted().toList());
        assertEquals(401, chamar("GET", "/api/usuarios/meu-email", sessaoAnterior, null).statusCode());
        assertEquals(401, login(cpf, cnpj, SENHA).statusCode());
        assertEquals(200, login(cpf, cnpj, "nova12").statusCode());
        assertEquals(200, login(cpf, outra.getCnpj(), SENHA).statusCode());
        verify(emails).avisarSenhaAlterada(argThat(u -> email.equals(u.getEmailVerificado())));
    }

    @Test void bloqueiaNaQuintaFalhaSemProrrogarBloqueioOuAfetarOutraEmpresa() throws Exception {
        String cpf = "222.333.444-55";
        var alvo = empresas.save(new Empresa("Loja A", "11.111.111/0001-10"));
        var outra = empresas.save(new Empresa("Loja B", "22.222.222/0001-20"));
        cadastrar(alvo, cpf, "ADMIN", "alvo@example.com");
        cadastrar(outra, cpf, "ADMIN", null);
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
        verify(emails).avisarBloqueio(argThat(u -> u.getEmpresa().getId().equals(alvo.getId())));
    }

    @Test void edicaoDeColaboradorRespeitaEmpresaPerfilESessoes() throws Exception {
        var empresa = empresas.save(new Empresa("Equipe", "33.333.333/0001-30"));
        var outra = empresas.save(new Empresa("Externa", "44.444.444/0001-40"));
        var admin = cadastrar(empresa, "333.444.555-66", "ADMIN", null);
        var colaborador = cadastrar(empresa, "444.555.666-77", "COLABORADOR", null);
        var externo = cadastrar(outra, "555.666.777-88", "COLABORADOR", null);
        String sessaoAdmin = token(login(admin.getCpf(), empresa.getCnpj(), SENHA));
        String sessaoColaborador = token(login(colaborador.getCpf(), empresa.getCnpj(), SENHA));
        String caminho = "/api/usuarios/" + colaborador.getId();
        var dados = Map.of("nomeCompleto", colaborador.getNomeCompleto(), "senha", "nova12");
        assertEquals(403, chamar("PUT", caminho, sessaoColaborador, dados).statusCode());
        assertEquals(404, chamar("PUT", "/api/usuarios/" + externo.getId(), sessaoAdmin, dados).statusCode());
        assertEquals(200, chamar("PUT", caminho, sessaoAdmin, dados).statusCode());
        assertEquals(401, chamar("GET", "/api/empresas/minha-empresa", sessaoColaborador, null).statusCode());
        assertEquals(200, login(colaborador.getCpf(), empresa.getCnpj(), "nova12").statusCode());
    }

    @Test void administradorExistentePodeCadastrarEmailERecuperacaoExpiraEmTrintaMinutos() throws Exception {
        var empresa = empresas.save(new Empresa("Loja existente", "55.555.555/0001-50"));
        var admin = cadastrar(empresa, "666.777.888-99", "ADMIN", null);
        String sessao = token(login(admin.getCpf(), empresa.getCnpj(), SENHA));
        String email = "loja@example.com";
        String rota = "/api/usuarios/meu-email";
        assertEquals(400, chamar("POST", rota, sessao, Map.of("email", email, "senha", "errada")).statusCode());
        assertEquals(202, chamar("POST", rota, sessao, Map.of("email", email, "senha", SENHA)).statusCode());
        assertEquals(429, chamar("POST", rota, sessao, Map.of("email", email, "senha", SENHA)).statusCode());
        assertEquals(204, chamar("POST", "/api/confirmar-email", null,
                Map.of("token", link(email, "/confirmar-email"))).statusCode());
        assertEquals(202, chamar("POST", "/api/recuperar-senha", null,
                Map.of("cpf", admin.getCpf(), "cnpj", empresa.getCnpj(), "email", email)).statusCode());
        String recuperar = link(email, "/recuperar-senha");
        when(clock.instant()).thenReturn(AGORA.plusSeconds(1800));
        assertEquals(400, chamar("POST", "/api/redefinir-senha", null,
                Map.of("token", recuperar, "senha", "nova12")).statusCode());
        assertEquals(200, login(admin.getCpf(), empresa.getCnpj(), SENHA).statusCode());
    }

    @Test void cadastroEEdiçãoDeAdministradorConfirmamEmailSemTrocarEnderecoVerificadoAntecipadamente() throws Exception {
        var empresa = empresas.save(new Empresa("Equipe administrativa", "66.666.666/0001-60"));
        var outra = empresas.save(new Empresa("Equipe externa", "77.777.777/0001-70"));
        var gestor = cadastrar(empresa, "777.888.999-00", "ADMIN", null);
        var externo = cadastrar(outra, "888.999.000-11", "ADMIN", null);
        String sessao = token(login(gestor.getCpf(), empresa.getCnpj(), SENHA));
        String primeiroEmail = "inicial@example.com";
        assertEquals(400, chamar("POST", "/api/usuarios", sessao, Map.of("nomeCompleto", "Novo administrador",
                "cpf", "999.000.111-22", "perfil", "ADMIN", "senha", "alvo12")).statusCode());
        var cadastro = chamar("POST", "/api/usuarios", sessao, Map.of("nomeCompleto", "Novo administrador",
                "cpf", "999.000.111-22", "perfil", "ADMIN", "senha", "alvo12", "email", primeiroEmail));
        assertEquals(201, cadastro.statusCode(), cadastro.body());
        long id = json.readTree(cadastro.body()).path("id").asLong();
        String rota = "/api/usuarios/" + id;
        assertEquals(404, chamar("GET", "/api/usuarios/" + externo.getId() + "/email", sessao, null).statusCode());
        var pendente = json.readTree(chamar("GET", rota + "/email", sessao, null).body());
        assertEquals(primeiroEmail, pendente.path("emailPendente").asText());
        assertTrue(pendente.path("emailVerificado").isNull());
        assertEquals(204, chamar("POST", "/api/confirmar-email", null,
                Map.of("token", link(primeiroEmail, "/confirmar-email"))).statusCode());

        String novoEmail = "novo@example.com";
        assertEquals(400, chamar("PUT", rota, sessao,
                Map.of("nomeCompleto", "Alterado", "email", novoEmail)).statusCode());
        assertEquals(400, chamar("PUT", rota, sessao,
                Map.of("nomeCompleto", "Alterado", "email", novoEmail, "senhaAtual", SENHA)).statusCode());
        var conta = usuarios.findById(id).orElseThrow();
        assertEquals("Novo administrador", conta.getNomeCompleto());
        assertNull(conta.getEmailPendente());
        assertEquals(200, chamar("PUT", rota, sessao,
                Map.of("nomeCompleto", "Alterado", "email", novoEmail, "senhaAtual", "alvo12")).statusCode());
        var emConfirmacao = json.readTree(chamar("GET", rota + "/email", sessao, null).body());
        assertEquals(primeiroEmail, emConfirmacao.path("emailVerificado").asText());
        assertEquals(novoEmail, emConfirmacao.path("emailPendente").asText());
        recuperacao.solicitarRecuperacao("999.000.111-22", empresa.getCnpj(), novoEmail);
        verify(emails, never()).enviarLink(any(), anyString(), anyString(), anyString(), eq("/recuperar-senha"), anyString());
        assertEquals(204, chamar("POST", "/api/confirmar-email", null,
                Map.of("token", link(novoEmail, "/confirmar-email"))).statusCode());
        assertEquals(novoEmail, usuarios.findById(id).orElseThrow().getEmailVerificado());
    }

    @Test void colaboradorPodeRecuperarAPropriaContaComOEmailDoCadastro() throws Exception {
        var empresa = empresas.save(new Empresa("Loja de teste", "88.888.888/0001-80"));
        var admin = cadastrar(empresa, "100.200.300-40", "ADMIN", "gestor@example.com");
        String sessao = token(login(admin.getCpf(), empresa.getCnpj(), SENHA));
        String cpf = "100.200.300-41";
        String email = "colaborador@example.com";
        assertEquals(400, chamar("POST", "/api/usuarios", sessao, Map.of("nomeCompleto", "Colaborador",
                "cpf", cpf, "perfil", "COLABORADOR", "senha", SENHA)).statusCode());
        var cadastro = chamar("POST", "/api/usuarios", sessao, Map.of("nomeCompleto", "Colaborador",
                "cpf", cpf, "perfil", "COLABORADOR", "senha", SENHA, "email", email));
        assertEquals(201, cadastro.statusCode(), cadastro.body());
        long id = json.readTree(cadastro.body()).path("id").asLong();
        var conta = usuarios.findById(id).orElseThrow();
        assertEquals(email, conta.getEmailPendente());
        assertNull(conta.getEmailVerificado());
        assertNull(conta.getDataNascimento());
        assertNull(conta.getTelefone());
        assertNull(conta.getEndereco());
        String confirmacaoInicial = link(email, "/confirmar-email");
        assertEquals(202, chamar("POST", "/api/recuperar-senha", null,
                Map.of("cpf", cpf, "cnpj", empresa.getCnpj(), "email", email)).statusCode());
        String token = link(email, "/recuperar-senha");
        verify(emails, never()).enviarLink(any(), eq("gestor@example.com"), anyString(), anyString(), anyString(), anyString());
        assertEquals(204, chamar("POST", "/api/redefinir-senha", null, Map.of("token", token, "senha", "nova12")).statusCode());
        assertEquals(email, usuarios.findById(id).orElseThrow().getEmailVerificado());
        assertEquals(400, chamar("POST", "/api/confirmar-email", null, Map.of("token", confirmacaoInicial)).statusCode());
        assertEquals("COLABORADOR", json.readTree(login(cpf, empresa.getCnpj(), "nova12").body()).path("perfil").asText());
    }

    @Test void adminPodeSolicitarConfirmacaoPendenteDepoisDeAtivarOEnvio() throws Exception {
        var empresa = empresas.save(new Empresa("Equipe", "12.345.678/0001-66"));
        var outraEmpresa = empresas.save(new Empresa("Outra equipe", "12.345.678/0001-67"));
        var admin = cadastrar(empresa, "100.200.300-70", "ADMIN", null);
        var externo = cadastrar(outraEmpresa, "100.200.300-71", "ADMIN", null);
        var colaborador = cadastrar(empresa, "100.200.300-72", "COLABORADOR", null);
        String email = "equipe@example.com";
        colaborador.iniciarConfirmacaoEmail(email, null, null);
        usuarios.save(colaborador);
        String sessaoAdmin = token(login(admin.getCpf(), empresa.getCnpj(), SENHA));
        String sessaoExterno = token(login(externo.getCpf(), outraEmpresa.getCnpj(), SENHA));
        String sessaoColaborador = token(login(colaborador.getCpf(), empresa.getCnpj(), SENHA));
        String rota = "/api/usuarios/" + colaborador.getId() + "/email";

        when(emails.configurado()).thenReturn(false);
        var estado = json.readTree(chamar("GET", rota, sessaoAdmin, null).body());
        assertEquals(email, estado.path("emailPendente").asText());
        assertFalse(estado.path("envioDisponivel").asBoolean());
        assertFalse(estado.path("confirmacaoSolicitada").asBoolean());
        assertEquals(503, chamar("POST", rota + "/confirmacao", sessaoAdmin, null).statusCode());
        verify(emails, never()).enviarLink(any(), anyString(), anyString(), anyString(), anyString(), anyString());

        when(emails.configurado()).thenReturn(true);
        assertEquals(403, chamar("POST", rota + "/confirmacao", sessaoColaborador, null).statusCode());
        assertEquals(404, chamar("POST", rota + "/confirmacao", sessaoExterno, null).statusCode());
        assertEquals(202, chamar("POST", rota + "/confirmacao", sessaoAdmin, null).statusCode());
        assertEquals(429, chamar("POST", rota + "/confirmacao", sessaoAdmin, null).statusCode());
        assertTrue(json.readTree(chamar("GET", rota, sessaoAdmin, null).body()).path("confirmacaoSolicitada").asBoolean());
        assertEquals(204, chamar("POST", "/api/confirmar-email", null,
                Map.of("token", link(email, "/confirmar-email"))).statusCode());
        assertEquals(email, usuarios.findById(colaborador.getId()).orElseThrow().getEmailVerificado());
        assertEquals(409, chamar("POST", rota + "/confirmacao", sessaoAdmin, null).statusCode());
    }

    private Usuario cadastrar(Empresa empresa, String cpf, String perfil, String email) {
        Usuario usuario = new Usuario();
        usuario.setEmpresa(empresa);
        usuario.setCpf(cpf);
        usuario.setNomeCompleto(perfil);
        usuario.setPerfil(perfil);
        usuario.setSenha(senhas.encode(SENHA));
        if (email != null) {
            usuario.iniciarConfirmacaoEmail(email, null, null);
            usuario.confirmarEmail();
        }
        return usuarios.save(usuario);
    }

    private String link(String email, String rota) {
        var valor = ArgumentCaptor.forClass(String.class);
        verify(emails).enviarLink(any(), eq(email), anyString(), anyString(), eq(rota), valor.capture());
        return valor.getValue();
    }

    private String token(HttpResponse<String> resposta) throws Exception {
        assertEquals(200, resposta.statusCode(), resposta.body());
        return json.readTree(resposta.body()).path("token").asText();
    }

    private HttpResponse<String> login(String cpf, String cnpj, String senha) throws Exception {
        return chamar("POST", "/api/login", null, Map.of("cpf", cpf, "cnpj", cnpj, "senha", senha));
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
