package com.nexo.sistema_gestao.config;

import com.nexo.sistema_gestao.service.TelegramService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;

@Configuration
public class TelegramConfig {

    @Bean
    public TelegramBotsApi telegramBotsApi(TelegramService telegramService) {
        try {
            // Cria a sessão de escuta oficial do Telegram
            TelegramBotsApi api = new TelegramBotsApi(DefaultBotSession.class);
            // Registra o nosso bot (TelegramService) para começar a ouvir as mensagens
            api.registerBot(telegramService);
            System.out.println("📻 Antena do Telegram conectada com sucesso! Bot está ouvindo.");
            return api;
        } catch (TelegramApiException e) {
            System.err.println("❌ Erro ao registrar o Bot do Telegram: " + e.getMessage());
            return null;
        }
    }
}