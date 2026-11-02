package com.nexo.sistema_gestao.service;
import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.repository.ProdutoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.Optional;

@Service 
public class ProdutoService {
    
    @Autowired 
    private ProdutoRepository repo;

    public void baixarEstoque(String produtoId, int qtdVendida, Long empresaId){
        try{
            // Validando se o produto existe no sistema E PERTENCE À EMPRESA DA VENDA
            Optional<Produto> produtoOpt = repo.findByIdAndEmpresaId(produtoId, empresaId);
            if(produtoOpt.isEmpty()){
                throw new IllegalArgumentException("Erro: Produto com ID " + produtoId + " não encontrado nesta Empresa.");
            }

            Produto produto = produtoOpt.get();  

            if(qtdVendida <= 0){
                throw new IllegalArgumentException("Erro: Quantidade vendida deve ser maior que zero!");
            }
            
            if(produto.getEstoque() < qtdVendida){
                throw new IllegalStateException("Erro: Estoque insuficiente para o produto: " + produto.getNome() + ". Estoque atual: " + produto.getEstoque());
            }

            int novoEstoque = produto.getEstoque() - qtdVendida;
            produto.setEstoque(novoEstoque);
            repo.save(produto);

        } catch (IllegalArgumentException | IllegalStateException e) {
            System.err.println("FALHA NA VALIDAÇÃO DE ESTOQUE: " + e.getMessage());
            throw e; 
        } catch (Exception e) {
            System.err.println("ERRO CRÍTICO AO ACESSAR O BANCO: " + e.getMessage());
            throw new RuntimeException("Erro interno ao processar o estoque.", e);
        }
    }
}