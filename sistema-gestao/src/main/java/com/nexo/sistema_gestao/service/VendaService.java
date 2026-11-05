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
    private com.nexo.sistema_gestao.repository.ProdutoRepository produtoRepo;

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
            if (itens == null || itens.isEmpty() || itens.size() > 200) {
                throw new IllegalArgumentException("Informe de 1 a 200 itens por venda.");
            }
            // Ordem estável evita deadlocks entre caixas que vendem os mesmos produtos.
            itens.sort(java.util.Comparator.comparing(item -> item.getProduto().getId()));
            java.math.BigDecimal total = java.math.BigDecimal.ZERO;
            java.time.LocalDate hoje = java.time.LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo"));
            for (ItemVenda item : itens) {
                if (item.getQuantidade() == null || item.getQuantidade() <= 0) {
                    throw new IllegalArgumentException("A quantidade deve ser positiva.");
                }
                var produto = produtoRepo.buscarParaVenda(item.getProduto().getId(), venda.getEmpresa().getId())
                        .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado ou inativo."));
                if (produto.getEstoque() < item.getQuantidade()) {
                    throw new IllegalStateException("Estoque insuficiente para " + produto.getNome());
                }
                double preco = produto.getPreco();
                if (produto.getPrecoPromocional() != null && produto.getDataInicioPromocao() != null
                        && produto.getDataFimPromocao() != null && !hoje.isBefore(produto.getDataInicioPromocao())
                        && !hoje.isAfter(produto.getDataFimPromocao())) {
                    preco = produto.getPrecoPromocional();
                }
                var unitario = java.math.BigDecimal.valueOf(preco).setScale(2, java.math.RoundingMode.HALF_UP);
                item.setProduto(produto);
                item.setPrecoUnitario(unitario);
                item.setSubtotal(unitario.multiply(java.math.BigDecimal.valueOf(item.getQuantidade())));
                total = total.add(item.getSubtotal());
                produto.setEstoque(produto.getEstoque() - item.getQuantidade());
            }
            if (venda.getTotal() == null || total.compareTo(venda.getTotal()) != 0) {
                throw new IllegalArgumentException("Os preços mudaram. Atualize o carrinho antes de concluir a venda.");
            }
            venda.setTotal(total);
            Venda vendaSalva = vendaRepo.save(venda);

            for(ItemVenda item : itens){
                item.setVenda(vendaSalva);
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
