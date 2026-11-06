package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class ControleEstoqueTests {
    final Instant agora = Instant.parse("2026-11-06T12:00:00Z");
    Produto padrao(int estoque) {
        var p = new Produto(); p.setNome("Produto"); p.setEstoque(estoque); return p;
    }
    Produto cota() {
        var p = padrao(0); p.setTipoEstoque(TipoEstoque.COTA_TEMPO);
        p.setLimiteCota(50); p.setIntervaloCotaMinutos(60);
        ControleEstoque.configurar(p, p, agora, true); return p;
    }
    @Test void legadoSemTipoUsaEstoquePadrao() {
        var p = padrao(3); p.setTipoEstoque(null);
        assertEquals(TipoEstoque.PADRAO, p.getTipoEstoque());
        ControleEstoque.consumir(p, 2, agora); assertEquals(1, p.getEstoque());
        assertThrows(IllegalStateException.class, () -> ControleEstoque.consumir(p, 2, agora));
        assertThrows(IllegalArgumentException.class, () -> ControleEstoque.consumir(p, 0, agora));
    }
    @Test void cotaRenovaNaFronteiraSemAcumularEPermaneceNoCatalogo() {
        var p = cota(); ControleEstoque.consumir(p, 50, agora);
        assertTrue(ControleEstoque.catalogavel(p, agora));
        assertEquals(0, ControleEstoque.disponivel(p, agora.plusSeconds(3599)));
        assertThrows(IllegalStateException.class, () -> ControleEstoque.consumir(p, 1, agora.plusSeconds(3599)));
        assertEquals(50, ControleEstoque.disponivel(p, agora.plusSeconds(3600)));
        ControleEstoque.consumir(p, 1, agora.plusSeconds(10801));
        assertEquals(49, ControleEstoque.disponivel(p, agora.plusSeconds(10801)));
        assertEquals(agora.plusSeconds(10800), p.getInicioJanelaCota());
        assertEquals(0, p.getEstoque());
    }
    @Test void validadeBloqueiaNoInstanteLimiteOuNoEsgotamento() {
        var p = padrao(2); p.setTipoEstoque(TipoEstoque.VALIDADE); p.setValidadeComercial(agora);
        assertTrue(ControleEstoque.catalogavel(p, agora.minusNanos(1)));
        assertFalse(ControleEstoque.catalogavel(p, agora));
        assertThrows(IllegalStateException.class, () -> ControleEstoque.consumir(p, 1, agora));
        p.setValidadeComercial(agora.plusSeconds(60)); ControleEstoque.consumir(p, 2, agora);
        assertFalse(ControleEstoque.catalogavel(p, agora));
    }
    @Test void conversoesLimpamRegrasEExigemEstoque() {
        var p = cota(); var dados = padrao(8);
        dados.setEstoque(null);
        assertThrows(IllegalArgumentException.class, () -> ControleEstoque.configurar(p, dados, agora, false));
        dados.setEstoque(8); ControleEstoque.configurar(p, dados, agora, false);
        assertEquals(8, p.getEstoque()); assertNull(p.getLimiteCota()); assertNull(p.getInicioJanelaCota());
        var novaCota = cota(); ControleEstoque.configurar(p, novaCota, agora, false);
        assertEquals(0, p.getEstoque()); assertEquals(50, ControleEstoque.disponivel(p, agora));
        var vencivel = padrao(4); vencivel.setTipoEstoque(TipoEstoque.VALIDADE);
        assertThrows(IllegalArgumentException.class, () -> ControleEstoque.configurar(p, vencivel, agora, false));
    }
    @Test void edicaoComumPreservaConsumoESaldoAtual() {
        var p = cota(); ControleEstoque.consumir(p, 20, agora);
        var dados = cota(); ControleEstoque.configurar(p, dados, agora.plusSeconds(60), false);
        assertEquals(30, ControleEstoque.disponivel(p, agora.plusSeconds(60)));
        dados.setLimiteCota(60); ControleEstoque.configurar(p, dados, agora.plusSeconds(60), false);
        assertEquals(60, ControleEstoque.disponivel(p, agora.plusSeconds(60)));
        var fisico = padrao(3); ControleEstoque.configurar(fisico, padrao(99), agora, false);
        assertEquals(3, fisico.getEstoque());
    }
    @Test void rejeitaConfiguracaoDeCotaInvalida() {
        var p = cota(); p.setIntervaloCotaMinutos(0);
        assertThrows(IllegalArgumentException.class, () -> ControleEstoque.configurar(p, p, agora, true));
        p.setIntervaloCotaMinutos(60); p.setLimiteCota(-1);
        assertThrows(IllegalArgumentException.class, () -> ControleEstoque.configurar(p, p, agora, true));
    }
}
