package com.nexo.sistema_gestao.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpStatusCodeException;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private static final String GEMINI_API_KEY = "CHAVE_NO_SERVIDOR"; 
    private static final String GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;
    // --- CONTROLE DE LIMITES (RATE LIMITER) ---
    private int requisicoesHoje = 0;
    private LocalDate dataContagem = LocalDate.now();
    private final int LIMITE_DIARIO = 20;

    public String perguntarParaIA(String promptContextualizado) {
        // 1. Zera a conta à meia-noite
        if (!LocalDate.now().equals(dataContagem)) {
            requisicoesHoje = 0;
            dataContagem = LocalDate.now();
        }

        // 2. Trava de segurança do limite diário
        if (requisicoesHoje >= LIMITE_DIARIO) {
            return "⚠️ *LIMITE DIÁRIO ESGOTADO!* Você já consumiu as " + LIMITE_DIARIO + " consultas gratuitas de hoje. Retorne amanhã!";
        }

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> part = new HashMap<>();
        part.put("text", promptContextualizado);
        
        Map<String, Object> content = new HashMap<>();
        content.put("parts", List.of(part));
        
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", List.of(content));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
        
        int maxTentativas = 3;

        // 3. Sistema de Retentativa Automática (Salva a pátria no erro 503)
        for (int tentativa = 1; tentativa <= maxTentativas; tentativa++) {
            try {
                ResponseEntity<String> response = restTemplate.postForEntity(GEMINI_URL, request, String.class);
                ObjectMapper mapper = new ObjectMapper();
                JsonNode root = mapper.readTree(response.getBody());
                
                String respostaIA = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
                
                // Soma a requisição bem-sucedida e envia o aviso se estiver perto do fim
                requisicoesHoje++; 
                if (requisicoesHoje >= 15) {
                    respostaIA += "\n\n*(Aviso do Sistema: Você utilizou " + requisicoesHoje + " de " + LIMITE_DIARIO + " consultas diárias. Seja objetivo!)*";
                }

                return respostaIA;

            // O HttpStatusCodeException captura TANTO erros 400 (limites) QUANTO 500 (servidor fora do ar)
            } catch (HttpStatusCodeException e) {
                int statusCode = e.getStatusCode().value();

                // Se o Google estiver superlotado (503), aguarda 2 segundos e tenta de novo sem o utilizador perceber
                if (statusCode == 503 && tentativa < maxTentativas) {
                    System.out.println("⚠️ Servidor do Google lotado (503). Retentando... " + tentativa);
                    try { Thread.sleep(2000); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    continue; 
                }
                
                if (statusCode == 503) {
                    return "Os servidores gratuitos do Google estão enfrentando alta demanda no momento. Por favor, aguarde alguns segundos e tente novamente.";
                }
                
                if (statusCode == 429) {
                    return "Limite de tráfego por minuto atingido. Aguarde alguns segundos e tente novamente.";
                }

                System.err.println("❌ Erro HTTP do Google: " + statusCode + " - " + e.getResponseBodyAsString());
                return "Erro técnico na comunicação com a IA. Código: " + statusCode;
                
            } catch (Exception e) {
                System.err.println("❌ Erro interno: " + e.getMessage());
                return "Erro de conexão interna: " + e.getMessage();
            }
        }
        return "Erro desconhecido.";
    }
}