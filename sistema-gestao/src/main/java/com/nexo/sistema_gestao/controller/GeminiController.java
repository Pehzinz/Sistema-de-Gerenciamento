package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.model.Evento;
import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.model.Venda;
import com.nexo.sistema_gestao.repository.EventoRepository;
import com.nexo.sistema_gestao.repository.ProdutoRepository;
import com.nexo.sistema_gestao.repository.VendaRepository;
import com.nexo.sistema_gestao.service.EstatisticaService;
import com.nexo.sistema_gestao.service.GeminiService;
import com.nexo.sistema_gestao.service.RankingProdutos;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/agente")
public class GeminiController {

    @Autowired private GeminiService geminiService;
    @Autowired private ProdutoRepository produtoRepository;
    @Autowired private VendaRepository vendaRepository;
    @Autowired private EventoRepository eventoRepository;
    @Autowired private EstatisticaService estatisticaService;
    @Autowired private com.nexo.sistema_gestao.service.ConsultaNegocioService consultas;

    @GetMapping("/consultas/{comando}")
    public ResponseEntity<?> consultar(@PathVariable String comando) {
        Usuario usuario = (Usuario) org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        String resposta = consultas.consultar("/" + comando, usuario.getEmpresa().getId());
        return resposta == null ? ResponseEntity.badRequest().body(Map.of("erro", "Consulta desconhecida."))
                : ResponseEntity.ok(Map.of("resposta", resposta));
    }

    private static final List<String> PALAVRAS_CHAVE_NEGOCIOS = Arrays.asList(
        "venda", "estoque", "produto", "lucro", "faturamento", "cliente", "nexo", "gestão", 
        "promo", "preço", "caixa", "relatório", "ajuda", "olá", "oi", "bom dia", "boa tarde", 
        "tendência", "sistema", "desconto", "comprar", "vender", "vendid", "quantidade", "reposição", "reposicao", "giro", "agendar", "marcar", "lembrar", "reunião", "evento", "abc", "curva"
    );

    @PostMapping("/perguntar")
    public ResponseEntity<?> perguntarAoAgente(@RequestBody Map<String, String> payload) {
        String perguntaUsuario = payload.get("pergunta");

        if (perguntaUsuario == null || perguntaUsuario.trim().isEmpty() || perguntaUsuario.length() > 4000) {
            return ResponseEntity.badRequest().body(Map.of("erro", "A pergunta não pode estar vazia."));
        }

        Usuario usuarioLogado = (Usuario) org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        Long empresaId = usuarioLogado.getEmpresa().getId();

        // Comandos digitados usam as mesmas consultas dos atalhos, sem chamar a IA.
        String perguntaLower = perguntaUsuario.trim().toLowerCase(java.util.Locale.ROOT);
        if (perguntaLower.startsWith("/")) {
            String resposta = consultas.consultar(perguntaLower, empresaId);
            return resposta == null
                    ? ResponseEntity.badRequest().body(Map.of("erro", "Comando desconhecido. Use /ajuda para ver as consultas disponíveis."))
                    : ResponseEntity.ok(Map.of("resposta", resposta));
        }
        boolean temContexto = PALAVRAS_CHAVE_NEGOCIOS.stream().anyMatch(perguntaLower::contains);
        
        if (!temContexto) {
            return ResponseEntity.ok(Map.of("resposta", "Sou o Consultor Estratégico. Por favor, pergunte algo relacionado aos nossos negócios!"));
        }

        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaId);
        List<Venda> vendas = vendaRepository.findByEmpresaId(empresaId);
        BigDecimal faturamento = BigDecimal.ZERO;
        for (Venda v : vendas) { if (v.getTotal() != null) faturamento = faturamento.add(v.getTotal()); }

        Map<String, Object> curvaEFluxo = estatisticaService.calcularCurvaABCFluxo(empresaId);
        @SuppressWarnings("unchecked") List<Map<String, Object>> curvaABC = (List<Map<String, Object>>) curvaEFluxo.get("curva");

        Map<String, Object> trafegoData = estatisticaService.calcularTrafego(empresaId);
        @SuppressWarnings("unchecked") List<Map<String, Object>> trafego = (List<Map<String, Object>>) trafegoData.get("grafico");
        
        StringBuilder contexto = new StringBuilder("Você é o Consultor Estratégico. Para agendamentos, oriente o usuário a preencher e salvar o formulário do Calendário. Não afirme que executou ações.\n\n");
        contexto.append("📊 DADOS:\n- Faturamento: R$ ").append(String.format("%.2f", faturamento.doubleValue())).append("\n- Pedidos: ").append(vendas.size()).append("\n\n");
        contexto.append("🧠 INTELIGÊNCIA:\n- Produto com maior receita: ").append(curvaEFluxo.get("produtoAltaTendencia")).append("\n- Curva ABC por faturamento:\n");
        
        for (Map<String, Object> c : curvaABC) { contexto.append("  * ").append(c.get("name")).append(" (").append(c.get("value")).append("% do faturamento): ").append(c.get("produtos")).append("\n"); }
        @SuppressWarnings("unchecked") var ranking = (Map<String, Object>) curvaEFluxo.get("rankingQuantidade");
        contexto.append("\n").append(RankingProdutos.resumir(ranking));
        contexto.append("Não confunda quantidade, faturamento e lucro. O ranking é histórico; não invente previsão de demanda, prazo de reposição ou estoque mínimo.\n");

        contexto.append("\n📦 ESTOQUE:\n");
        for(Produto p : produtos) { contexto.append("- ").append(p.getNome()).append(" | Disponível agora: ").append(p.getQuantidadeDisponivel())
                .append(" | Controle: ").append(p.getTipoEstoque()).append(" | Estoque físico: ").append(p.getEstoque()).append("\n"); }

        contexto.append("\nPergunta do usuário: \"").append(perguntaUsuario).append("\"\n");

        String resposta = geminiService.perguntarParaIA(contexto.toString());

        return ResponseEntity.ok(Map.of("resposta", resposta));
    }
}
