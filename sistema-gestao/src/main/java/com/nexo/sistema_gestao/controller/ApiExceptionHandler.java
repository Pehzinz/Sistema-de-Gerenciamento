package com.nexo.sistema_gestao.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<?> conflict(org.springframework.dao.DataIntegrityViolationException exception) {
        return ResponseEntity.status(409).body(Map.of("erro", "Os dados conflitam com um cadastro existente ou possuem vínculos que impedem a operação."));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> invalidInput(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("erro", exception.getMessage()));
    }
}
