package com.nexo.sistema_gestao.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/** Limite local por instância; para réplicas, compartilhar limites no gateway/Redis. */
@Component
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {
    private final Cache<String, AtomicInteger> attempts = Caffeine.newBuilder()
            .maximumSize(10000).expireAfterWrite(Duration.ofMinutes(1)).build();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getServletPath();
        int limit = switch (path) {
            case "/api/registro", "/api/usuarios" -> 5;
            case "/api/uploads/assinatura" -> 10;
            case "/api/login", "/api/agente/perguntar" -> 30;
            default -> 0;
        };
        if ("POST".equals(request.getMethod()) && limit > 0) {
            String key = path + ":" + request.getRemoteAddr();
            if (attempts.get(key, ignored -> new AtomicInteger()).incrementAndGet() > limit) {
                response.setStatus(429);
                response.setHeader("Retry-After", "60");
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"erro\":\"Muitas tentativas. Aguarde um minuto.\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
