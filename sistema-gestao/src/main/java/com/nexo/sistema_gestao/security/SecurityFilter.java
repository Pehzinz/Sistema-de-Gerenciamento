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

        var tokenJWT = recuperarToken(request);

        if (tokenJWT != null) {
            // 1. Descobre o CPF dono do Token
            var subject = tokenService.validarToken(tokenJWT);
            
            if (subject != null && !subject.isEmpty()) {
                
                // 2. Descobre o ID da Empresa gravado no Token
                Long empresaId = tokenService.extrairEmpresaId(tokenJWT);
                
                // 3. Busca todas as contas (em qualquer empresa) que usam este CPF
                var contasDoCpf = repository.findByCpfAndAtivoTrue(subject);

                // 4. Filtra a lista para encontrar EXATAMENTE a conta que pertence à empresa do Token
                var usuarioOpt = contasDoCpf.stream()
                        .filter(u -> u.getEmpresa() != null && u.getEmpresa().getId().equals(empresaId))
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
        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            return authorizationHeader.substring(7);
        }
        return null;
    }
}
