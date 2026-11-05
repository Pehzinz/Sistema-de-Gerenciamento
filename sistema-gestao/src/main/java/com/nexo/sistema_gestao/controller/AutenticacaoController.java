package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.dto.LoginRequestDTO;
import com.nexo.sistema_gestao.dto.RegistroSaaSRequestDTO;
import com.nexo.sistema_gestao.model.Empresa;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.EmpresaRepository;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.security.TokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class AutenticacaoController {

    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private EmpresaRepository empresaRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private TokenService tokenService; 

    @PostMapping("/login")
    public ResponseEntity<?> realizarLogin(@RequestBody LoginRequestDTO dadosLogin) {
        com.nexo.sistema_gestao.security.RequestValidation.text(dadosLogin.cpf(), 14, "CPF");
        com.nexo.sistema_gestao.security.RequestValidation.text(dadosLogin.senha(), 72, "Senha");
        
        List<Usuario> usuariosEncontrados;

        // Se o CNPJ foi informado (Terminal já configurado por um ADM)
        if (dadosLogin.cnpj() != null && !dadosLogin.cnpj().trim().isEmpty()) {
            Optional<Usuario> userOpt = usuarioRepository.findByCpfAndEmpresaCnpj(dadosLogin.cpf(), dadosLogin.cnpj());
            usuariosEncontrados = userOpt.map(List::of).orElseGet(List::of);
        } else {
            // Terminal em branco: busca todas as contas desse CPF no sistema global
            usuariosEncontrados = usuarioRepository.findByCpf(dadosLogin.cpf());
        }

        if (usuariosEncontrados.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erro", "CPF ou senha incorretos."));
        }

        // Separa apenas as contas que possuem a senha digitada correta
        List<Usuario> contasComSenhaCorreta = usuariosEncontrados.stream()
                .filter(u -> passwordEncoder.matches(dadosLogin.senha(), u.getSenha()))
                .collect(Collectors.toList());

        if (contasComSenhaCorreta.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erro", "CPF ou senha incorretos."));
        }

        // A BARREIRA DE SEGURANÇA: Identidade ambígua em terminal não configurado
        if (contasComSenhaCorreta.size() > 1) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                "{\"erro\": \"Você possui contas em múltiplas empresas com a mesma senha. Peça para o Administrador acessar este terminal primeiro para vinculá-lo à empresa correta.\"}"
            );
        }

        // Se passou, temos apenas 1 usuário exato! Gera o login seguro.
        Usuario usuario = contasComSenhaCorreta.get(0);
        String token = tokenService.gerarToken(usuario);
        
        Map<String, String> resposta = new HashMap<>();
        resposta.put("token", token);
        resposta.put("perfil", usuario.getPerfil().toString());
        resposta.put("nomeCompleto", usuario.getNomeCompleto()); 
        resposta.put("nomeEmpresa", usuario.getEmpresa().getNome()); 
        resposta.put("cnpj", usuario.getEmpresa().getCnpj()); 
        
        return ResponseEntity.ok(resposta);
    }

    @PostMapping("/registro")
    @Transactional
    public ResponseEntity<?> registrarNovaEmpresa(@RequestBody RegistroSaaSRequestDTO dados) {
        com.nexo.sistema_gestao.security.RequestValidation.text(dados.nomeEmpresa(), 150, "Nome da empresa");
        com.nexo.sistema_gestao.security.RequestValidation.text(dados.cnpj(), 18, "CNPJ");
        com.nexo.sistema_gestao.security.RequestValidation.text(dados.nomeAdmin(), 150, "Nome do administrador");
        com.nexo.sistema_gestao.security.RequestValidation.text(dados.cpfAdmin(), 14, "CPF");
        com.nexo.sistema_gestao.security.RequestValidation.password(dados.senhaAdmin());
        
        if (empresaRepository.findByCnpj(dados.cnpj()).isPresent()) {
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

        usuarioRepository.save(novoAdmin);

        return ResponseEntity.status(HttpStatus.CREATED).body("{\"mensagem\": \"Empresa e Administrador cadastrados com sucesso!\"}");
    }
}
