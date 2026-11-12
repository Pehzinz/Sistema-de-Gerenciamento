package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.security.RequestValidation;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;

@Service
public class RecuperacaoContaService {
    private static final Duration VALIDADE_RECUPERACAO = Duration.ofMinutes(30);
    private static final Duration VALIDADE_CONFIRMACAO = Duration.ofHours(24);
    private static final Duration INTERVALO_ENVIO = Duration.ofMinutes(1);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;
    private final EmailContaService emails;
    private final Clock clock;

    public RecuperacaoContaService(UsuarioRepository usuarios, PasswordEncoder senhas, EmailContaService emails, Clock clock) {
        this.usuarios = usuarios;
        this.senhas = senhas;
        this.emails = emails;
        this.clock = clock;
    }

    public void prepararConfirmacaoEmail(Usuario usuario, String email) {
        iniciarConfirmacao(usuario, RequestValidation.email(email), clock.instant());
    }

    @Transactional
    public boolean solicitarConfirmacaoEmail(Usuario credencial, String email) {
        exigirEnvioDisponivel();
        Usuario usuario = usuarios.bloquearAtivoPorIdEmpresa(credencial.getId(), credencial.getEmpresa().getId())
                .filter(u -> "ADMIN".equals(u.getPerfil())
                        && Objects.equals(u.getVersaoCredencial(), credencial.getVersaoCredencial()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        String endereco = RequestValidation.email(email);
        if (endereco.equalsIgnoreCase(usuario.getEmailVerificado())) {
            throw new IllegalArgumentException("Este e-mail já está confirmado.");
        }
        if (confirmacaoEnviadaRecentemente(usuario)) {
            return false;
        }
        iniciarConfirmacao(usuario, endereco, clock.instant());
        return true;
    }

    public boolean confirmacaoEnviadaRecentemente(Usuario usuario) {
        return envioRecente(usuario.getConfirmacaoEmailExpiraEm(), VALIDADE_CONFIRMACAO, clock.instant());
    }

    @Transactional
    public void confirmarEmail(String token) {
        Usuario usuario = usuarios.findByHashConfirmacaoEmailAndAtivoTrue(hashValido(token))
                .filter(u -> vigente(u.getConfirmacaoEmailExpiraEm(), clock.instant()))
                .orElseThrow(RecuperacaoContaService::linkInvalido);
        String anterior = usuario.getEmailVerificado();
        usuario.confirmarEmail();
        emails.avisarEmailConfirmado(usuario, anterior);
    }

    @Transactional
    public void solicitarRecuperacao(String cpf, String cnpj, String email) {
        RequestValidation.text(cpf, 14, "CPF");
        RequestValidation.text(cnpj, 18, "CNPJ");
        String enderecoSolicitado = RequestValidation.email(email);
        exigirEnvioDisponivel();
        String cpfNormalizado = AcessoContaService.digitos(cpf);
        String cnpjNormalizado = AcessoContaService.digitos(cnpj);
        List<Usuario> contas = cpfNormalizado != null && cnpjNormalizado != null
                ? usuarios.bloquearPorDocumentos(cpfNormalizado, cnpjNormalizado)
                : usuarios.bloquearPorCpfECnpj(cpf, cnpj);
        if (contas.size() != 1) return;
        Usuario usuario = contas.getFirst();
        // Uma troca pendente só assume a recuperação depois de confirmada.
        String destinatario = usuario.getEmailVerificado() != null ? usuario.getEmailVerificado() : usuario.getEmailPendente();
        Instant agora = clock.instant();
        if (!enderecoSolicitado.equalsIgnoreCase(destinatario)
                || envioRecente(usuario.getRecuperacaoExpiraEm(), VALIDADE_RECUPERACAO, agora)) {
            return;
        }
        String token = novoToken();
        usuario.iniciarRecuperacao(hash(token), agora.plus(VALIDADE_RECUPERACAO));
        emails.enviarLink(usuario, destinatario, "Recuperação de senha",
                "Olá! Recebemos um pedido para recuperar sua conta no Nexo Gestão. "
                + "Abra o link abaixo em até 30 minutos para criar uma nova senha. "
                + "Se você não fez o pedido, pode ignorar este e-mail.",
                "/recuperar-senha", token);
    }

    @Transactional
    public void redefinirSenha(String token, String senha) {
        RequestValidation.password(senha);
        Usuario usuario = usuarios.findByHashRecuperacaoAndAtivoTrue(hashValido(token))
                .filter(u -> vigente(u.getRecuperacaoExpiraEm(), clock.instant()))
                .orElseThrow(RecuperacaoContaService::linkInvalido);
        if (usuario.getEmailVerificado() == null && usuario.getEmailPendente() != null) {
            // O primeiro uso do link também comprova a posse do e-mail cadastrado.
            usuario.confirmarEmail();
        }
        usuario.alterarSenha(senhas.encode(senha));
        emails.avisarSenhaAlterada(usuario);
    }

    private void iniciarConfirmacao(Usuario usuario, String email, Instant agora) {
        if (!emails.configurado()) {
            usuario.iniciarConfirmacaoEmail(email, null, null);
            return;
        }
        String token = novoToken();
        usuario.iniciarConfirmacaoEmail(email, hash(token), agora.plus(VALIDADE_CONFIRMACAO));
        emails.enviarLink(usuario, email, "Confirme seu e-mail",
                "Confirme seu e-mail em até 24 horas para ativar a recuperação de senha e os avisos de segurança.",
                "/confirmar-email", token);
    }

    private void exigirEnvioDisponivel() {
        if (!emails.configurado()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "O envio de e-mails de segurança está indisponível.");
        }
    }

    private static boolean envioRecente(Instant expiraEm, Duration validade, Instant agora) {
        return expiraEm != null && expiraEm.minus(validade).plus(INTERVALO_ENVIO).isAfter(agora);
    }

    private static boolean vigente(Instant expiraEm, Instant agora) {
        return expiraEm != null && expiraEm.isAfter(agora);
    }

    private static String novoToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hashValido(String token) {
        if (token == null || !token.matches("[a-zA-Z0-9_-]{43}")) throw linkInvalido();
        return hash(token);
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static IllegalArgumentException linkInvalido() {
        return new IllegalArgumentException("O link é inválido, expirou ou já foi utilizado.");
    }
}
