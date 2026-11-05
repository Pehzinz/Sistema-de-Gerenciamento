package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Evento;
import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.model.Venda;
import com.nexo.sistema_gestao.repository.EventoRepository;
import com.nexo.sistema_gestao.repository.ProdutoRepository;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.repository.VendaRepository;
import com.nexo.sistema_gestao.model.Empresa;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "telegrambots.enabled", havingValue = "true")
public class TelegramService extends TelegramLongPollingBot {

    private final String botToken;
    private static final String BOT_USERNAME = "NexoGestao_bot"; 
    @org.springframework.beans.factory.annotation.Value("${TELEGRAM_CHAT_ID}")
    private String chatIdAutorizado;

    // ID FIXO DA EMPRESA PADRÃO (Até criarmos o login via Telegram)
    @org.springframework.beans.factory.annotation.Value("${TELEGRAM_EMPRESA_ID}")
    private Long empresaAutorizadaId;

    @Autowired private ProdutoRepository produtoRepository;
    @Autowired private VendaRepository vendaRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private EventoRepository eventoRepository;
    
    @Autowired private GeminiService geminiService;
    @Autowired private EstatisticaService estatisticaService;

    @Autowired
    public TelegramService(@org.springframework.beans.factory.annotation.Value("${BOT_TOKEN}") String botToken) { 
        super(botToken); 
        this.botToken = botToken;
    } 
    @Override 
    public String getBotUsername() { return BOT_USERNAME; }
    @Override 
    public String getBotToken() { return this.botToken; }

