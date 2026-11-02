package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.ProdutoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/produtos")
public class ProdutoController {

    @Autowired
    private ProdutoRepository produtoRepository;

    private Long getEmpresaId() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return ((Usuario) auth.getPrincipal()).getEmpresa().getId();
    }
    
    private Usuario getUsuarioLogado(){
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return (Usuario) auth.getPrincipal();
    }

    @GetMapping
    public ResponseEntity<List<Produto>> listarTodos() {
        return ResponseEntity.ok(produtoRepository.findByEmpresaIdAndAtivoTrue(getEmpresaId()));
    }

    // A CORREÇÃO: Passa o ID limpo (10 dígitos) direto para o banco
    @GetMapping("/{id}")
    public ResponseEntity<Produto> buscarPorId(@PathVariable String id) {
        return produtoRepository.findByIdAndEmpresaIdAndAtivoTrue(id, getEmpresaId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> salvarProduto(@RequestBody Produto produto) {
        Usuario usuarioLogado = getUsuarioLogado();
        produto.setEmpresa(usuarioLogado.getEmpresa());

        // Busca se o produto já existe usando o ID limpo
        Optional<Produto> existenteOpt = produtoRepository.findByIdAndEmpresaId(produto.getId(), getEmpresaId());

        if (existenteOpt.isPresent()) {
            Produto existente = existenteOpt.get();
            if (!existente.isAtivo()) {
                existente.setNome(produto.getNome());
                existente.setMarca(produto.getMarca());
                existente.setPreco(produto.getPreco());
                existente.setEstoque(produto.getEstoque());
                existente.setCategoria(produto.getCategoria());
                existente.setPrecoPromocional(produto.getPrecoPromocional());
                existente.setDataInicioPromocao(produto.getDataInicioPromocao());
                existente.setDataFimPromocao(produto.getDataFimPromocao());
                existente.setAtivo(true); 

                produtoRepository.save(existente);
                return ResponseEntity.ok(existente);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("{\"erro\": \"Código de barras já cadastrado em um produto ativo nesta empresa.\"}");
            }
        }

        // Se for NOVO, cria a trava invisível apenas para salvar no banco
        String idInterno = getEmpresaId() + "-" + produto.getId();
        produto.setIdInterno(idInterno);
        produto.setAtivo(true);
        
        Produto salvo = produtoRepository.save(produto);
        return ResponseEntity.status(HttpStatus.CREATED).body(salvo);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> inativarProduto(@PathVariable String id) {
        // A CORREÇÃO: Usa o ID limpo para exclusão
        Optional<Produto> prodOpt = produtoRepository.findByIdAndEmpresaIdAndAtivoTrue(id, getEmpresaId());

        if (prodOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        Produto produto = prodOpt.get();

        if (produto.getEstoque() > 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("{\"erro\": \"Ação negada: Só é possível inativar produtos com estoque zerado.\"}");
        }

        produto.setAtivo(false);
        produtoRepository.save(produto);

        return ResponseEntity.noContent().build();
    }
    
    @PutMapping("/{id}/adicionar-estoque")
    public ResponseEntity<?> adicionarEstoque(@PathVariable String id, @RequestBody java.util.Map<String, Integer> payload) {
        Optional<Produto> prodOpt = produtoRepository.findByIdAndEmpresaIdAndAtivoTrue(id, getEmpresaId());

        if (prodOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("{\"erro\": \"Produto não encontrado no catálogo desta empresa.\"}");
        }

        Integer qtdAdicional = payload.get("quantidade");
        if (qtdAdicional == null || qtdAdicional <= 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("{\"erro\": \"A quantidade deve ser maior que zero.\"}");
        }

        Produto produto = prodOpt.get();
        produto.setEstoque(produto.getEstoque() + qtdAdicional);
        Produto atualizado = produtoRepository.save(produto);

        return ResponseEntity.ok(atualizado);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> atualizarProduto(@PathVariable String id, @RequestBody Produto produtoAtualizado) {
        return produtoRepository.findByIdAndEmpresaId(id, getEmpresaId()).map(produto -> {
            produto.setNome(produtoAtualizado.getNome());
            produto.setMarca(produtoAtualizado.getMarca());
            produto.setPreco(produtoAtualizado.getPreco());
            produto.setCategoria(produtoAtualizado.getCategoria());
            
            if (produtoAtualizado.getImagemUrl() != null) {
                produto.setImagemUrl(produtoAtualizado.getImagemUrl());
            }

            produto.setPrecoPromocional(produtoAtualizado.getPrecoPromocional());
            produto.setDataInicioPromocao(produtoAtualizado.getDataInicioPromocao());
            produto.setDataFimPromocao(produtoAtualizado.getDataFimPromocao());
            
            produtoRepository.save(produto);
            return ResponseEntity.ok().body("{\"mensagem\": \"Produto atualizado com sucesso!\"}");
            
        }).orElse(ResponseEntity.status(404).body("{\"erro\": \"Produto não encontrado nesta empresa!\"}"));
    }
}