package com.nexo.sistema_gestao.dto;

import java.math.BigDecimal;
import java.util.List;

// O 'record' é uma forma moderna e segura do Java criar classes apenas para transporte de dados
public record VendaRequestDTO(
    Long usuarioId, 
    String formaPagamento, 
    BigDecimal total, 
    List<ItemVendaRequestDTO> itens
) {}


/*O DTO é um objeto "mensageiro". Ele serve apenas para carregar os dados do Front-end para o Back-end de forma segura,garantindo que o usuário da internet não
envie informações ocultas para manipular nossas tabelas do banco de dados. Como você está usando o Java 27,usaremos uma funcionalidade moderna chamada record, 
 que cria esses DTOs em uma única linha de código; */