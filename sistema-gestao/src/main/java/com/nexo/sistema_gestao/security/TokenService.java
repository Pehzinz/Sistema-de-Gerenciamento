package com.nexo.sistema_gestao.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTCreationException;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.nexo.sistema_gestao.model.Usuario;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;

@Service
public class TokenService {
    private static final String EMISSOR_EDICAO_USUARIO = "SistemaGestao_Nexo_edicao_usuario";

    // Segredo injetado pelo ambiente; nenhuma chave de produção deve estar no repositório.
    @Value("${api.security.token.secret}")
    private String secret;

    @jakarta.annotation.PostConstruct
    void validarSegredo() {
        if (secret == null || secret.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET deve conter ao menos 32 bytes aleatórios.");
        }
    }

    public String gerarToken(Usuario usuario) {
        try {
            Algorithm algoritmo = Algorithm.HMAC256(secret);
            return JWT.create()
                    .withIssuer("SistemaGestao_Nexo")
                    .withSubject(usuario.getCpf())
                    .withClaim("perfil", usuario.getPerfil())
                    .withClaim("empresa_id", usuario.getEmpresa().getId()) // NOVO: Guarda o ID da empresa no Token
                    .withClaim("versao_credencial", usuario.getVersaoCredencial())
                    .withExpiresAt(gerarDataExpiracao())
                    .sign(algoritmo);
        } catch (JWTCreationException exception) {
            throw new RuntimeException("Erro ao gerar token JWT", exception);
        }
    }

    public DecodedJWT validarToken(String token) {
        try {
            Algorithm algoritmo = Algorithm.HMAC256(secret);
            return JWT.require(algoritmo)
                    .withIssuer("SistemaGestao_Nexo")
                    .build()
                    .verify(token);
        } catch (JWTVerificationException exception) {
            return null;
        }
    }

    public String gerarAutorizacaoEdicao(Usuario administrador, Long usuarioId) {
        return JWT.create()
                .withIssuer(EMISSOR_EDICAO_USUARIO)
                .withSubject(administrador.getId().toString())
                .withClaim("empresa_id", administrador.getEmpresa().getId())
                .withClaim("usuario_editado_id", usuarioId)
                .withClaim("versao_credencial", administrador.getVersaoCredencial())
                .withExpiresAt(Instant.now().plusSeconds(900))
                .sign(Algorithm.HMAC256(secret));
    }

    public boolean autorizacaoEdicaoValida(String token, Usuario administrador, Long usuarioId) {
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            var autorizacao = JWT.require(Algorithm.HMAC256(secret))
                    .withIssuer(EMISSOR_EDICAO_USUARIO)
                    .withSubject(administrador.getId().toString())
                    .withClaim("empresa_id", administrador.getEmpresa().getId())
                    .withClaim("usuario_editado_id", usuarioId)
                    .withClaimPresence("exp")
                    .build()
                    .verify(token);
            return Objects.equals(autorizacao.getClaim("versao_credencial").asString(),
                    administrador.getVersaoCredencial());
        } catch (JWTVerificationException e) {
            return false;
        }
    }

    private Instant gerarDataExpiracao() {
        // O token expira em 2 horas. Depois disso, o usuário precisará fazer login novamente.
        return Instant.now().plusSeconds(7200);
    }
}
