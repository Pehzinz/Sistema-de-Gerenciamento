package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.Venda;
import com.nexo.sistema_gestao.repository.ProdutoRepository;
import com.nexo.sistema_gestao.repository.VendaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.methods.updatingmessages.DeleteMessage;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "telegrambots.enabled", havingValue = "true")
public class TelegramService extends TelegramLongPollingBot {
    @Autowired private TelegramSessaoService sessoes;
    @Autowired private ConsultaNegocioService consultas;
    @Autowired private ProdutoRepository produtoRepository;
    @Autowired private VendaRepository vendaRepository;
    @Autowired private GeminiService geminiService;
    @Autowired private EstatisticaService estatisticaService;

    public TelegramService(@org.springframework.beans.factory.annotation.Value("${BOT_TOKEN}") String token) {
        super(token);
    }

    @Override public String getBotUsername() { return "NexoGestao_bot"; }

    @Override public void onUpdateReceived(Update update) {
        if (!update.hasMessage() || !update.getMessage().hasText()
                || !update.getMessage().getChat().isUserChat()
                || update.getMessage().getFrom() == null
                || !update.getMessage().getChatId().equals(update.getMessage().getFrom().getId())) return;
        String chatId = update.getMessage().getChatId().toString();
        String texto = update.getMessage().getText();
        // Senhas não são encaminhadas à IA nem registradas no log.
        if (sessoes.aguardandoSenha(chatId)) {
            try { execute(new DeleteMessage(chatId, update.getMessage().getMessageId())); }
            catch (TelegramApiException ignored) { /* Exclusão é uma tentativa, não uma garantia. */ }
        }
        try {
            var acesso = sessoes.processar(chatId, texto);
            if (acesso.mensagem() != null) {
                enviarMensagem(chatId, acesso.mensagem());
                return;
            }
            String comando = texto.trim().toLowerCase(java.util.Locale.ROOT);
            if (!"ADMIN".equals(acesso.perfil()) && !java.util.Set.of("/estoque", "/promocoes", "/ofertas",
                    "/alerta", "/alertas", "/ruptura", "/ajuda").contains(comando)) {
                enviarMensagem(chatId, "Seu perfil permite consultar estoque, promoções e alertas de estoque. Use /ajuda.");
                return;
            }
            if (comando.equals("/ajuda")) {
                enviarMensagem(chatId, TelegramSessaoService.menu(acesso.perfil()));
                return;
            }
            String resposta = consultas.consultar(comando, acesso.empresaId());
            if (resposta != null) enviarMensagem(chatId, resposta);
            else if (comando.startsWith("/")) enviarMensagem(chatId, "Comando desconhecido. Use /ajuda.");
            else responderComIA(chatId, texto, acesso.empresaId());
        } catch (RuntimeException exception) {
            enviarMensagem(chatId, "Não foi possível consultar os dados agora. Tente novamente.");
        }
    }

    public void enviarMensagem(String chatId, String texto) {
        // Texto simples evita interpretar nomes de produtos como marcação do Telegram.
        for (int inicio = 0; inicio < texto.length(); inicio += 4000) {
            SendMessage message = new SendMessage(chatId, texto.substring(inicio, Math.min(inicio + 4000, texto.length())));
            try { execute(message); }
            catch (TelegramApiException exception) {
                org.slf4j.LoggerFactory.getLogger(TelegramService.class).warn("Falha ao enviar resposta do Telegram");
            }
        }
    }

    private void responderComIA(String chatId, String perguntaUsuario, Long empresaId) {
        enviarMensagem(chatId, "⏳ Analisando...");
        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaId);
        List<Venda> vendas = vendaRepository.findByEmpresaId(empresaId);
        BigDecimal faturamento = BigDecimal.ZERO;
        for (Venda v : vendas) { if (v.getTotal() != null) faturamento = faturamento.add(v.getTotal()); }

        Map<String, Object> curvaEFluxo = estatisticaService.calcularCurvaABCFluxo(empresaId);
        String produtoAltaTendencia = (String) curvaEFluxo.get("produtoAltaTendencia");

        StringBuilder contexto = new StringBuilder();
        contexto.append("Você é o Consultor do Nexo Gestão. Para agendar, oriente o usuário a salvar um evento no Calendário. Não execute ações.\n");
        contexto.append("📊 Vendas: ").append(vendas.size()).append(" | Faturamento: R$").append(faturamento).append("\n");
        contexto.append("🚀 Top: ").append(produtoAltaTendencia).append("\n📦 Estoque:\n");
        for(Produto p : produtos) { contexto.append("- ").append(p.getNome()).append(" | R$").append(p.getPreco()).append("\n"); }
        contexto.append("\nPergunta: \"").append(perguntaUsuario).append("\"\n");

        String respostaIA = geminiService.perguntarParaIA(contexto.toString());

        enviarMensagem(chatId, respostaIA);
    }
}
