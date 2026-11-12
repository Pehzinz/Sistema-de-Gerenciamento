package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.dto.LoginRequestDTO;
import com.nexo.sistema_gestao.dto.RegistroSaaSRequestDTO;
import com.nexo.sistema_gestao.model.Empresa;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.EmpresaRepository;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.security.RequestValidation;
import com.nexo.sistema_gestao.security.TokenService;
import com.nexo.sistema_gestao.service.AcessoContaService;
import com.nexo.sistema_gestao.service.RecuperacaoContaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AutenticacaoController {

    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private EmpresaRepository empresaRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private TokenService tokenService;
    @Autowired private AcessoContaService acessoConta;
    @Autowired private RecuperacaoContaService recuperacao;

    @PostMapping("/login")
    public ResponseEntity<?> realizarLogin(@RequestBody LoginRequestDTO dadosLogin) {
        RequestValidation.text(dadosLogin.cpf(), 14, "CPF");
        RequestValidation.loginPassword(dadosLogin.senha());
        if (dadosLogin.cnpj() != null && !dadosLogin.cnpj().isBlank()) {
            RequestValidation.text(dadosLogin.cnpj(), 18, "CNPJ");
        }
        var resultado = acessoConta.autenticar(dadosLogin.cpf(), dadosLogin.cnpj(), dadosLogin.senha());
        if (resultado.segundosBloqueio() > 0) {
            return loginBloqueado(resultado.segundosBloqueio());
        }
        if (resultado.empresaObrigatoria()) {
            return ResponseEntity.badRequest().body(Map.of("erro",
                    "Há mais de uma conta para este CPF. Informe o CNPJ da empresa para entrar."));
        }
        Usuario usuario = resultado.usuario();
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erro", "CPF ou senha incorretos."));
        }
        return ResponseEntity.ok(Map.of("token", tokenService.gerarToken(usuario), "perfil", usuario.getPerfil(),
                "nomeCompleto", usuario.getNomeCompleto(), "nomeEmpresa", usuario.getEmpresa().getNome(),
                "cnpj", usuario.getEmpresa().getCnpj()));
    }

    static ResponseEntity<?> loginBloqueado(long segundos) {
        long minutos = (segundos + 59) / 60;
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(segundos))
                .body(Map.of("erro", "Conta temporariamente bloqueada. Tente novamente em "
                        + minutos + (minutos == 1 ? " minuto." : " minutos.")));
    }

    @PostMapping("/recuperar-senha")
    public ResponseEntity<?> solicitarRecuperacao(@RequestBody SolicitacaoRecuperacao dados) {
        recuperacao.solicitarRecuperacao(dados.cpf(), dados.cnpj(), dados.email());
        return ResponseEntity.accepted().body(Map.of("mensagem",
                "Se os dados corresponderem a uma conta, você receberá um link para criar uma nova senha. Confira a caixa de entrada e o spam."));
    }

    @PostMapping("/redefinir-senha")
    public ResponseEntity<?> redefinirSenha(@RequestBody NovaSenha dados) {
        recuperacao.redefinirSenha(dados.token(), dados.senha());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/confirmar-email")
    public ResponseEntity<?> confirmarEmail(@RequestBody ConfirmacaoEmail dados) {
        recuperacao.confirmarEmail(dados.token());
        return ResponseEntity.noContent().build();
    }

    record SolicitacaoRecuperacao(String cpf, String cnpj, String email) {}
    record NovaSenha(String token, String senha) {}
    record ConfirmacaoEmail(String token) {}

    @PostMapping("/registro")
    @Transactional
    public ResponseEntity<?> registrarNovaEmpresa(@RequestBody RegistroSaaSRequestDTO dados) {
        com.nexo.sistema_gestao.security.RequestValidation.text(dados.nomeEmpresa(), 150, "Nome da empresa");
        com.nexo.sistema_gestao.security.RequestValidation.text(dados.cnpj(), 18, "CNPJ");
        com.nexo.sistema_gestao.security.RequestValidation.text(dados.nomeAdmin(), 150, "Nome do administrador");
        com.nexo.sistema_gestao.security.RequestValidation.text(dados.cpfAdmin(), 14, "CPF");
        com.nexo.sistema_gestao.security.RequestValidation.password(dados.senhaAdmin());
        String email = RequestValidation.email(dados.emailAdmin());
        
        if (empresaRepository.findByCnpj(dados.cnpj()).isPresent()
                || (dados.cnpj().matches("[0-9./ -]+") && empresaRepository.existeCnpjNormalizado(
                        dados.cnpj().replaceAll("[./ -]", "")))) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("{\"erro\": \"CNPJ já cadastrado no sistema.\"}");
        }

        if (usuarioRepository.findByCpfAndEmpresaCnpj(dados.cpfAdmin(), dados.cnpj()).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("{\"erro\": \"Este CPF já é administrador desta empresa.\"}");
        }

        Empresa novaEmpresa = new Empresa(dados.nomeEmpresa(), dados.cnpj());
        Empresa empresaSalva = empresaRepository.save(novaEmpresa);

        Usuario novoAdmin = new Usuario();
        novoAdmin.setNomeCompleto(dados.nomeAdmin());
        novoAdmin.setCpf(dados.cpfAdmin());
        novoAdmin.setSenha(passwordEncoder.encode(dados.senhaAdmin()));
        novoAdmin.setPerfil("ADMIN");
        novoAdmin.setEmpresa(empresaSalva);

        recuperacao.prepararConfirmacaoEmail(novoAdmin, email);
        usuarioRepository.save(novoAdmin);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "mensagem", "Empresa e Administrador cadastrados com sucesso!",
                "confirmacaoEmailSolicitada", novoAdmin.getConfirmacaoEmailExpiraEm() != null));
    }
}
