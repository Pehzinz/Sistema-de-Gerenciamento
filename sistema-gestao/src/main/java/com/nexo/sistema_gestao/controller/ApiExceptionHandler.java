package com.nexo.sistema_gestao.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<?> databaseFailure(org.springframework.dao.DataAccessException exception) {
        log.error("Falha ao acessar o banco de dados. Confira conexão, permissões e existência das tabelas nos Deploy Logs.", exception);
        return ResponseEntity.status(503).body(Map.of("erro",
                "Não foi possível acessar o banco de dados. O administrador precisa verificar a conexão e as tabelas do sistema."));
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<?> unreadableRequest(org.springframework.http.converter.HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest().body(Map.of("erro", "Os dados enviados são inválidos. Confira o formulário e tente novamente."));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<?> conflict(org.springframework.dao.DataIntegrityViolationException exception) {
        return ResponseEntity.status(409).body(Map.of("erro", "Os dados conflitam com um cadastro existente ou possuem vínculos que impedem a operação."));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> invalidInput(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("erro", exception.getMessage()));
    }
}
