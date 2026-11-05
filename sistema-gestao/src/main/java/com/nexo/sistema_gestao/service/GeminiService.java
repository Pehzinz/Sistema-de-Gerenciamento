package com.nexo.sistema_gestao.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {
    private final String apiKey;
    private final String model;
    private final RestTemplate client;
    private final ObjectMapper mapper = new ObjectMapper();
    private int requests;
    private LocalDate day = LocalDate.now();

    public GeminiService(@Value("${GEMINI_API_KEY:}") String apiKey,
                         @Value("${GEMINI_MODEL:gemini-2.5-flash}") String model) {
        this.apiKey = apiKey;
        if (!model.matches("[a-zA-Z0-9.-]+")) throw new IllegalArgumentException("GEMINI_MODEL inválido.");
        this.model = model;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(20000);
        client = new RestTemplate(factory);
    }

    private synchronized boolean reserve() {
        if (!day.equals(LocalDate.now())) { day = LocalDate.now(); requests = 0; }
        if (requests >= 20) return false;
        requests++;
        return true;
    }

    public String perguntarParaIA(String prompt) {
        if (apiKey.isBlank()) return "O agente ainda não foi configurado pelo administrador.";
        if (!reserve()) return "Limite diário de consultas atingido. Retorne amanhã.";
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", apiKey);
        var body = Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))));
        try {
            var response = client.postForEntity("https://generativelanguage.googleapis.com/v1beta/models/"
                    + model + ":generateContent", new HttpEntity<>(body, headers), String.class);
            JsonNode text = mapper.readTree(response.getBody()).path("candidates").path(0)
                    .path("content").path("parts").path(0).path("text");
            return text.isTextual() ? text.asText() : "O agente não retornou uma resposta. Tente novamente.";
        } catch (Exception exception) {
            return "Não foi possível consultar o agente agora. Tente novamente mais tarde.";
        }
    }
}
