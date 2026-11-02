package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Venda;
import com.nexo.sistema_gestao.model.ItemVenda;
import com.nexo.sistema_gestao.repository.ItemVendaRepository;
import com.nexo.sistema_gestao.repository.VendaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service 
public class VendaService {
    
    @Autowired 
    private VendaRepository vendaRepo;
    
    @Autowired 
    private ItemVendaRepository itemRepo;

    @Autowired 
    private ProdutoService produtoService;

    // Otimização: A anotação @Transactional garante que todas as operações
    // sejam agrupadas num único commit no banco, eliminando o atraso de múltiplos acessos.
    @Transactional 
    public Venda finalizarVenda (Venda venda, List<ItemVenda> itens){
        try{
            // 1. Salva a venda principal
            Venda vendaSalva = vendaRepo.save(venda);
            Long empresaIdVenda = vendaSalva.getEmpresa().getId();

            // 2. Prepara os itens e atualiza os estoques na mesma transação
            for(ItemVenda item : itens){
                item.setVenda(vendaSalva);
                // A baixa no estoque agora ocorre dentro da transação em lote
                produtoService.baixarEstoque(item.getProduto().getId(), item.getQuantidade(), empresaIdVenda);
            } 

            // 3. Salva todos os itens de uma só vez (Batch Insert)
            itemRepo.saveAll(itens);

            return vendaSalva;

        } catch (IllegalArgumentException | IllegalStateException e) {
            System.err.println("VENDA RECUSADA POR REGRA DE NEGÓCIO: " + e.getMessage());
            throw e; 
        } catch (Exception e) {
            System.err.println("ERRO CRÍTICO AO FINALIZAR VENDA: " + e.getMessage());
            throw new RuntimeException("Falha inesperada ao processar a venda. Operação cancelada.", e);
        }
    }
}