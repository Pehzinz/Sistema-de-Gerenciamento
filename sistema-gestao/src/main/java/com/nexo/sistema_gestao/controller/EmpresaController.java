package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.model.Empresa;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.EmpresaRepository;
import com.nexo.sistema_gestao.service.EmpresaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/empresas")
public class EmpresaController {

    @Autowired
    private EmpresaRepository empresaRepository;

    @Autowired
    private EmpresaService empresaService;

    // Helper para extrair a empresa logada
    private Long getEmpresaIdLogada() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return ((Usuario) auth.getPrincipal()).getEmpresa().getId();
    }

    // 1. Busca os dados atuais da empresa logada
    @GetMapping("/minha-empresa")
    public ResponseEntity<Empresa> obterMinhaEmpresa() {
        return empresaRepository.findById(getEmpresaIdLogada())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 2. Atualiza as informações comerciais da empresa
    @PutMapping("/configuracoes")
    public ResponseEntity<?> atualizarEmpresa(@RequestBody Empresa dadosAtualizados) {
        com.nexo.sistema_gestao.security.RequestValidation.text(dadosAtualizados.getNome(), 150, "Nome da empresa");
        if (dadosAtualizados.getTelefone() != null && dadosAtualizados.getTelefone().length() > 20
                || dadosAtualizados.getEmail() != null && dadosAtualizados.getEmail().length() > 150
                || dadosAtualizados.getEndereco() != null && dadosAtualizados.getEndereco().length() > 2000) {
            throw new IllegalArgumentException("Telefone, email ou endereço acima do limite permitido.");
        }
        Optional<Empresa> empresaOpt = empresaRepository.findById(getEmpresaIdLogada());

        if (empresaOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("{\"erro\": \"Empresa não encontrada.\"}");
        }

        Empresa empresa = empresaOpt.get();
        empresa.setNome(dadosAtualizados.getNome()); // Pode alterar o nome Fantasia
        empresa.setTelefone(dadosAtualizados.getTelefone());
        empresa.setEmail(dadosAtualizados.getEmail());
        empresa.setEndereco(dadosAtualizados.getEndereco());
        
        empresaRepository.save(empresa);
        return ResponseEntity.ok("{\"mensagem\": \"Configurações salvas com sucesso!\"}");
    }

    // 3. Limpar o Estoque (Bulk Soft-Delete) mantendo o Histórico Contábil
    @PostMapping("/limpar-estoque")
    public ResponseEntity<?> limparEstoque() {
        try {
            empresaService.limparEstoqueDaEmpresa(getEmpresaIdLogada());
            return ResponseEntity.ok("{\"mensagem\": \"Catálogo de estoque limpo com sucesso.\"}");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("{\"erro\": \"Falha ao limpar o estoque.\"}");
        }
    }

    // 4. Excluir Conta (Churn) - Hard Delete em Cascata
    @DeleteMapping("/encerrar-conta")
    public ResponseEntity<?> encerrarConta() {
        try {
            empresaService.excluirEmpresaCascata(getEmpresaIdLogada());
            return ResponseEntity.ok("{\"mensagem\": \"Conta encerrada e dados apagados com sucesso.\"}");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("{\"erro\": \"Falha ao excluir a conta da empresa.\"}");
        }
    }
}
