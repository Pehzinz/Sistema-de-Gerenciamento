package com.nexo.sistema_gestao.controller;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.security.RequestValidation;
import com.nexo.sistema_gestao.service.AcessoContaService;
import com.nexo.sistema_gestao.service.EmailContaService;
import com.nexo.sistema_gestao.service.RecuperacaoContaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private com.nexo.sistema_gestao.repository.EmpresaRepository empresaRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired private AcessoContaService acessoConta;
    @Autowired private RecuperacaoContaService recuperacao;
    @Autowired private EmailContaService emails;

    @GetMapping("/meu-email")
    public EstadoEmail obterMeuEmail(@AuthenticationPrincipal Usuario usuario) {
        return estadoEmail(usuario);
    }

    @GetMapping("/{id}/email")
    public EstadoEmail obterEmailUsuario(@PathVariable Long id, @AuthenticationPrincipal Usuario usuarioLogado) {
        Usuario usuario = usuarioRepository.findByIdAndEmpresaIdAndAtivoTrue(id, usuarioLogado.getEmpresa().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado nesta empresa."));
        return estadoEmail(usuario);
    }

    @PostMapping("/meu-email")
    public ResponseEntity<?> cadastrarMeuEmail(@AuthenticationPrincipal Usuario usuario, @RequestBody NovoEmail dados) {
        RequestValidation.loginPassword(dados.senha());
        var resultado = acessoConta.confirmarSenha(usuario, dados.senha());
        if (resultado.segundosBloqueio() > 0) {
            return AutenticacaoController.loginBloqueado(resultado.segundosBloqueio());
        }
        if (resultado.usuario() == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "A senha atual está incorreta."));
        }
        if (!recuperacao.solicitarConfirmacaoEmail(resultado.usuario(), dados.email())) {
            return confirmarEmailAguarde();
        }
        return ResponseEntity.accepted().body(Map.of("mensagem", "Confira sua caixa de entrada para confirmar o e-mail."));
    }

    record EstadoEmail(String emailVerificado, String emailPendente, boolean envioDisponivel) {}
    record NovoEmail(String email, String senha) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    record DadosUsuario(String nomeCompleto, String cpf, String senha, String perfil,
                        LocalDate dataNascimento, String telefone, String endereco, String email, String senhaAtual) {}

    private EstadoEmail estadoEmail(Usuario usuario) {
        return new EstadoEmail(usuario.getEmailVerificado(), usuario.getEmailPendente(), emails.configurado());
    }

    private ResponseEntity<?> confirmarEmailAguarde() {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After", "60")
                .body(Map.of("erro", "Aguarde um minuto antes de pedir outro link."));
    }

    @GetMapping
    public ResponseEntity<List<Usuario>> listarTodos() {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        Usuario usuarioLogado = (Usuario) authentication.getPrincipal();
        Long empresaId = usuarioLogado.getEmpresa().getId();

        return ResponseEntity.ok(usuarioRepository.findByEmpresaIdAndAtivoTrue(empresaId));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> cadastrar(@RequestBody DadosUsuario dados, @AuthenticationPrincipal Usuario usuarioLogado) {
        RequestValidation.text(dados.nomeCompleto(), 150, "Nome");
        RequestValidation.text(dados.cpf(), 14, "CPF");
        RequestValidation.password(dados.senha());
        String email = RequestValidation.email(dados.email());
        if (dados.perfil() == null || !Set.of("ADMIN", "COLABORADOR").contains(dados.perfil())) {
            throw new IllegalArgumentException("Perfil inválido.");
        }

        if (usuarioRepository.findByCpfAndEmpresaCnpj(dados.cpf(), usuarioLogado.getEmpresa().getCnpj()).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("{\"erro\": \"CPF já cadastrado nesta empresa.\"}");
        }

        Usuario novoUsuario = new Usuario();
        novoUsuario.setCpf(dados.cpf());
        novoUsuario.setPerfil(dados.perfil());
        preencherPerfil(novoUsuario, dados);
        novoUsuario.setEmpresa(usuarioLogado.getEmpresa());
        novoUsuario.setSenha(passwordEncoder.encode(dados.senha()));
        recuperacao.prepararConfirmacaoEmail(novoUsuario, email);

        usuarioRepository.save(novoUsuario);
        return ResponseEntity.status(HttpStatus.CREATED).body(novoUsuario);
    }

    @DeleteMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> remover(@PathVariable Long id) {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        Usuario usuarioLogado = (Usuario) authentication.getPrincipal();

        Long empresaId = usuarioLogado.getEmpresa().getId();
        // Serializa exclusões na mesma empresa para proteger o último administrador.
        empresaRepository.bloquearPorId(empresaId).orElseThrow();
        Optional<Usuario> usuarioOpt = usuarioRepository.bloquearAtivoPorIdEmpresa(id, empresaId);
        
        if (usuarioOpt.isPresent()) {
            if ("ADMIN".equals(usuarioOpt.get().getPerfil())
                    && usuarioRepository.countByEmpresaIdAndPerfilAndAtivoTrue(empresaId, "ADMIN") <= 1) {
                return ResponseEntity.badRequest().body(java.util.Map.of("erro", "O sistema deve manter pelo menos 1 Administrador ativo."));
            }
            usuarioOpt.get().setAtivo(false);
            usuarioRepository.save(usuarioOpt.get());
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> editarColaborador(@PathVariable Long id, @RequestBody DadosUsuario dados,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        Optional<Usuario> usuarioOpt = usuarioRepository.bloquearAtivoPorIdEmpresa(id, usuarioLogado.getEmpresa().getId());

        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("{\"erro\": \"Colaborador não encontrado nesta empresa.\"}");
        }

        Usuario usuario = usuarioOpt.get();
        RequestValidation.text(dados.nomeCompleto(), 150, "Nome");
        boolean trocaSenha = dados.senha() != null && !dados.senha().isEmpty();
        if (trocaSenha) {
            RequestValidation.password(dados.senha());
        }
        String email = dados.email() == null ? "" : dados.email().trim();
        boolean trocaEmail = !email.isEmpty()
                && !email.equalsIgnoreCase(usuario.getEmailVerificado())
                && !email.equalsIgnoreCase(usuario.getEmailPendente());
        if (trocaEmail) {
            RequestValidation.email(email);
            if (dados.senhaAtual() == null || dados.senhaAtual().isBlank()) {
                throw new IllegalArgumentException("Informe a senha atual da conta que está sendo editada.");
            }
            RequestValidation.loginPassword(dados.senhaAtual());
            var resultado = acessoConta.confirmarSenha(usuario, dados.senhaAtual());
            if (resultado.segundosBloqueio() > 0) {
                return AutenticacaoController.loginBloqueado(resultado.segundosBloqueio());
            }
            if (resultado.usuario() == null) {
                return ResponseEntity.badRequest().body(Map.of("erro", "A senha atual da conta está incorreta."));
            }
            if (recuperacao.confirmacaoEnviadaRecentemente(usuario)) {
                return confirmarEmailAguarde();
            }
        }

        preencherPerfil(usuario, dados);
        if (trocaSenha) {
            usuario.alterarSenha(passwordEncoder.encode(dados.senha()));
            emails.avisarSenhaAlterada(usuario);
        }
        if (trocaEmail) {
            recuperacao.prepararConfirmacaoEmail(usuario, email);
        }

        usuarioRepository.save(usuario);
        return ResponseEntity.ok(Map.of("mensagem", "Dados atualizados com sucesso!"));
    }

    private void preencherPerfil(Usuario usuario, DadosUsuario dados) {
        usuario.setNomeCompleto(dados.nomeCompleto());
        usuario.setDataNascimento(dados.dataNascimento());
        usuario.setTelefone(dados.telefone());
        usuario.setEndereco(dados.endereco());
    }
}
