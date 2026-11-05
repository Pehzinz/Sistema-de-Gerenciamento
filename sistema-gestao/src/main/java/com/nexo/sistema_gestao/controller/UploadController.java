package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.model.Usuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {
    private final String cloudName, apiKey, apiSecret;

    public UploadController(@Value("${CLOUDINARY_CLOUD_NAME:}") String cloudName,
                            @Value("${CLOUDINARY_API_KEY:}") String apiKey,
                            @Value("${CLOUDINARY_API_SECRET:}") String apiSecret) {
        this.cloudName = cloudName.trim(); this.apiKey = apiKey.trim(); this.apiSecret = apiSecret.trim();
        if (!this.cloudName.isEmpty() && !this.cloudName.matches("[a-zA-Z0-9_-]+")) {
            throw new IllegalArgumentException("CLOUDINARY_CLOUD_NAME deve conter apenas o nome da conta, sem URL ou @.");
        }
    }

    @PostMapping("/assinatura")
    public ResponseEntity<?> assinatura() throws java.security.NoSuchAlgorithmException {
        if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            return ResponseEntity.status(503).body(Map.of("erro", "O upload de imagens ainda não foi configurado pelo administrador."));
        }
        Usuario usuario = (Usuario) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Map<String, String> params = new TreeMap<>();
        params.put("allowed_formats", "jpg,png,webp");
        params.put("folder", "nexo/" + usuario.getEmpresa().getId());
        params.put("overwrite", "false");
        params.put("public_id", UUID.randomUUID().toString());
        params.put("timestamp", Long.toString(Instant.now().getEpochSecond()));
        String payload = params.entrySet().stream().map(e -> e.getKey() + "=" + e.getValue()).collect(Collectors.joining("&"));
        String signature = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest((payload + apiSecret).getBytes(StandardCharsets.UTF_8)));
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(Map.of("cloudName", cloudName, "apiKey", apiKey, "signature", signature, "params", params));
    }
}
