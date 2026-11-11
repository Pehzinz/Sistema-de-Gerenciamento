package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Usuario;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Service
public class EmailContaService {
    private static final Logger log = LoggerFactory.getLogger(EmailContaService.class);
    private final ApplicationEventPublisher eventos;
    private final String remetente;
    private final String frontend;
    private final RestClient cliente;
    private final boolean configurado;
    private final ThreadPoolExecutor envios = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(100), Thread.ofPlatform().daemon().name("email-conta-", 0).factory());

    public EmailContaService(ApplicationEventPublisher eventos,
            @Value("${conta.email.api-key}") String chave,
            @Value("${conta.email.remetente}") String remetente,
            @Value("${conta.email.frontend}") String frontend) {
        this.eventos = eventos;
        this.remetente = remetente;
        this.frontend = frontend.replaceAll("/+$", "");
        URI origem = URI.create(this.frontend);
        boolean origemValida = origem.getHost() != null && origem.getRawUserInfo() == null
                && origem.getRawQuery() == null && origem.getRawFragment() == null
                && origem.getRawPath().isEmpty()
                && ("https".equals(origem.getScheme()) || ("http".equals(origem.getScheme())
                    && List.of("localhost", "127.0.0.1").contains(origem.getHost())));
        configurado = !chave.isBlank() && !remetente.isBlank() && origemValida;
        var fabrica = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5)).build());
        fabrica.setReadTimeout(Duration.ofSeconds(8));
        cliente = RestClient.builder().baseUrl("https://api.resend.com")
                .requestFactory(fabrica).defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + chave).build();
    }

    public boolean configurado() {
        return configurado;
    }

    public void enviarLink(Usuario usuario, String destinatario, String assunto, String texto, String caminho, String token) {
        agendar(usuario, destinatario, assunto, texto + "\n\n" + frontend + caminho + "#token=" + token);
    }

    public void avisarBloqueio(Usuario usuario) {
        agendar(usuario, usuario.getEmailVerificado(), "Conta bloqueada temporariamente",
                "O login foi bloqueado por 15 minutos após cinco senhas incorretas. "
                + "Se você não reconhece as tentativas, solicite a recuperação de senha na tela de login.");
    }

    public void avisarSenhaAlterada(Usuario usuario) {
        agendar(usuario, usuario.getEmailVerificado(), "Senha alterada",
                "A senha da sua conta foi alterada. Se você não reconhece essa alteração, recupere o acesso pela tela de login.");
    }

    public void avisarEmailConfirmado(Usuario usuario, String anterior) {
        agendar(usuario, usuario.getEmailVerificado(), "E-mail confirmado",
                "Seu e-mail foi confirmado. A recuperação de senha e os avisos de segurança estão ativos para esta conta.");
        agendar(usuario, anterior, "E-mail de recuperação alterado",
                "O e-mail de recuperação da sua conta foi alterado. Se você não reconhece a alteração, entre em contato com a sua empresa.");
    }

    private void agendar(Usuario usuario, String destinatario, String assunto, String texto) {
        if (configurado && destinatario != null) {
            String empresa = usuario.getEmpresa().getNome() + " (CNPJ " + usuario.getEmpresa().getCnpj() + ")";
            eventos.publishEvent(new Mensagem(destinatario, "Nexo Gestão | " + assunto, "Empresa: " + empresa + "\n\n" + texto));
        }
    }

    record Mensagem(String destinatario, String assunto, String texto) {}

    @TransactionalEventListener
    void enviarAposConfirmacao(Mensagem mensagem) {
        try {
            envios.execute(() -> enviar(mensagem));
        } catch (RejectedExecutionException e) {
            log.warn("A fila de e-mails de segurança está indisponível.");
        }
    }

    private void enviar(Mensagem mensagem) {
        try {
            cliente.post().uri("/emails").contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("from", remetente, "to", List.of(mensagem.destinatario()),
                            "subject", mensagem.assunto(), "text", mensagem.texto()))
                    .retrieve().toBodilessEntity();
        } catch (RestClientResponseException e) {
            log.warn("O provedor recusou um e-mail de segurança (HTTP {}).", e.getStatusCode().value());
        } catch (RestClientException e) {
            log.warn("Falha de conexão ao enviar um e-mail de segurança.");
        }
    }

    @PreDestroy
    void encerrarEnvios() {
        envios.shutdown();
    }
}
