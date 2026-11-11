package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
public class AcessoContaService {
    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;
    private final EmailContaService emails;
    private final Clock clock;

    public AcessoContaService(UsuarioRepository usuarios, PasswordEncoder senhas, EmailContaService emails, Clock clock) {
        this.usuarios = usuarios;
        this.senhas = senhas;
        this.emails = emails;
        this.clock = clock;
    }

    public record Resultado(Usuario usuario, boolean empresaObrigatoria, long segundosBloqueio) {}

    @Transactional
    public Resultado autenticar(String cpf, String cnpj, String senha) {
        if (cnpj == null || cnpj.isBlank()) {
            String documento = digitos(cpf);
            List<Usuario> contas = documento == null
                    ? usuarios.findByCpfAndAtivoTrueOrderById(cpf) : usuarios.bloquearPorCpfNormalizado(documento);
            return conferir(contas, senha);
        }
        String cpfNormalizado = digitos(cpf);
        String cnpjNormalizado = digitos(cnpj);
        List<Usuario> contas = cpfNormalizado != null && cnpjNormalizado != null
                ? usuarios.bloquearPorDocumentos(cpfNormalizado, cnpjNormalizado)
                : usuarios.bloquearPorCpfECnpj(cpf, cnpj);
        return conferir(contas, senha);
    }

    @Transactional
    public Resultado confirmarSenha(Usuario sessao, String senha) {
        List<Usuario> conta = usuarios.bloquearAtivoPorIdEmpresa(sessao.getId(), sessao.getEmpresa().getId()).stream()
                .filter(u -> Objects.equals(u.getVersaoCredencial(), sessao.getVersaoCredencial()))
                .toList();
        return conferir(conta, senha);
    }

    private Resultado conferir(List<Usuario> contas, String senha) {
        Instant agora = clock.instant();
        if (contas.size() > 1 && contas.stream().anyMatch(u -> bloqueado(u, agora))) {
            return new Resultado(null, true, 0);
        }
        List<Usuario> corretas = contas.stream()
                .filter(u -> !bloqueado(u, agora) && senhas.matches(senha, u.getSenha()))
                .toList();
        if (!corretas.isEmpty()) {
            corretas.forEach(Usuario::limparFalhasLogin);
            return corretas.size() == 1 ? new Resultado(corretas.getFirst(), false, 0)
                    : new Resultado(null, true, 0);
        }
        long segundos = 0;
        for (Usuario conta : contas) {
            if (!bloqueado(conta, agora)) {
                conta.registrarFalhaLogin(agora);
                if (bloqueado(conta, agora)) {
                    emails.avisarBloqueio(conta);
                }
            }
            if (bloqueado(conta, agora)) {
                long restante = Duration.between(agora, conta.getLoginBloqueadoAte()).toMillis();
                segundos = Math.max(segundos, (restante + 999) / 1000);
            }
        }
        return new Resultado(null, false, segundos);
    }

    private boolean bloqueado(Usuario conta, Instant agora) {
        return conta.getLoginBloqueadoAte() != null && conta.getLoginBloqueadoAte().isAfter(agora);
    }

    static String digitos(String documento) {
        return documento != null && documento.matches("[0-9./ -]+") ? documento.replaceAll("[./ -]", "") : null;
    }
}
