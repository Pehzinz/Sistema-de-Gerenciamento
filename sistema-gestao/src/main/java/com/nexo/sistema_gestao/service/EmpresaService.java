package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EmpresaService {

    @Autowired private EmpresaRepository empresaRepository;
    @Autowired private ProdutoRepository produtoRepository;
    @Autowired private CategoriaRepository categoriaRepository;
    @Autowired private VendaRepository vendaRepository;
    @Autowired private EventoRepository eventoRepository;
    @Autowired private UsuarioRepository usuarioRepository;

    // Zera o estoque físico e esconde da loja, mas preserva a linha para relatórios
    @Transactional
    public void limparEstoqueDaEmpresa(Long empresaId) {
        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaId);
        for (Produto produto : produtos) {
            produto.setEstoque(0);
            produto.setAtivo(false);
            produtoRepository.save(produto);
        }
    }

    @Transactional
    public void excluirEmpresaCascata(Long empresaId) {
        
        var vendas = vendaRepository.findByEmpresaId(empresaId);
        vendaRepository.deleteAll(vendas); 

        var produtos = produtoRepository.findByEmpresaId(empresaId);
        produtoRepository.deleteAll(produtos);

        var categorias = categoriaRepository.findByEmpresaId(empresaId);
        categoriaRepository.deleteAll(categorias);

        var eventos = eventoRepository.findByEmpresaId(empresaId);
        eventoRepository.deleteAll(eventos);

        var usuarios = usuarioRepository.findByEmpresaId(empresaId);
        usuarioRepository.deleteAll(usuarios);

        empresaRepository.deleteById(empresaId);
    }
}