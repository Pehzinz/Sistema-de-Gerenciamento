package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.dto.ItemVendaRequestDTO;
import com.nexo.sistema_gestao.dto.VendaRequestDTO;
import com.nexo.sistema_gestao.dto.VendaResponseDTO;
import com.nexo.sistema_gestao.dto.VendaResponseDTO.ItemDetalhadoDTO;
import com.nexo.sistema_gestao.model.ItemVenda;
import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.model.Venda;
import com.nexo.sistema_gestao.repository.VendaRepository;
import com.nexo.sistema_gestao.service.VendaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/vendas")
public class VendaController {

    @Autowired
    private VendaService vendaService;

    @Autowired
    private VendaRepository vendaRepository;

    // MÁGICA DA BIG TECH: Salva o resultado na RAM ("dashboardVendas"). 
    // O 1º acesso pode levar 500ms, os próximos levarão 5ms.
    @GetMapping
    @Cacheable("dashboardVendas") 
    public ResponseEntity<List<VendaResponseDTO>> listarVendas() {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        Usuario usuarioLogado = (Usuario) authentication.getPrincipal();
        Long empresaId = usuarioLogado.getEmpresa().getId();

        List<Venda> vendasEntity = vendaRepository.findByEmpresaId(empresaId);

        List<VendaResponseDTO> vendasResponse = vendasEntity.stream().map(venda -> {
            List<ItemDetalhadoDTO> itensDetalhados = venda.getItens().stream().map(item -> {
                String nomeProduto = item.getProduto() != null ? item.getProduto().getNome() : "Produto Desconhecido";
                String idProduto = item.getProduto() != null ? item.getProduto().getId() : "N/A";
                java.math.BigDecimal precoOrig = item.getProduto() != null ? 
                    java.math.BigDecimal.valueOf(item.getProduto().getPreco()) : item.getPrecoUnitario();

                return new ItemDetalhadoDTO(idProduto, nomeProduto, item.getQuantidade(), item.getPrecoUnitario(), precoOrig);
            }).collect(Collectors.toList());

            return new VendaResponseDTO(venda.getId(), venda.getFormaPagamento(), venda.getTotal(), venda.getDataVenda(), itensDetalhados);
        }).collect(Collectors.toList());

        return ResponseEntity.ok(vendasResponse);
    }

    // @CacheEvict limpa a memória RAM sempre que uma venda nova acontece, forçando o Dashboard a se atualizar
    @PostMapping
    @CacheEvict(value = "dashboardVendas", allEntries = true) 
    public ResponseEntity<?> realizarVenda(@RequestBody VendaRequestDTO request) {
        try {
            var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            Usuario usuarioLogado = (Usuario) authentication.getPrincipal();

            Venda venda = new Venda();
            Usuario usuario = new Usuario();
            usuario.setId(request.usuarioId());
            
            venda.setUsuario(usuario);
            venda.setEmpresa(usuarioLogado.getEmpresa());
            venda.setFormaPagamento(request.formaPagamento());
            venda.setTotal(request.total());

            List<ItemVenda> itens = new ArrayList<>();
            for (ItemVendaRequestDTO itemDTO : request.itens()) {
                ItemVenda item = new ItemVenda();
                Produto produto = new Produto();
                
                String idInterno = usuarioLogado.getEmpresa().getId() + "-" + itemDTO.produtoId();
                produto.setIdInterno(idInterno);
                produto.setId(itemDTO.produtoId()); 
                
                item.setProduto(produto);
                item.setQuantidade(itemDTO.quantidade());
                item.setPrecoUnitario(itemDTO.precoUnitario());
                item.setSubtotal(itemDTO.subtotal());
                
                itens.add(item);
            }

            // Realiza a venda otimizada em Lote (Batch)
            vendaService.finalizarVenda(venda, itens);
            
            // CORREÇÃO DA LENTIDÃO DO CAIXA: Em vez de devolver um objeto colossal para o React, 
            // devolvemos apenas uma string leve dizendo que deu certo. A latência cai para zero.
            return ResponseEntity.status(HttpStatus.CREATED).body("{\"mensagem\": \"Venda concluída com sucesso\"}");

        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("{\"erro\": \"" + e.getMessage() + "\"}");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("{\"erro\": \"Falha interna no servidor.\"}");
        }
    }
}