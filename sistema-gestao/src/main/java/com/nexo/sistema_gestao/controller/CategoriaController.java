package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.model.Categoria;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.CategoriaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/categorias")
public class CategoriaController {

    @Autowired
    private CategoriaRepository categoriaRepository;

    @Autowired
    private com.nexo.sistema_gestao.repository.ProdutoRepository produtoRepository;

    private Long getEmpresaId() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return ((Usuario) auth.getPrincipal()).getEmpresa().getId();
    }
    
    private Usuario getUsuarioLogado(){
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return (Usuario) auth.getPrincipal();
    }

    @GetMapping
    public ResponseEntity<List<Categoria>> listarTodas() {
        return ResponseEntity.ok(categoriaRepository.findByEmpresaIdAndAtivoTrue(getEmpresaId()));
    }

    @PostMapping
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> criarCategoria(@RequestBody Categoria novaCategoria) {
        com.nexo.sistema_gestao.security.RequestValidation.text(novaCategoria.getNome(), 255, "Nome");
        novaCategoria.setId(null);
        String nomeFormatado = novaCategoria.getNome().trim();
        Optional<Categoria> existenteOpt = categoriaRepository.findByNomeIgnoreCaseAndEmpresaId(nomeFormatado, getEmpresaId());

        if (existenteOpt.isPresent()) {
            Categoria categoriaExistente = existenteOpt.get();
            if (!categoriaExistente.isAtivo()) {
                categoriaExistente.setAtivo(true);
                categoriaRepository.save(categoriaExistente);
                return ResponseEntity.ok(categoriaExistente);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("{\"erro\": \"Categoria já cadastrada e ativa nesta empresa.\"}");
            }
        }

        novaCategoria.setNome(nomeFormatado);
        novaCategoria.setAtivo(true);
        novaCategoria.setEmpresa(getUsuarioLogado().getEmpresa());
        Categoria salva = categoriaRepository.save(novaCategoria);
        return ResponseEntity.status(HttpStatus.CREATED).body(salva);
    }

    @DeleteMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> inativarCategoria(@PathVariable Long id) {
        Optional<Categoria> catOpt = categoriaRepository.findByIdAndEmpresaId(id, getEmpresaId());
        if (catOpt.isEmpty() || !catOpt.get().isAtivo()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        return inativar(catOpt.get());
    }
    
    @DeleteMapping("/nome/{nome}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> inativarCategoriaPorNome(@PathVariable String nome) {
        Optional<Categoria> catOpt = categoriaRepository.findByNomeIgnoreCaseAndEmpresaId(nome.trim(), getEmpresaId());
        
        if (catOpt.isEmpty() || !catOpt.get().isAtivo()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("{\"erro\": \"Categoria não encontrada ou já excluída.\"}");
        }

        return inativar(catOpt.get());
    }

    private ResponseEntity<?> inativar(Categoria categoria) {
        List<com.nexo.sistema_gestao.model.Produto> produtos = produtoRepository.buscarCategoriaParaExclusao(categoria.getId(), getEmpresaId());

        categoria.setAtivo(false);
        categoriaRepository.save(categoria);

        for (com.nexo.sistema_gestao.model.Produto p : produtos) {
            p.setAtivo(false);
            produtoRepository.save(p);
        }

        return ResponseEntity.noContent().build();
    }
}
