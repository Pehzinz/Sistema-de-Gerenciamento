package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.repository.ProdutoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProdutoService {
    @Autowired private ProdutoRepository repo;

    @Transactional
    public void baixarEstoque(String produtoId, int qtdVendida, Long empresaId) {
        var produto = repo.buscarParaVenda(produtoId, empresaId)
                .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado nesta empresa."));
        ControleEstoque.consumir(produto, qtdVendida, java.time.Instant.now());
    }
}
