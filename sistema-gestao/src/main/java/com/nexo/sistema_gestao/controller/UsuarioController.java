package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @GetMapping
    public ResponseEntity<List<Usuario>> listarTodos() {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        Usuario usuarioLogado = (Usuario) authentication.getPrincipal();
        Long empresaId = usuarioLogado.getEmpresa().getId();

        return ResponseEntity.ok(usuarioRepository.findByEmpresaId(empresaId));
    }

    @PostMapping
    public ResponseEntity<?> cadastrar(@RequestBody Usuario novoUsuario) {
        
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        Usuario usuarioLogado = (Usuario) authentication.getPrincipal();
        
        // A CORREÇÃO ESTÁ AQUI: Verifica se o CPF já está na mesma empresa (CNPJ)
        if (usuarioRepository.findByCpfAndEmpresaCnpj(novoUsuario.getCpf(), usuarioLogado.getEmpresa().getCnpj()).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("{\"erro\": \"CPF já cadastrado nesta empresa.\"}");
        }
        
        novoUsuario.setEmpresa(usuarioLogado.getEmpresa());
        novoUsuario.setSenha(passwordEncoder.encode(novoUsuario.getSenha()));
        
        usuarioRepository.save(novoUsuario);
        return ResponseEntity.status(HttpStatus.CREATED).body(novoUsuario);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> remover(@PathVariable Long id) {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        Usuario usuarioLogado = (Usuario) authentication.getPrincipal();

        Optional<Usuario> usuarioOpt = usuarioRepository.findByIdAndEmpresaId(id, usuarioLogado.getEmpresa().getId());
        
        if (usuarioOpt.isPresent()) {
            usuarioRepository.delete(usuarioOpt.get());
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> editarColaborador(@PathVariable Long id, @RequestBody Usuario dadosAtualizados) {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        Usuario usuarioLogado = (Usuario) authentication.getPrincipal();

        Optional<Usuario> usuarioOpt = usuarioRepository.findByIdAndEmpresaId(id, usuarioLogado.getEmpresa().getId());

        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("{\"erro\": \"Colaborador não encontrado nesta empresa.\"}");
        }

        Usuario usuario = usuarioOpt.get();
        usuario.setNomeCompleto(dadosAtualizados.getNomeCompleto());
        usuario.setDataNascimento(dadosAtualizados.getDataNascimento());
        usuario.setTelefone(dadosAtualizados.getTelefone());
        usuario.setEndereco(dadosAtualizados.getEndereco());

        if (dadosAtualizados.getSenha() != null && !dadosAtualizados.getSenha().trim().isEmpty()) {
            usuario.setSenha(passwordEncoder.encode(dadosAtualizados.getSenha()));
        }

        usuarioRepository.save(usuario);
        return ResponseEntity.ok("{\"mensagem\": \"Colaborador atualizado com sucesso!\"}");
    }
}