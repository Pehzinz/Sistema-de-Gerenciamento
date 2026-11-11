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
import java.util.Objects;

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
            var token = tokenService.validarToken(tokenJWT);
            if (token != null && token.getSubject() != null) {
                Long empresaId = token.getClaim("empresa_id").asLong();
                String versao = token.getClaim("versao_credencial").asString();
                var usuarioOpt = repository.findByCpfAndAtivoTrue(token.getSubject()).stream()
                        .filter(u -> u.getEmpresa() != null && u.getEmpresa().getId().equals(empresaId)
                                && Objects.equals(versao, u.getVersaoCredencial()))
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
