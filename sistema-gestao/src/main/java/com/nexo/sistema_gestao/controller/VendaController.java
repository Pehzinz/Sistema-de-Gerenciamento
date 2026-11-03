package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.dto.ItemVendaRequestDTO;
import com.nexo.sistema_gestao.dto.VendaRequestDTO;
import com.nexo.sistema_gestao.dto.VendaResponseDTO;
import com.nexo.sistema_gestao.model.ItemVenda;
import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.model.Venda;
import com.nexo.sistema_gestao.service.VendaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/vendas")
public class VendaController {

    @Autowired
    private VendaService vendaService;

    public Long getEmpresaId() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return ((Usuario) auth.getPrincipal()).getEmpresa().getId();
    }

    @GetMapping
    public ResponseEntity<List<VendaResponseDTO>> listarVendas() {
        return ResponseEntity.ok(vendaService.obterVendasParaDashboard(getEmpresaId()));
    }

    @PostMapping
    @Caching(evict = {
        @CacheEvict(value = "dashboardVendas", key = "#root.target.getEmpresaId()"),
        @CacheEvict(value = "estatisticasRegressao", key = "#root.target.getEmpresaId()"),
        @CacheEvict(value = "estatisticasCurva", key = "#root.target.getEmpresaId()"),
        @CacheEvict(value = "estatisticasTrafego", key = "#root.target.getEmpresaId()")
    })
    public ResponseEntity<?> realizarVenda(@RequestBody VendaRequestDTO request) {
        try {
            Long empresaId = getEmpresaId();
            Venda venda = new Venda();
            Usuario usuario = new Usuario();
            usuario.setId(request.usuarioId());
            
            venda.setUsuario(usuario);
            com.nexo.sistema_gestao.model.Empresa empresa = new com.nexo.sistema_gestao.model.Empresa();
            empresa.setId(empresaId);
            venda.setEmpresa(empresa);
            
            venda.setFormaPagamento(request.formaPagamento());
            venda.setTotal(request.total());

            List<ItemVenda> itens = new ArrayList<>();
            for (ItemVendaRequestDTO itemDTO : request.itens()) {
                ItemVenda item = new ItemVenda();
                Produto produto = new Produto();
                
                String idInterno = empresaId + "-" + itemDTO.produtoId();
                produto.setIdInterno(idInterno);
                produto.setId(itemDTO.produtoId()); 
                
                item.setProduto(produto);
                item.setQuantidade(itemDTO.quantidade());
                item.setPrecoUnitario(itemDTO.precoUnitario());
                item.setSubtotal(itemDTO.subtotal());
                
                itens.add(item);
            }

            vendaService.finalizarVenda(venda, itens);
            return ResponseEntity.status(HttpStatus.CREATED).body("{\"mensagem\": \"Venda concluída com sucesso\"}");

        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("{\"erro\": \"" + e.getMessage() + "\"}");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("{\"erro\": \"Falha interna no servidor.\"}");
        }
    }
}