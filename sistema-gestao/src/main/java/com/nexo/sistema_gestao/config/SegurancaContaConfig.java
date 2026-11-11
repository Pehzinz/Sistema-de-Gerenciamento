package com.nexo.sistema_gestao.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration(proxyBeanMethods = false)
public class SegurancaContaConfig {
    @Bean
    Clock relogioSegurancaConta() {
        return Clock.systemUTC();
    }
}