    @Override
    public void onUpdateReceived(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            // Somente conversa privada explicitamente vinculada pelo operador do servidor.
            if (!update.getMessage().getChat().isUserChat()
                    || !chatIdAutorizado.equals(update.getMessage().getChatId().toString())) return;
            String mensagemRecebida = update.getMessage().getText().trim().toLowerCase();
            String chatIdUsuario = update.getMessage().getChatId().toString();

            if (mensagemRecebida.equals("/estoque")) { responderEstoque(chatIdUsuario); } 
            else if (mensagemRecebida.equals("/vendas")) { responderVendas(chatIdUsuario); } 
            else if (mensagemRecebida.equals("/equipe") || mensagemRecebida.equals("/usuarios") || mensagemRecebida.equals("/colaboradores") || mensagemRecebida.equals("/funcionarios")) { responderEquipe(chatIdUsuario); } 
            else if (mensagemRecebida.equals("/resumo")) { responderResumo(chatIdUsuario); } 
            else if (mensagemRecebida.equals("/insights") || mensagemRecebida.equals("/tendencias")) { responderInsights(chatIdUsuario); }
            else if (mensagemRecebida.equals("/alertas") || mensagemRecebida.equals("/ruptura")) { responderAlertas(chatIdUsuario); }
            else if (mensagemRecebida.equals("/agenda") || mensagemRecebida.equals("/compromissos")) { responderAgenda(chatIdUsuario); }
            else if (mensagemRecebida.equals("/promocoes") || mensagemRecebida.equals("/ofertas")) { responderPromocoes(chatIdUsuario); }
            else if (mensagemRecebida.equals("/ajuda") || mensagemRecebida.equals("/start")) { enviarMenuAjuda(chatIdUsuario); } 
            else { responderComIA(chatIdUsuario, update.getMessage().getText()); }
        }
    }

    private void responderResumo(String chatId) {
        String resposta = "📈 *Resumo Gerencial Nexo:*\n\n" +
                          "📦 Produtos: " + produtoRepository.findByEmpresaIdAndAtivoTrue(empresaAutorizadaId).size() + "\n" +
                          "🛒 Vendas: " + vendaRepository.findByEmpresaId(empresaAutorizadaId).size() + "\n" +
                          "👥 Equipe: " + usuarioRepository.findByEmpresaId(empresaAutorizadaId).size() + "\n" +
                          "📅 Eventos: " + eventoRepository.findByEmpresaId(empresaAutorizadaId).size() + "\n\n" +
                          "_(Use o menu /ajuda)_";
        enviarMensagem(chatId, resposta);
    }

    private void responderVendas(String chatId) {
        List<Venda> vendas = vendaRepository.findByEmpresaId(empresaAutorizadaId);
        if (vendas.isEmpty()) { enviarMensagem(chatId, "📊 Nenhuma venda registrada."); return; }

        BigDecimal faturamentoTotal = BigDecimal.ZERO;
        for (Venda v : vendas) { if (v.getTotal() != null) faturamentoTotal = faturamentoTotal.add(v.getTotal()); }

        String resposta = "📊 *Relatório Financeiro:*\n\n🛒 Pedidos: " + vendas.size() + "\n💰 Faturamento: R$ " + String.format("%.2f", faturamentoTotal.doubleValue());
        enviarMensagem(chatId, resposta);
    }

    private void responderEstoque(String chatId) {
        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaAutorizadaId);
        if (produtos.isEmpty()) { enviarMensagem(chatId, "📦 Seu estoque está vazio."); return; }

        BigDecimal capital = BigDecimal.ZERO;
        StringBuilder resposta = new StringBuilder("📦 *Inventário:*\n\n");
        for (Produto p : produtos) {
            capital = capital.add(BigDecimal.valueOf(p.getPreco()).multiply(BigDecimal.valueOf(p.getEstoque())));
            resposta.append("▪️ *").append(p.getNome()).append("*\n    Estoque: ").append(p.getEstoque()).append(" un. | R$ ").append(String.format("%.2f", p.getPreco())).append("\n\n");
        }
        resposta.append("💎 *Capital:* R$ ").append(String.format("%.2f", capital.doubleValue()));
        enviarMensagem(chatId, resposta.toString());
    }

    private void responderAlertas(String chatId) {
        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaAutorizadaId);
        List<Produto> estoqueBaixo = produtos.stream().filter(p -> p.getEstoque() <= 5).collect(Collectors.toList());
        if (estoqueBaixo.isEmpty()) { enviarMensagem(chatId, "✅ *Estoque Saudável!*"); return; }
        
        StringBuilder resposta = new StringBuilder("⚠️ *Alertas de Ruptura:*\n\n");
        for (Produto p : estoqueBaixo) { resposta.append(p.getEstoque() == 0 ? "🚨" : "⚠️").append(" *").append(p.getNome()).append("*\n    Restam: ").append(p.getEstoque()).append(" un.\n\n"); }
        enviarMensagem(chatId, resposta.toString());
    }

    private void responderInsights(String chatId) {
        enviarMensagem(chatId, "⏳ Gerando inteligência de mercado...");
        Map<String, Object> curvaEFluxo = estatisticaService.calcularCurvaABCFluxo(empresaAutorizadaId);
        @SuppressWarnings("unchecked") List<Map<String, Object>> curvaABC = (List<Map<String, Object>>) curvaEFluxo.get("curva");
        
        StringBuilder resposta = new StringBuilder("🧠 *Inteligência de Mercado*\n\n");
        resposta.append("🚀 *Tendência:* ").append(curvaEFluxo.get("produtoAltaTendencia")).append("\n");
        resposta.append("📉 *Parado:* ").append(curvaEFluxo.get("produtoParado")).append("\n\n📊 *Curva ABC:*\n");
        for (Map<String, Object> c : curvaABC) { resposta.append("▪️ *").append(c.get("name")).append("*: ").append(c.get("value")).append("% do lucro.\n"); }
        enviarMensagem(chatId, resposta.toString());
    }

    private void responderAgenda(String chatId) {
        List<Evento> eventosFuturos = eventoRepository.findByEmpresaIdAndDataGreaterThanEqualOrderByDataAscHoraAsc(empresaAutorizadaId, LocalDate.now().toString());
        if (eventosFuturos.isEmpty()) { enviarMensagem(chatId, "📅 *Sua Agenda está livre!*"); return; }

        StringBuilder resposta = new StringBuilder("📅 *Próximos Compromissos:*\n\n");
        for (Evento e : eventosFuturos) { resposta.append("📌 *").append(e.getTitulo()).append("*\n    Data: ").append(e.getData()).append(" às ").append(e.getHora()).append("\n\n"); }
        enviarMensagem(chatId, resposta.toString());
    }

    private void responderPromocoes(String chatId) {
        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaAutorizadaId);
        List<Produto> emOferta = produtos.stream().filter(p -> p.getPrecoPromocional() != null).collect(Collectors.toList());
        if (emOferta.isEmpty()) { enviarMensagem(chatId, "🏷️ *Nenhuma promoção ativa.*"); return; }

        StringBuilder resposta = new StringBuilder("🏷️ *Ofertas Ativas:*\n\n");
        for (Produto p : emOferta) { resposta.append("▪️ *").append(p.getNome()).append("*\n    Por: *R$ ").append(String.format("%.2f", p.getPrecoPromocional())).append("*\n\n"); }
        enviarMensagem(chatId, resposta.toString());
    }

    private void responderEquipe(String chatId) {
        List<Usuario> usuarios = usuarioRepository.findByEmpresaId(empresaAutorizadaId);
        StringBuilder resposta = new StringBuilder("👥 *Colaboradores:*\n\n");
        for (Usuario u : usuarios) { resposta.append("👤 *").append(u.getNomeCompleto()).append("*\n   Acesso: ").append(u.getPerfil()).append("\n\n"); }
        enviarMensagem(chatId, resposta.toString());
    }

    private void enviarMenuAjuda(String chatId) {
        enviarMensagem(chatId, "🤖 *Terminal Nexo*\nComandos:\n/resumo\n/vendas\n/insights\n/estoque\n/alertas\n/promocoes\n/agenda\n/colaboradores");
    }

    public void enviarMensagem(String chatId, String texto) {
        SendMessage message = new SendMessage(); message.setChatId(chatId); message.setText(texto); message.setParseMode("Markdown");
        try { execute(message); } catch (TelegramApiException e) { System.err.println("❌ Erro Telegram: " + e.getMessage()); }
    }

    public void enviarAlerta(String mensagem) { enviarMensagem(chatIdAutorizado, mensagem); }

    private void responderComIA(String chatId, String perguntaUsuario) {
        enviarMensagem(chatId, "⏳ Analisando...");
        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaAutorizadaId);
        List<Venda> vendas = vendaRepository.findByEmpresaId(empresaAutorizadaId);
        BigDecimal faturamento = BigDecimal.ZERO;
        for (Venda v : vendas) { if (v.getTotal() != null) faturamento = faturamento.add(v.getTotal()); }

        Map<String, Object> curvaEFluxo = estatisticaService.calcularCurvaABCFluxo(empresaAutorizadaId);
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
