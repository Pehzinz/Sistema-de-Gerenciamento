package com.nexo.sistema_gestao;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class WebConfig {

    // Origens (sites) autorizadas a chamar a API, separadas por vírgula.
    // Para trocar sem mexer no código: crie a variável CORS_ALLOWED_ORIGINS no Railway (serviço do back-end).
    @Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173,http://localhost:3000,https://nexo-gestao.up.railway.app}")
    private String origensPermitidas;

    // O Spring Security usa automaticamente o bean "corsConfigurationSource" (ver .cors(...) em SecurityConfigurations).
    // Assim o preflight (OPTIONS) é respondido ANTES da autenticação e já com os cabeçalhos CORS corretos.
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> origens = Arrays.stream(origensPermitidas.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .map(o -> o.endsWith("/") ? o.substring(0, o.length() - 1) : o) // "https://site/" -> "https://site"
                .toList();

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origens);                                   // nada de "*"
        config.setAllowedHeaders(List.of("Origin", "Content-Type", "Accept", "Authorization"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowCredentials(false);                                   // o JWT vai no header Authorization, não em cookie
        config.setMaxAge(3600L);                                             // o navegador guarda a resposta do preflight por 1h

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
