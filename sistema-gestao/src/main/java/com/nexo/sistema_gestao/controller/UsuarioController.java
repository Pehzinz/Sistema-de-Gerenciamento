package com.nexo.sistema_gestao.controller;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.security.RequestValidation;
import com.nexo.sistema_gestao.security.TokenService;
import com.nexo.sistema_gestao.service.AcessoContaService;
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
    @Autowired private TokenService tokens;

    record AutorizacaoEdicao(String senha) {}
    record EdicaoAutorizada(String autorizacaoEdicao, String email) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    record DadosUsuario(String nomeCompleto, String cpf, String senha, String perfil,
                        LocalDate dataNascimento, String telefone, String endereco, String email,
                        String autorizacaoEdicao) {}

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

    @PostMapping("/{id}/autorizar-edicao")
    public ResponseEntity<?> autorizarEdicao(@PathVariable Long id, @RequestBody AutorizacaoEdicao dados,
            @AuthenticationPrincipal Usuario administrador) {
        Usuario usuarioEditado = usuarioRepository.findByIdAndEmpresaIdAndAtivoTrue(id, administrador.getEmpresa().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado nesta empresa."));

        RequestValidation.loginPassword(dados.senha());
        var resultado = acessoConta.confirmarSenha(administrador, dados.senha());
        if (resultado.segundosBloqueio() > 0) {
            return AutenticacaoController.loginBloqueado(resultado.segundosBloqueio());
        }
        if (resultado.usuario() == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "A senha do administrador conectado está incorreta."));
        }
        return ResponseEntity.ok(new EdicaoAutorizada(
                tokens.gerarAutorizacaoEdicao(resultado.usuario(), id), usuarioEditado.getEmail()));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> editarColaborador(@PathVariable Long id, @RequestBody DadosUsuario dados,
            @AuthenticationPrincipal Usuario usuarioLogado) {
        Optional<Usuario> usuarioOpt = usuarioRepository.bloquearAtivoPorIdEmpresa(id, usuarioLogado.getEmpresa().getId());

        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("{\"erro\": \"Colaborador não encontrado nesta empresa.\"}");
        }
        if (!tokens.autorizacaoEdicaoValida(dados.autorizacaoEdicao(), usuarioLogado, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("erro", "Autorize a edição deste usuário novamente antes de salvar."));
        }

        Usuario usuario = usuarioOpt.get();
        RequestValidation.text(dados.nomeCompleto(), 150, "Nome");
        boolean trocaSenha = dados.senha() != null && !dados.senha().isEmpty();
        if (trocaSenha) {
            RequestValidation.password(dados.senha());
        }

        preencherPerfil(usuario, dados);
        if (trocaSenha) {
            usuario.alterarSenha(passwordEncoder.encode(dados.senha()));
        }

        usuarioRepository.save(usuario);
        return ResponseEntity.ok(Map.of("mensagem", "Dados atualizados com sucesso!"));
    }

    private void preencherPerfil(Usuario usuario, DadosUsuario dados) {
        usuario.setNomeCompleto(dados.nomeCompleto());
        usuario.setDataNascimento(dados.dataNascimento());
        usuario.setTelefone(dados.telefone());
        usuario.setEndereco(dados.endereco());
        if (dados.email() != null) {
            usuario.setEmail(RequestValidation.emailOpcional(dados.email()));
        }
    }
}
