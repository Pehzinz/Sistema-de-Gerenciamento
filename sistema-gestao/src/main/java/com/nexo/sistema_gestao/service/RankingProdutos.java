package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Venda;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** Ranking de unidades registradas, independente de preço, receita ou estoque atual. */
public final class RankingProdutos {
    private RankingProdutos() {}

    private static final class ProdutoVendido {
        String chave, id, nome, marca;
        long quantidade;
    }

    public static Map<String, Object> calcular(List<Venda> vendas) {
        Map<String, ProdutoVendido> agrupados = new HashMap<>();
        long total = 0, semIdentificacao = 0, itensSemQuantidade = 0, vendasSemItens = 0;
        for (var venda : vendas) {
            if (venda.getItens() == null || venda.getItens().isEmpty()) { vendasSemItens++; continue; }
            for (var item : venda.getItens()) {
                if (item.getQuantidade() == null || item.getQuantidade() <= 0) { itensSemQuantidade++; continue; }
                total += item.getQuantidade().longValue();
                var produto = item.getProduto();
                if (produto == null || (produto.getIdInterno() == null && produto.getId() == null)) {
                    semIdentificacao += item.getQuantidade().longValue();
                    continue;
                }
                String chave = produto.getIdInterno() == null ? produto.getId() : produto.getIdInterno();
                ProdutoVendido resultado = agrupados.computeIfAbsent(chave, id -> {
                    var novo = new ProdutoVendido();
                    novo.chave = id; novo.id = produto.getId();
                    novo.nome = produto.getNome() == null || produto.getNome().isBlank() ? "Produto sem nome" : produto.getNome();
                    novo.marca = produto.getMarca();
                    return novo;
                });
                resultado.quantidade += item.getQuantidade().longValue();
            }
        }
        var ordenados = agrupados.values().stream().sorted(
                Comparator.comparingLong((ProdutoVendido p) -> p.quantidade).reversed()
                        .thenComparing(p -> p.nome, String.CASE_INSENSITIVE_ORDER).thenComparing(p -> p.chave)).toList();
        List<Map<String, Object>> produtos = new ArrayList<>();
        for (var produto : ordenados) {
            Map<String, Object> dados = new LinkedHashMap<>();
            dados.put("produtoId", produto.id); dados.put("nome", produto.nome); dados.put("marca", produto.marca);
            dados.put("quantidade", produto.quantidade);
            dados.put("participacaoPercentual", BigDecimal.valueOf(produto.quantidade).multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP));
            produtos.add(dados);
        }
        return Map.of("produtos", produtos, "totalUnidades", total, "unidadesSemIdentificacao", semIdentificacao,
                "itensSemQuantidade", itensSemQuantidade, "vendasSemItens", vendasSemItens, "vendasAnalisadas", vendas.size());
    }

    public static String resumir(Map<String, Object> dados) {
        @SuppressWarnings("unchecked") var produtos = (List<Map<String, Object>>) dados.get("produtos");
        StringBuilder texto = new StringBuilder("📦 *Mais vendidos em quantidade — todo o histórico:*\n");
        texto.append("Total de unidades registradas: ").append(dados.get("totalUnidades")).append(".\n");
        if (produtos.isEmpty()) texto.append("Ainda não há produtos identificados com quantidades válidas para classificar.\n");
        for (int i = 0; i < Math.min(5, produtos.size()); i++) {
            var produto = produtos.get(i);
            texto.append(i + 1).append(". ").append(produto.get("nome")).append(" — ").append(produto.get("quantidade"))
                    .append(" unidades (").append(produto.get("participacaoPercentual")).append("% das unidades).\n");
        }
        if (((Number) dados.get("unidadesSemIdentificacao")).longValue() > 0)
            texto.append("Unidades sem identificação de produto: ").append(dados.get("unidadesSemIdentificacao")).append(".\n");
        if (((Number) dados.get("itensSemQuantidade")).longValue() > 0 || ((Number) dados.get("vendasSemItens")).longValue() > 0)
            texto.append("Há registros sem quantidades válidas ou sem itens; o ranking pode estar incompleto.\n");
        return texto.append("Use o volume vendido para acompanhar reposição; não é uma previsão de demanda nem uma recomendação de estoque mínimo.\n").toString();
    }
}
