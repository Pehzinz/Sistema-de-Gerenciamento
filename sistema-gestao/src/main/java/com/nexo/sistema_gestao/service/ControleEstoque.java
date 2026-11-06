package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.TipoEstoque;
import java.time.Instant;
import java.time.Duration;
import java.util.Objects;

/** Regras compartilhadas. Configuração e consumo exigem bloqueio da linha na transação chamadora. */
public final class ControleEstoque {
    private ControleEstoque() {}

    public static void configurar(Produto destino, Produto dados, Instant agora, boolean cadastro) {
        TipoEstoque tipo = dados.getTipoEstoque();
        if (tipo == TipoEstoque.COTA_TEMPO) {
            if (dados.getLimiteCota() == null || dados.getLimiteCota() <= 0
                    || dados.getIntervaloCotaMinutos() == null || dados.getIntervaloCotaMinutos() <= 0) {
                throw new IllegalArgumentException("Informe limite e intervalo da cota em minutos, inteiros positivos.");
            }
            boolean reiniciar = cadastro || destino.getTipoEstoque() != tipo
                    || !Objects.equals(destino.getLimiteCota(), dados.getLimiteCota())
                    || !Objects.equals(destino.getIntervaloCotaMinutos(), dados.getIntervaloCotaMinutos());
            if (reiniciar) {
                destino.setInicioJanelaCota(agora);
                destino.setVendasNaJanela(0);
            }
            destino.setLimiteCota(dados.getLimiteCota());
            destino.setIntervaloCotaMinutos(dados.getIntervaloCotaMinutos());
            destino.setEstoque(0);
            destino.setValidadeComercial(null);
        } else {
            boolean conversao = destino.getTipoEstoque() != tipo;
            // Edições comuns preservam o saldo; conversões exigem um saldo explícito.
            if (cadastro || conversao) {
                if (dados.getEstoque() == null || dados.getEstoque() < 0) {
                    throw new IllegalArgumentException("Informe o estoque físico inicial, maior ou igual a zero.");
                }
                destino.setEstoque(dados.getEstoque());
            }
            if (tipo == TipoEstoque.VALIDADE && dados.getValidadeComercial() == null) {
                throw new IllegalArgumentException("Informe a data e hora de validade comercial.");
            }
            destino.setValidadeComercial(tipo == TipoEstoque.VALIDADE ? dados.getValidadeComercial() : null);
            destino.setLimiteCota(null);
            destino.setIntervaloCotaMinutos(null);
            destino.setInicioJanelaCota(null);
            destino.setVendasNaJanela(null);
        }
        destino.setTipoEstoque(tipo);
    }

    public static boolean catalogavel(Produto produto, Instant agora) {
        return produto.isAtivo() && (produto.getTipoEstoque() != TipoEstoque.VALIDADE
                || (produto.getValidadeComercial() != null && agora.isBefore(produto.getValidadeComercial())
                    && produto.getEstoque() != null && produto.getEstoque() > 0));
    }

    public static int disponivel(Produto produto, Instant agora) {
        if (!catalogavel(produto, agora)) return 0;
        if (produto.getTipoEstoque() != TipoEstoque.COTA_TEMPO) {
            return produto.getEstoque() == null ? 0 : produto.getEstoque();
        }
        if (produto.getLimiteCota() == null || produto.getLimiteCota() <= 0
                || produto.getIntervaloCotaMinutos() == null || produto.getIntervaloCotaMinutos() <= 0) return 0;
        boolean renovada = produto.getInicioJanelaCota() == null
                || !agora.isBefore(produto.getInicioJanelaCota().plusSeconds(produto.getIntervaloCotaMinutos() * 60L));
        return renovada ? produto.getLimiteCota()
                : Math.max(0, produto.getLimiteCota() - Objects.requireNonNullElse(produto.getVendasNaJanela(), 0));
    }

    public static void consumir(Produto produto, int quantidade, Instant agora) {
        if (quantidade <= 0) throw new IllegalArgumentException("A quantidade deve ser positiva.");
        if (!catalogavel(produto, agora)) throw new IllegalStateException("Produto inativo ou com validade comercial encerrada: " + produto.getNome());
        if (disponivel(produto, agora) < quantidade) {
            throw new IllegalStateException("Estoque ou cota insuficiente para " + produto.getNome());
        }
        if (produto.getTipoEstoque() == TipoEstoque.COTA_TEMPO) {
            long segundos = produto.getIntervaloCotaMinutos() * 60L;
            Instant inicio = produto.getInicioJanelaCota();
            if (inicio == null || !agora.isBefore(inicio.plusSeconds(segundos))) {
                long janelas = inicio == null ? 0 : Duration.between(inicio, agora).getSeconds() / segundos;
                produto.setInicioJanelaCota(inicio == null ? agora : inicio.plusSeconds(janelas * segundos));
                produto.setVendasNaJanela(0);
            }
            produto.setVendasNaJanela(Objects.requireNonNullElse(produto.getVendasNaJanela(), 0) + quantidade);
        } else {
            produto.setEstoque(produto.getEstoque() - quantidade);
        }
    }
}
