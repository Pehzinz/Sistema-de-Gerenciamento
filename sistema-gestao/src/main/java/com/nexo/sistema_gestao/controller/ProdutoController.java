package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.TipoEstoque;
import com.nexo.sistema_gestao.service.ControleEstoque;
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

    @Autowired
    private com.nexo.sistema_gestao.repository.CategoriaRepository categoriaRepository;

    private void validarProduto(Produto produto, boolean cadastro) {
        com.nexo.sistema_gestao.security.RequestValidation.text(produto.getNome(), 255, "Nome");
        if (cadastro) {
            if (produto.getId() == null || !produto.getId().matches("[0-9]{10}")) {
                throw new IllegalArgumentException("O código de barras deve ter 10 dígitos.");
            }
        }
        if (produto.getPreco() == null || !Double.isFinite(produto.getPreco()) || produto.getPreco() <= 0) {
            throw new IllegalArgumentException("O preço deve ser positivo.");
        }
        validarCusto(produto.getCustoUnitario());
        if (produto.getCategoria() == null || produto.getCategoria().getId() == null) {
            throw new IllegalArgumentException("Informe a categoria.");
        }
        var categoria = categoriaRepository.findByIdAndEmpresaId(produto.getCategoria().getId(), getEmpresaId())
                .filter(com.nexo.sistema_gestao.model.Categoria::isAtivo)
                .orElseThrow(() -> new IllegalArgumentException("Categoria não encontrada nesta empresa."));
        produto.setCategoria(categoria);
        if (produto.getMarca() != null && produto.getMarca().length() > 255) throw new IllegalArgumentException("Marca muito longa.");
        if (produto.getImagemUrl() != null && !produto.getImagemUrl().isBlank()
                && (produto.getImagemUrl().length() > 500 || !produto.getImagemUrl().startsWith("https://"))) {
            throw new IllegalArgumentException("A imagem deve ter uma URL HTTPS de até 500 caracteres.");
        }
        if (produto.getPrecoPromocional() != null) {
            if (!Double.isFinite(produto.getPrecoPromocional()) || produto.getPrecoPromocional() <= 0
                    || produto.getPrecoPromocional() > produto.getPreco()
                    || produto.getDataInicioPromocao() == null || produto.getDataFimPromocao() == null
                    || produto.getDataFimPromocao().isBefore(produto.getDataInicioPromocao())) {
                throw new IllegalArgumentException("Preço ou período promocional inválido.");
            }
        }
    }

    private void validarCusto(java.math.BigDecimal custo) {
        if (custo != null && (custo.signum() < 0 || custo.stripTrailingZeros().scale() > 2
                || custo.compareTo(new java.math.BigDecimal("9999999999.99")) > 0)) {
            throw new IllegalArgumentException("O custo deve ser de 0 a 9.999.999.999,99, com até duas casas decimais.");
        }
    }

    @PatchMapping("/{id}/custo")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> atualizarCusto(@PathVariable String id, @RequestBody java.util.Map<String, java.math.BigDecimal> dados) {
        if (!dados.containsKey("custoUnitario")) throw new IllegalArgumentException("Informe custoUnitario ou null para remover a informação.");
        var custo = dados.get("custoUnitario");
        validarCusto(custo);
        return produtoRepository.buscarParaVenda(id, getEmpresaId()).map(produto -> {
            produto.setCustoUnitario(custo);
            return ResponseEntity.ok(produtoRepository.save(produto));
        }).orElse(ResponseEntity.notFound().build());
    }

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

    @GetMapping("/recursos")
    public java.util.Map<String, Object> recursos() {
        return java.util.Map.of("versaoControleEstoque", 1, "versaoCustosProdutos", 1, "versaoMargensCatalogo", 1, "tiposEstoque", TipoEstoque.values());
    }

    @GetMapping("/catalogo")
    public ResponseEntity<List<Produto>> listarCatalogo() {
        var agora = java.time.Instant.now();
        return ResponseEntity.ok(produtoRepository.findByEmpresaIdAndAtivoTrue(getEmpresaId()).stream()
                .filter(p -> ControleEstoque.catalogavel(p, agora)).toList());
    }

    @GetMapping("/catalogo/{id}")
    public ResponseEntity<Produto> buscarNoCatalogo(@PathVariable String id) {
        return produtoRepository.findByIdAndEmpresaIdAndAtivoTrue(id, getEmpresaId())
                .filter(p -> ControleEstoque.catalogavel(p, java.time.Instant.now()))
                .map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    // A CORREÇÃO: Passa o ID limpo (10 dígitos) direto para o banco
    @GetMapping("/{id}")
    public ResponseEntity<Produto> buscarPorId(@PathVariable String id) {
        return produtoRepository.findByIdAndEmpresaIdAndAtivoTrue(id, getEmpresaId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> salvarProduto(@RequestBody Produto produto) {
        validarProduto(produto, true);
        Usuario usuarioLogado = getUsuarioLogado();
        produto.setEmpresa(usuarioLogado.getEmpresa());
        ControleEstoque.configurar(produto, produto, java.time.Instant.now(), true);

        // Busca se o produto já existe usando o ID limpo
        Optional<Produto> existenteOpt = produtoRepository.buscarParaAlteracao(produto.getId(), getEmpresaId());

        if (existenteOpt.isPresent()) {
            Produto existente = existenteOpt.get();
            if (!existente.isAtivo()) {
                existente.setNome(produto.getNome());
                existente.setMarca(produto.getMarca());
                existente.setPreco(produto.getPreco());
                existente.setCustoUnitario(produto.getCustoUnitario());
                ControleEstoque.configurar(existente, produto, java.time.Instant.now(), true);
                existente.setImagemUrl(produto.getImagemUrl());
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
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> inativarProduto(@PathVariable String id) {
        // A CORREÇÃO: Usa o ID limpo para exclusão
        Optional<Produto> prodOpt = produtoRepository.buscarParaVenda(id, getEmpresaId());

        if (prodOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        Produto produto = prodOpt.get();

        produto.setAtivo(false);
        produtoRepository.save(produto);

        return ResponseEntity.noContent().build();
    }
    
    @PutMapping("/{id}/adicionar-estoque")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> adicionarEstoque(@PathVariable String id, @RequestBody java.util.Map<String, Integer> payload) {
        Optional<Produto> prodOpt = produtoRepository.buscarParaVenda(id, getEmpresaId());

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
        if (produto.getTipoEstoque() == TipoEstoque.COTA_TEMPO) {
            throw new IllegalArgumentException("Produtos com cota não recebem estoque físico. Edite o limite da cota.");
        }
        if (qtdAdicional > Integer.MAX_VALUE - produto.getEstoque()) {
            throw new IllegalArgumentException("Quantidade acima do limite de estoque.");
        }
        produto.setEstoque(produto.getEstoque() + qtdAdicional);
        Produto atualizado = produtoRepository.save(produto);

        return ResponseEntity.ok(atualizado);
    }

    @PutMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> atualizarProduto(@PathVariable String id, @RequestBody Produto produtoAtualizado) {
        validarProduto(produtoAtualizado, false);
        return produtoRepository.buscarParaVenda(id, getEmpresaId()).map(produto -> {
            ControleEstoque.configurar(produto, produtoAtualizado, java.time.Instant.now(), false);
            produto.setNome(produtoAtualizado.getNome());
            produto.setMarca(produtoAtualizado.getMarca());
            produto.setPreco(produtoAtualizado.getPreco());
            if (produtoAtualizado.isCustoUnitarioInformado()) produto.setCustoUnitario(produtoAtualizado.getCustoUnitario());
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
