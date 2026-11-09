package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.repository.ProdutoRepository;
import com.nexo.sistema_gestao.repository.VendaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
public class AnaliseCatalogoService {
    private final ProdutoRepository produtos;
    private final VendaRepository vendas;

    public AnaliseCatalogoService(ProdutoRepository produtos, VendaRepository vendas) {
        this.produtos = produtos;
        this.vendas = vendas;
    }

    // Sem cache: editar o custo deve refletir imediatamente na análise do catálogo.
    @Transactional(readOnly = true)
    public Map<String, Object> calcular(Long empresaId) {
        Map<String, Long> unidades = new HashMap<>();
        for (var venda : vendas.findByEmpresaId(empresaId)) {
            for (var item : venda.getItens()) {
                if (item.getProduto() != null) unidades.merge(item.getProduto().getIdInterno(), item.getQuantidade().longValue(), Long::sum);
            }
        }
        return calcular(produtos.findByEmpresaIdAndAtivoTrue(empresaId), unidades,
                LocalDate.now(ZoneId.of("America/Sao_Paulo")));
    }

    static Map<String, Object> calcular(List<Produto> produtos, Map<String, Long> unidades, LocalDate hoje) {
        List<Map<String, Object>> pontos = new ArrayList<>();
        List<BigDecimal> percentuais = new ArrayList<>();
        long abaixoDoCusto = 0;
        for (Produto produto : produtos) {
            if (produto.getCustoUnitario() == null) continue;
            boolean promocao = produto.getPrecoPromocional() != null && produto.getDataInicioPromocao() != null
                    && produto.getDataFimPromocao() != null && !hoje.isBefore(produto.getDataInicioPromocao())
                    && !hoje.isAfter(produto.getDataFimPromocao());
            BigDecimal preco = BigDecimal.valueOf(promocao ? produto.getPrecoPromocional() : produto.getPreco())
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal margem = preco.subtract(produto.getCustoUnitario());
            BigDecimal percentual = margem.multiply(BigDecimal.valueOf(100)).divide(preco, 6, RoundingMode.HALF_UP);
            percentuais.add(percentual);
            if (margem.signum() < 0) abaixoDoCusto++;
            Map<String, Object> ponto = new LinkedHashMap<>();
            ponto.put("produtoId", produto.getId()); ponto.put("nome", produto.getNome());
            ponto.put("precoVenda", preco); ponto.put("custoUnitario", produto.getCustoUnitario());
            ponto.put("margemUnitaria", margem); ponto.put("margemPercentual", percentual.setScale(2, RoundingMode.HALF_UP));
            ponto.put("unidadesVendidas", unidades.getOrDefault(produto.getIdInterno(), 0L));
            ponto.put("promocaoAtiva", promocao);
            pontos.add(ponto);
        }
        percentuais.sort(Comparator.naturalOrder());
        BigDecimal mediana = quantil(percentuais, new BigDecimal("0.5"));
        BigDecimal primeiroQuartil = percentuais.size() < 4 ? null : quantil(percentuais, new BigDecimal("0.25"));
        for (var ponto : pontos) {
            BigDecimal margem = (BigDecimal) ponto.get("margemUnitaria");
            BigDecimal percentual = margem.multiply(BigDecimal.valueOf(100))
                    .divide((BigDecimal) ponto.get("precoVenda"), 6, RoundingMode.HALF_UP);
            ponto.put("faixa", margem.signum() < 0 ? "ABAIXO_DO_CUSTO" : margem.signum() == 0 ? "SEM_MARGEM"
                    : primeiroQuartil != null && percentual.compareTo(primeiroQuartil) <= 0 ? "QUARTIL_INFERIOR" : "MARGEM_POSITIVA");
        }
        pontos.sort(Comparator.comparing((Map<String, Object> p) -> (BigDecimal) p.get("margemUnitaria"))
                .thenComparing(p -> (String) p.get("produtoId")));
        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("versao", 1); resposta.put("dataReferencia", hoje);
        resposta.put("produtosComCusto", pontos.size()); resposta.put("produtosSemCusto", produtos.size() - pontos.size());
        resposta.put("produtosAbaixoDoCusto", abaixoDoCusto); resposta.put("medianaMargemPercentual", arredondar(mediana));
        resposta.put("primeiroQuartilPercentual", arredondar(primeiroQuartil)); resposta.put("produtos", pontos);
        return resposta;
    }

    // Quantil com interpolação linear entre posições (n - 1) * p.
    private static BigDecimal quantil(List<BigDecimal> valores, BigDecimal p) {
        if (valores.isEmpty()) return null;
        BigDecimal posicao = p.multiply(BigDecimal.valueOf(valores.size() - 1));
        int inferior = posicao.intValue();
        int superior = Math.min(inferior + 1, valores.size() - 1);
        return valores.get(inferior).add(valores.get(superior).subtract(valores.get(inferior))
                .multiply(posicao.subtract(BigDecimal.valueOf(inferior))));
    }

    private static BigDecimal arredondar(BigDecimal valor) { return valor == null ? null : valor.setScale(2, RoundingMode.HALF_UP); }
}
