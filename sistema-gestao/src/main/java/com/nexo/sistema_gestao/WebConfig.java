package com.nexo.sistema_gestao;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;

@Configuration
public class WebConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        
        // Define as origens permitidas explicitamente em vez de "*"
        config.setAllowedOrigins(Arrays.asList(
            "http://localhost:5173", // Para desenvolvimento local (Vite/React)
            "http://localhost:3000", // Alternativa de porta
            "https://sua-aplicacao.vercel.app" // Adicione aqui a futura URL do seu Vercel
        ));
        
        config.setAllowedHeaders(Arrays.asList("Origin", "Content-Type", "Accept", "Authorization"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowCredentials(true); // Permite envio de cookies e cabeçalhos de autenticação (JWT)

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config); // Aplica a regra a todas as rotas
        return new CorsFilter(source);
    }
}