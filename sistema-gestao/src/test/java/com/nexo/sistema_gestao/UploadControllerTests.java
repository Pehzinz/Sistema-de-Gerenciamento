package com.nexo.sistema_gestao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexo.sistema_gestao.controller.UploadController;
import com.nexo.sistema_gestao.model.Empresa;
import com.nexo.sistema_gestao.model.Usuario;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import static org.junit.jupiter.api.Assertions.*;

class UploadControllerTests {
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    @Test void signsExactUploadParametersWithoutExposingSecret() throws Exception {
        Empresa empresa = new Empresa(); empresa.setId(42L);
        Usuario usuario = new Usuario(); usuario.setEmpresa(empresa);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(usuario, null, List.of()));
        String secret = "only-a-test-secret";
        var controller = new UploadController(" new-cloud ", " public-api-key ", secret);
        var response = controller.assinatura();
        var body = new ObjectMapper().valueToTree(response.getBody());
        assertEquals("new-cloud", body.path("cloudName").asText());
        assertEquals("public-api-key", body.path("apiKey").asText());
        assertEquals("no-store", response.getHeaders().getCacheControl());
        var params = new TreeMap<String, String>();
        body.path("params").fields().forEachRemaining(entry -> params.put(entry.getKey(), entry.getValue().asText()));
        assertEquals("nexo/42", params.get("folder"));
        assertEquals("jpg,png,webp", params.get("allowed_formats"));
        assertEquals("false", params.get("overwrite"));
        assertNotNull(UUID.fromString(params.get("public_id")));
        assertTrue(Math.abs(Instant.now().getEpochSecond() - Long.parseLong(params.get("timestamp"))) < 5);
        String input = params.entrySet().stream().map(e -> e.getKey() + "=" + e.getValue()).collect(Collectors.joining("&")) + secret;
        String expected = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)));
        assertEquals(expected, body.path("signature").asText());
        assertFalse(body.toString().contains(secret));
        assertFalse(body.has("apiSecret"));
        assertFalse(params.containsKey("upload_preset"));
        assertNotEquals(params.get("public_id"), new ObjectMapper().valueToTree(controller.assinatura().getBody()).path("params").path("public_id").asText());
    }

    @Test void rejectsPastedCloudinaryUrlInsteadOfCloudName() {
        assertThrows(IllegalArgumentException.class,
                () -> new UploadController("cloudinary://key:secret@my-cloud", "key", "secret"));
    }
}
