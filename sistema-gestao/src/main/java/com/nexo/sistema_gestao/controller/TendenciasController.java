package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.service.EstatisticaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tendencias")
public class TendenciasController {

    @Autowired
    private EstatisticaService estatisticaService;

    private Long getEmpresaId() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return ((Usuario) auth.getPrincipal()).getEmpresa().getId();
    }

    @GetMapping("/previsao-vendas")
    public ResponseEntity<List<Map<String, Object>>> obterPrevisaoVendas() {
        return ResponseEntity.ok(estatisticaService.calcularRegressaoLinearVendas(getEmpresaId()));
    }

    @GetMapping("/cross-selling")
    public ResponseEntity<List<Map<String, String>>> obterCrossSelling() {
        return ResponseEntity.ok(estatisticaService.calcularCrossSelling(getEmpresaId()));
    }

    @GetMapping("/curva-fluxo")
    public ResponseEntity<Map<String, Object>> obterCurvaEFluxo() {
        return ResponseEntity.ok(estatisticaService.calcularCurvaABCFluxo(getEmpresaId()));
    }

    @GetMapping("/trafego")
    public ResponseEntity<Map<String, Object>> obterTrafego() {
        return ResponseEntity.ok(estatisticaService.calcularTrafego(getEmpresaId()));
    }
}
