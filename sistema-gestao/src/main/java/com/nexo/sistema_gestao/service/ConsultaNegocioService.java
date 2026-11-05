package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Evento;
import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.model.Venda;
import com.nexo.sistema_gestao.repository.EventoRepository;
import com.nexo.sistema_gestao.repository.ProdutoRepository;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.repository.VendaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;


import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ConsultaNegocioService {
    @Autowired private ProdutoRepository produtoRepository;
    @Autowired private VendaRepository vendaRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private EventoRepository eventoRepository;
    
    @Autowired private EstatisticaService estatisticaService;

    public String consultar(String comando, Long empresaId) {
        return switch (comando.trim().toLowerCase(java.util.Locale.ROOT)) {
            case "/ajuda" -> "Consultas disponíveis: /resumo, /estoque, /promocoes, /alertas, /vendas, /insights, /agenda e /equipe.";
            case "/estoque" -> responderEstoque(empresaId);
            case "/vendas" -> responderVendas(empresaId);
            case "/equipe", "/usuarios", "/colaboradores", "/funcionarios" -> responderEquipe(empresaId);
            case "/resumo" -> responderResumo(empresaId);
            case "/insights", "/tendencias" -> responderInsights(empresaId);
            case "/alerta", "/alertas", "/ruptura" -> responderAlertas(empresaId);
            case "/agenda", "/compromissos" -> responderAgenda(empresaId);
            case "/promocoes", "/ofertas" -> responderPromocoes(empresaId);
            default -> null;
        };
    }

    private String responderResumo(Long empresaId) {
        String resposta = "📈 *Resumo Gerencial Nexo:*\n\n" +
                          "📦 Produtos: " + produtoRepository.findByEmpresaIdAndAtivoTrue(empresaId).size() + "\n" +
                          "🛒 Vendas: " + vendaRepository.findByEmpresaId(empresaId).size() + "\n" +
                          "👥 Equipe: " + usuarioRepository.findByEmpresaId(empresaId).size() + "\n" +
                          "📅 Eventos: " + eventoRepository.findByEmpresaId(empresaId).size() + "\n\n" +
                          "";
        return resposta;
    }

    private String responderVendas(Long empresaId) {
        List<Venda> vendas = vendaRepository.findByEmpresaId(empresaId);
        if (vendas.isEmpty()) { return "📊 Nenhuma venda registrada."; }

        BigDecimal faturamentoTotal = BigDecimal.ZERO;
        for (Venda v : vendas) { if (v.getTotal() != null) faturamentoTotal = faturamentoTotal.add(v.getTotal()); }

        String resposta = "📊 *Relatório Financeiro:*\n\n🛒 Pedidos: " + vendas.size() + "\n💰 Faturamento: R$ " + String.format("%.2f", faturamentoTotal.doubleValue());
        return resposta;
    }

    private String responderEstoque(Long empresaId) {
        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaId);
        if (produtos.isEmpty()) { return "📦 Seu estoque está vazio."; }

        BigDecimal capital = BigDecimal.ZERO;
        StringBuilder resposta = new StringBuilder("📦 *Inventário:*\n\n");
        for (Produto p : produtos) {
            capital = capital.add(BigDecimal.valueOf(p.getPreco()).multiply(BigDecimal.valueOf(p.getEstoque())));
            resposta.append("▪️ *").append(p.getNome()).append("*\n    Estoque: ").append(p.getEstoque()).append(" un. | R$ ").append(String.format("%.2f", p.getPreco())).append("\n\n");
        }
        resposta.append("💎 *Capital:* R$ ").append(String.format("%.2f", capital.doubleValue()));
        return resposta.toString();
    }

    private String responderAlertas(Long empresaId) {
        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaId);
        List<Produto> estoqueBaixo = produtos.stream().filter(p -> p.getEstoque() <= 5).collect(Collectors.toList());
        if (estoqueBaixo.isEmpty()) { return "✅ *Estoque Saudável!*"; }
        
        StringBuilder resposta = new StringBuilder("⚠️ *Alertas de Ruptura:*\n\n");
        for (Produto p : estoqueBaixo) { resposta.append(p.getEstoque() == 0 ? "🚨" : "⚠️").append(" *").append(p.getNome()).append("*\n    Restam: ").append(p.getEstoque()).append(" un.\n\n"); }
        return resposta.toString();
    }

    private String responderInsights(Long empresaId) {
        Map<String, Object> curvaEFluxo = estatisticaService.calcularCurvaABCFluxo(empresaId);
        @SuppressWarnings("unchecked") List<Map<String, Object>> curvaABC = (List<Map<String, Object>>) curvaEFluxo.get("curva");
        
        StringBuilder resposta = new StringBuilder("🧠 *Inteligência de Mercado*\n\n");
        resposta.append("🚀 *Tendência:* ").append(curvaEFluxo.get("produtoAltaTendencia")).append("\n");
        resposta.append("📉 *Parado:* ").append(curvaEFluxo.get("produtoParado")).append("\n\n📊 *Curva ABC:*\n");
        for (Map<String, Object> c : curvaABC) { resposta.append("▪️ *").append(c.get("name")).append("*: ").append(c.get("value")).append("% do lucro.\n"); }
        return resposta.toString();
    }

    private String responderAgenda(Long empresaId) {
        List<Evento> eventosFuturos = eventoRepository.findByEmpresaIdAndDataGreaterThanEqualOrderByDataAscHoraAsc(empresaId, LocalDate.now().toString());
        if (eventosFuturos.isEmpty()) { return "📅 *Sua Agenda está livre!*"; }

        StringBuilder resposta = new StringBuilder("📅 *Próximos Compromissos:*\n\n");
        for (Evento e : eventosFuturos) { resposta.append("📌 *").append(e.getTitulo()).append("*\n    Data: ").append(e.getData()).append(" às ").append(e.getHora()).append("\n\n"); }
        return resposta.toString();
    }

    private String responderPromocoes(Long empresaId) {
        List<Produto> produtos = produtoRepository.findByEmpresaIdAndAtivoTrue(empresaId);
        List<Produto> emOferta = produtos.stream().filter(p -> p.getPrecoPromocional() != null).collect(Collectors.toList());
        if (emOferta.isEmpty()) { return "🏷️ *Nenhuma promoção ativa.*"; }

        StringBuilder resposta = new StringBuilder("🏷️ *Ofertas Ativas:*\n\n");
        for (Produto p : emOferta) { resposta.append("▪️ *").append(p.getNome()).append("*\n    Por: *R$ ").append(String.format("%.2f", p.getPrecoPromocional())).append("*\n\n"); }
        return resposta.toString();
    }

    private String responderEquipe(Long empresaId) {
        List<Usuario> usuarios = usuarioRepository.findByEmpresaId(empresaId);
        StringBuilder resposta = new StringBuilder("👥 *Colaboradores:*\n\n");
        for (Usuario u : usuarios) { resposta.append("👤 *").append(u.getNomeCompleto()).append("*\n   Acesso: ").append(u.getPerfil()).append("\n\n"); }
        return resposta.toString();
    }

}
