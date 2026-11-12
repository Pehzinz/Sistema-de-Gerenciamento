package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Empresa;
import com.nexo.sistema_gestao.model.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class EmailContaServiceTests {
    @Test void entregaOLinkAoDestinatarioERepeteFalhaTemporariaComAMesmaChave() {
        var builder = RestClient.builder().baseUrl("https://api.resend.com");
        var servidor = MockRestServiceServer.bindTo(builder).build();
        var evento = new AtomicReference<EmailContaService.Mensagem>();
        var servico = new EmailContaService(valor -> evento.set((EmailContaService.Mensagem) valor),
                "chave-teste", "seguranca@example.com", "https://nexo.example.com/", builder.build());
        var idempotencia = new AtomicReference<String>();
        servidor.expect(requestTo("https://api.resend.com/emails"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.from").value("seguranca@example.com"))
                .andExpect(jsonPath("$.to[0]").value("caixa@example.com"))
                .andExpect(jsonPath("$.subject").value("Nexo Gestão | Recuperação de senha"))
                .andExpect(jsonPath("$.text").value("Empresa: Loja A (CNPJ 123)\n\nCrie uma nova senha.\n\n"
                        + "https://nexo.example.com/recuperar-senha#token=token-teste"))
                .andExpect(pedido -> {
                    String chave = pedido.getHeaders().getFirst("Idempotency-Key");
                    assertNotNull(chave);
                    idempotencia.set(chave);
                })
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        servidor.expect(requestTo("https://api.resend.com/emails"))
                .andExpect(pedido -> assertEquals(idempotencia.get(), pedido.getHeaders().getFirst("Idempotency-Key")))
                .andRespond(withSuccess());

        var usuario = new Usuario();
        usuario.setEmpresa(new Empresa("Loja A", "123"));
        try {
            servico.enviarLink(usuario, "caixa@example.com", "Recuperação de senha",
                    "Crie uma nova senha.", "/recuperar-senha", "token-teste");
            servico.enviarAposConfirmacao(evento.get());
            servidor.verify(Duration.ofSeconds(8));
        } finally {
            servico.encerrarEnvios();
        }
    }
}
