package com.nexo.sistema_gestao.security;

import com.nexo.sistema_gestao.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class SecurityFilter extends OncePerRequestFilter {

    @Autowired
    private TokenService tokenService;

    @Autowired
    private UsuarioRepository repository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
    
    // Força a injeção do cabeçalho CORS em todas as requisições para evitar o net::ERR_FAILED
    response.setHeader("Access-Control-Allow-Origin", "https://sweet-enchantment-production-d326.up.railway.app");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "authorization, content-type, xsrf-token");
    response.addHeader("Access-Control-Expose-Headers", "xsrf-token");
    
    if ("OPTIONS".equals(request.getMethod())) {
        response.setStatus(HttpServletResponse.SC_OK);
        return;
    }

    var tokenJWT = recuperarToken(request);

        if (tokenJWT != null) {
            // 1. Descobre o CPF dono do Token
            var subject = tokenService.validarToken(tokenJWT);
            
            if (subject != null && !subject.isEmpty()) {
                
                // 2. Descobre o ID da Empresa gravado no Token
                Long empresaId = tokenService.extrairEmpresaId(tokenJWT);
                
                // 3. Busca todas as contas (em qualquer empresa) que usam este CPF
                var contasDoCpf = repository.findByCpf(subject);

                // 4. Filtra a lista para encontrar EXATAMENTE a conta que pertence à empresa do Token
                var usuarioOpt = contasDoCpf.stream()
                        .filter(u -> u.getEmpresa().getId().equals(empresaId))
                        .findFirst();

                if (usuarioOpt.isPresent()) {
                    var usuario = usuarioOpt.get();
                    
                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + usuario.getPerfil().toUpperCase()));
                    
                    var authentication = new UsernamePasswordAuthenticationToken(usuario, null, authorities); 
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    private String recuperarToken(HttpServletRequest request) {
        var authorizationHeader = request.getHeader("Authorization");
        if (authorizationHeader != null) {
            return authorizationHeader.replace("Bearer ", "");
        }
        return null;
    }
}