package com.nexo.sistema_gestao.dto;

public record LoginRequestDTO(
    String cnpj,
    String cpf,
    String senha
) {}