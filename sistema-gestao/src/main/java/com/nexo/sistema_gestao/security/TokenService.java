package com.nexo.sistema_gestao.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTCreationException;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.nexo.sistema_gestao.model.Usuario;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.springframework.beans.factory.annotation.Value;

@Service
public class TokenService {

    // Em um ambiente real de nuvem, essa chave vem de uma variável de ambiente, nunca fica exposta no código.
    // Como estamos em desenvolvimento local, vamos fixar uma string secreta.
    @Value("${api.security.token.secret}")
    private String secret;

    public String gerarToken(Usuario usuario) {
        try {
            Algorithm algoritmo = Algorithm.HMAC256(secret);
            return JWT.create()
                    .withIssuer("SistemaGestao_Nexo")
                    .withSubject(usuario.getCpf())
                    .withClaim("perfil", usuario.getPerfil())
                    .withClaim("empresa_id", usuario.getEmpresa().getId()) // NOVO: Guarda o ID da empresa no Token
                    .withExpiresAt(gerarDataExpiracao())
                    .sign(algoritmo);
        } catch (JWTCreationException exception) {
            throw new RuntimeException("Erro ao gerar token JWT", exception);
        }
    }

    public String validarToken(String token) {
        try {
            Algorithm algoritmo = Algorithm.HMAC256(secret);
            return JWT.require(algoritmo)
                    .withIssuer("SistemaGestao_Nexo")
                    .build()
                    .verify(token)
                    .getSubject(); // Retorna o CPF se o token for válido e não estiver expirado
        } catch (JWTVerificationException exception) {
            return ""; // Token inválido ou expirado
        }
    }

    public Long extrairEmpresaId(String token) {
        try {
            Algorithm algoritmo = Algorithm.HMAC256(secret);
            return JWT.require(algoritmo)
                    .withIssuer("SistemaGestao_Nexo")
                    .build()
                    .verify(token)
                    .getClaim("empresa_id").asLong(); // Lê a empresa do Token
        } catch (JWTVerificationException exception) {
            return null;
        }
    }

    private Instant gerarDataExpiracao() {
        // O token expira em 2 horas. Depois disso, o usuário precisará fazer login novamente.
        return LocalDateTime.now().plusHours(2).toInstant(ZoneOffset.of("-03:00"));
    }
}