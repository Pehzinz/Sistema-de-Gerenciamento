package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Venda;
import java.math.BigDecimal;
import java.util.*;

/** Calcula somente custos registrados nos itens vendidos, sem estimar dados ausentes. */
final class AnaliseMargens {
    private AnaliseMargens() {}

    private static final class Resultado {
        String produtoId;
        String nome;
        long unidadesComCusto, unidadesSemCusto;
        BigDecimal receitaComCusto = BigDecimal.ZERO;
        BigDecimal receitaSemCusto = BigDecimal.ZERO;
        BigDecimal custo = BigDecimal.ZERO;

        BigDecimal margem() { return receitaComCusto.subtract(custo); }

        Map<String, Object> dados() {
            Map<String, Object> dados = new LinkedHashMap<>();
            dados.put("receitaComCusto", receitaComCusto);
            dados.put("receitaSemCusto", receitaSemCusto);
            dados.put("custoProdutosVendidos", custo);
            dados.put("margemBruta", unidadesComCusto == 0 ? null : margem());
            dados.put("unidadesComCusto", unidadesComCusto);
            dados.put("unidadesSemCusto", unidadesSemCusto);
            return dados;
        }
    }

    static Map<String, Object> calcular(List<Venda> vendas) {
        Resultado total = new Resultado();
        Map<String, Resultado> porProduto = new LinkedHashMap<>();
        for (Venda venda : vendas) {
            for (var item : venda.getItens()) {
                var produto = item.getProduto();
                String chave = produto == null ? "desconhecido" : produto.getIdInterno();
                Resultado resultado = porProduto.computeIfAbsent(chave, id -> {
                    Resultado novo = new Resultado();
                    novo.produtoId = produto == null ? null : produto.getId();
                    novo.nome = produto == null ? "Produto não identificado" : produto.getNome();
                    return novo;
                });
                for (Resultado destino : List.of(total, resultado)) {
                    if (item.getCustoUnitario() == null) {
                        destino.receitaSemCusto = destino.receitaSemCusto.add(item.getSubtotal());
                        destino.unidadesSemCusto += item.getQuantidade();
                    } else {
                        destino.receitaComCusto = destino.receitaComCusto.add(item.getSubtotal());
                        destino.custo = destino.custo.add(item.getCustoUnitario().multiply(BigDecimal.valueOf(item.getQuantidade())));
                        destino.unidadesComCusto += item.getQuantidade();
                    }
                }
            }
        }
        var ordenados = porProduto.values().stream().sorted(
                Comparator.comparing((Resultado r) -> r.unidadesComCusto == 0 ? null : r.margem(),
                        Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(r -> r.produtoId == null ? "" : r.produtoId)).toList();
        List<Map<String, Object>> produtos = new ArrayList<>();
        for (Resultado resultado : ordenados) {
            var dados = resultado.dados();
            dados.put("produtoId", resultado.produtoId);
            dados.put("nome", resultado.nome);
            produtos.add(dados);
        }
        var dados = total.dados();
        dados.put("produtos", produtos);
        dados.put("produtosComMargemNegativa", ordenados.stream().filter(r -> r.unidadesComCusto > 0 && r.margem().signum() < 0).count());
        return dados;
    }
}
