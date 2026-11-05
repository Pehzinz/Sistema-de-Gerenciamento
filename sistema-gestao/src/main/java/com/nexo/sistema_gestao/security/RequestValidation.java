package com.nexo.sistema_gestao.security;

import java.nio.charset.StandardCharsets;

/** Valida limites antes de persistir dados ou executar operações caras. */
public final class RequestValidation {
    private RequestValidation() {}

    public static void text(String value, int max, String field) {
        if (value == null || value.isBlank() || value.length() > max) {
            throw new IllegalArgumentException(field + " é obrigatório e deve ter até " + max + " caracteres.");
        }
    }

    public static void password(String value) {
        if (value == null || value.length() < 12 || value.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("A senha deve ter ao menos 12 caracteres e até 72 bytes.");
        }
    }
}
