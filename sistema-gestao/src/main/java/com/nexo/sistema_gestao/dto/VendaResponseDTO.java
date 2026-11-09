package com.nexo.sistema_gestao.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record VendaResponseDTO(
    Long id,
    String formaPagamento,
    BigDecimal total,
    LocalDateTime dataVenda,
    List<ItemDetalhadoDTO> itens // Lista explícita que o React vai ler!
) {
    public record ItemDetalhadoDTO(
        String produtoId, 
        String nomeProduto,
        Integer quantidade,
        BigDecimal precoUnitario,
        BigDecimal precoOriginalProduto,
        String nomeCategoria
    ) {}
}
