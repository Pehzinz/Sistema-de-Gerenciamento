package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.dto.VendaResponseDTO;
import com.nexo.sistema_gestao.dto.VendaResponseDTO.ItemDetalhadoDTO;
import com.nexo.sistema_gestao.model.Venda;
import com.nexo.sistema_gestao.model.ItemVenda;
import com.nexo.sistema_gestao.repository.ItemVendaRepository;
import com.nexo.sistema_gestao.repository.VendaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service 
public class VendaService {
    
    @Autowired 
    private VendaRepository vendaRepo;
    
    @Autowired 
    private ItemVendaRepository itemRepo;

    @Autowired 
    private ProdutoService produtoService;

    // CACHE BLINDADO: A chave agora é o ID da Empresa. Não há risco de vazamento de dados!
    @Cacheable(value = "dashboardVendas", key = "#empresaId")
    public List<VendaResponseDTO> obterVendasParaDashboard(Long empresaId) {
        List<Venda> vendasEntity = vendaRepo.findByEmpresaId(empresaId);

        return vendasEntity.stream().map(venda -> {
            List<ItemDetalhadoDTO> itensDetalhados = venda.getItens().stream().map(item -> {
                String nomeProduto = item.getProduto() != null ? item.getProduto().getNome() : "Produto Desconhecido";
                String idProduto = item.getProduto() != null ? item.getProduto().getId() : "N/A";
                java.math.BigDecimal precoOrig = item.getProduto() != null ? 
                    java.math.BigDecimal.valueOf(item.getProduto().getPreco()) : item.getPrecoUnitario();

                return new ItemDetalhadoDTO(idProduto, nomeProduto, item.getQuantidade(), item.getPrecoUnitario(), precoOrig);
            }).collect(Collectors.toList());

            return new VendaResponseDTO(venda.getId(), venda.getFormaPagamento(), venda.getTotal(), venda.getDataVenda(), itensDetalhados);
        }).collect(Collectors.toList());
    }

    @Transactional 
    public Venda finalizarVenda(Venda venda, List<ItemVenda> itens){
        try{
            Venda vendaSalva = vendaRepo.save(venda);
            Long empresaIdVenda = vendaSalva.getEmpresa().getId();

            for(ItemVenda item : itens){
                item.setVenda(vendaSalva);
                produtoService.baixarEstoque(item.getProduto().getId(), item.getQuantidade(), empresaIdVenda);
            } 

            itemRepo.saveAll(itens);
            return vendaSalva;

        } catch (IllegalArgumentException | IllegalStateException e) {
            System.err.println("VENDA RECUSADA: " + e.getMessage());
            throw e; 
        } catch (Exception e) {
            System.err.println("ERRO CRÍTICO: " + e.getMessage());
            throw new RuntimeException("Falha inesperada.", e);
        }
    }
}