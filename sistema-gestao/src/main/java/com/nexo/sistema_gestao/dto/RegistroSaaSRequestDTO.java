package com.nexo.sistema_gestao.dto;

public record RegistroSaaSRequestDTO(
    String nomeEmpresa,
    String cnpj,
    String nomeAdmin,
    String cpfAdmin,
    String senhaAdmin,
    String emailAdmin
) {
}
