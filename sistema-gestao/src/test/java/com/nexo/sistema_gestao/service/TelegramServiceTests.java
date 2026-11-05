package com.nexo.sistema_gestao.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.telegram.telegrambots.meta.api.objects.Update;
import static org.mockito.Mockito.*;

class TelegramServiceTests {
    TelegramService bot;
    TelegramSessaoService sessoes;
    ConsultaNegocioService consultas;
    GeminiService ia;
    Update update;

    @BeforeEach void setup() {
        bot = mock(TelegramService.class, CALLS_REAL_METHODS);
        doNothing().when(bot).enviarMensagem(anyString(), anyString());
        sessoes = mock(TelegramSessaoService.class); consultas = mock(ConsultaNegocioService.class);
        ia = mock(GeminiService.class);
        ReflectionTestUtils.setField(bot, "sessoes", sessoes);
        ReflectionTestUtils.setField(bot, "consultas", consultas);
        ReflectionTestUtils.setField(bot, "geminiService", ia);
        update = mock(Update.class, RETURNS_DEEP_STUBS);
        when(update.hasMessage()).thenReturn(true); when(update.getMessage().hasText()).thenReturn(true);
        when(update.getMessage().getChat().isUserChat()).thenReturn(true);
        when(update.getMessage().getChatId()).thenReturn(123L);
        when(update.getMessage().getFrom().getId()).thenReturn(123L);
    }

    @Test void unauthenticatedQuestionsNeverReachDataOrAi() {
        when(update.getMessage().getText()).thenReturn("Como estão as vendas?");
        when(sessoes.processar("123", "Como estão as vendas?"))
                .thenReturn(new TelegramSessaoService.Acesso(null, "Informe o CNPJ", null));
        bot.onUpdateReceived(update);
        verifyNoInteractions(consultas, ia);
    }

    @Test void collaboratorCannotAccessAdministrativeCommandsOrAi() {
        when(sessoes.processar(eq("123"), anyString()))
                .thenReturn(new TelegramSessaoService.Acesso(10L, null, "COLABORADOR"));
        for (String texto : java.util.List.of("/vendas", "/equipe", "/resumo", "/agenda", "/insights", "Analise as vendas")) {
            when(update.getMessage().getText()).thenReturn(texto);
            bot.onUpdateReceived(update);
        }
        verifyNoInteractions(consultas, ia);
        when(update.getMessage().getText()).thenReturn("/estoque");
        when(consultas.consultar("/estoque", 10L)).thenReturn("Estoque da empresa 10");
        bot.onUpdateReceived(update);
        verify(consultas).consultar("/estoque", 10L);
    }

    @Test void groupsAreIgnoredBeforeAuthentication() {
        when(update.getMessage().getChat().isUserChat()).thenReturn(false);
        bot.onUpdateReceived(update);
        verifyNoInteractions(sessoes, consultas, ia);
    }
}
