package com.nexo.sistema_gestao.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

/** Estado local da instância: reiniciar o backend exige novo login. */
@Service
public class TelegramSessaoService {
    public static final String MENU = "Consultas: /resumo, /estoque, /promocoes, /alertas, /vendas, /insights, /agenda, /equipe.\n"
            + "Você também pode perguntar à IA.\n/trocar_empresa ou /trocar_usuario: novo login\n/sair: encerrar sessão";
    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;
    private final Clock clock;
    private final Cache<String, Sessao> sessoes = Caffeine.newBuilder().maximumSize(10000)
            .expireAfterAccess(Duration.ofMinutes(15)).build();
    private final Cache<String, AtomicInteger> tentativas = Caffeine.newBuilder().maximumSize(20000)
            .expireAfterWrite(Duration.ofMinutes(15)).build();

    @org.springframework.beans.factory.annotation.Autowired
    public TelegramSessaoService(UsuarioRepository usuarios, PasswordEncoder senhas) {
        this(usuarios, senhas, Clock.systemUTC());
    }

    TelegramSessaoService(UsuarioRepository usuarios, PasswordEncoder senhas, Clock clock) {
        this.usuarios = usuarios;
        this.senhas = senhas;
        this.clock = clock;
    }

    public record Acesso(Long empresaId, String mensagem, String perfil) {}
    private static class Sessao {
        String cnpj, cpf, hash;
        Long usuarioId, empresaId;
        Instant ultimaAtividade, expira;
    }

    public boolean aguardandoSenha(String chat) {
        Sessao s = sessoes.getIfPresent(chat);
        return s != null && s.cpf != null && s.usuarioId == null;
    }

    public synchronized Acesso processar(String chat, String texto) {
        String comando = texto.trim().toLowerCase(java.util.Locale.ROOT);
        if (comando.equals("/sair")) {
            sessoes.invalidate(chat);
            return mensagem("Sessão encerrada. Use /start para entrar novamente.");
        }
        if (java.util.Set.of("/start", "/login", "/trocar_empresa", "/trocar_usuario").contains(comando)) {
            sessoes.invalidate(chat);
            return iniciar(chat);
        }
        Sessao s = sessoes.getIfPresent(chat);
        Instant agora = clock.instant();
        if (s == null || s.ultimaAtividade.plus(Duration.ofMinutes(15)).isBefore(agora)
                || s.expira.isBefore(agora)) {
            sessoes.invalidate(chat);
            return iniciar(chat);
        }
        s.ultimaAtividade = agora;
        if (s.usuarioId != null) {
            Usuario usuario = usuarios.findByIdAndEmpresaIdAndAtivoTrue(s.usuarioId, s.empresaId).orElse(null);
            if (!permitido(usuario) || !java.util.Objects.equals(s.hash, usuario.getSenha())) {
                sessoes.invalidate(chat);
                return mensagem("Acesso revogado ou credenciais alteradas. Use /start para entrar novamente.");
            }
            return new Acesso(s.empresaId, null, usuario.getPerfil());
        }
        if (comando.startsWith("/") && s.cpf == null) return mensagem("Conclua o login ou use /sair para cancelar.");
        if (s.cnpj == null) {
            String cnpj = texto.replaceAll("[^0-9]", "");
            if (cnpj.length() != 14 || !texto.matches("[0-9./\\-\\s]+")) return mensagem("Informe um CNPJ com 14 dígitos.");
            s.cnpj = cnpj;
            return mensagem("Informe seu CPF cadastrado nessa empresa.");
        }
        if (s.cpf == null) {
            String cpf = texto.replaceAll("[^0-9]", "");
            if (cpf.length() != 11 || !texto.matches("[0-9.\\-\\s]+")) return mensagem("Informe um CPF com 11 dígitos.");
            s.cpf = cpf;
            return mensagem("Informe sua senha do Nexo Gestão. Tentaremos apagar essa mensagem após recebê-la; a exclusão depende do Telegram. Use /sair para cancelar.");
        }
        String conta = "conta:" + s.cnpj + ":" + s.cpf;
        if (limite("chat:" + chat) || limite(conta)) {
            sessoes.invalidate(chat);
            return mensagem("Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.");
        }
        Usuario usuario = usuarios.findByCredenciaisTelegram(s.cpf, s.cnpj).orElse(null);
        if (texto.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72 || usuario == null
                || !senhas.matches(texto, usuario.getSenha()) || !permitido(usuario)) {
            sessoes.invalidate(chat);
            return mensagem("Credenciais inválidas ou acesso não permitido. Use /start para tentar novamente.");
        }
        s.usuarioId = usuario.getId();
        s.empresaId = usuario.getEmpresa().getId();
        s.hash = usuario.getSenha();
        s.cpf = null;
        s.cnpj = null;
        s.expira = agora.plus(Duration.ofHours(2));
        return mensagem("Autenticado como " + usuario.getNomeCompleto() + "\nEmpresa: " + usuario.getEmpresa().getNome()
                + "\nSessão: até 2 horas, com expiração após 15 minutos sem uso.\n\n" + menu(usuario.getPerfil()));
    }

    public static String menu(String perfil) {
        return "ADMIN".equals(perfil) ? MENU
                : "Consultas: /estoque, /promocoes, /alertas.\n/trocar_empresa ou /trocar_usuario: novo login\n/sair: encerrar sessão";
    }

    private boolean limite(String chave) {
        return tentativas.get(chave, ignored -> new AtomicInteger()).incrementAndGet() > 5;
    }

    private boolean permitido(Usuario usuario) {
        // O bot confere as permissões específicas antes de consultar dados ou chamar a IA.
        return usuario != null && usuario.getEmpresa() != null && java.util.Set.of("ADMIN", "COLABORADOR").contains(usuario.getPerfil() == null ? "" : usuario.getPerfil());
    }

    private Acesso iniciar(String chat) {
        Sessao s = new Sessao();
        s.ultimaAtividade = clock.instant();
        s.expira = s.ultimaAtividade.plus(Duration.ofMinutes(15));
        sessoes.put(chat, s);
        return mensagem("Entre com as credenciais da empresa que deseja consultar.\nInforme o CNPJ da empresa (ou /sair para cancelar).");
    }

    private Acesso mensagem(String texto) { return new Acesso(null, texto, null); }
}
