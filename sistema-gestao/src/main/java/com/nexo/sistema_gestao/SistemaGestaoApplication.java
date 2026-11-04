package com.nexo.sistema_gestao;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching; // 1. Importe o Cache

@SpringBootApplication
@EnableCaching // 2. Ligue o motor de Cache da memória RAM
public class SistemaGestaoApplication {
    public static void main(String[] args) {
        SpringApplication.run(SistemaGestaoApplication.class, args);
    }
}