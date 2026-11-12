package com.nexo.sistema_gestao.service;

import com.nexo.sistema_gestao.model.Empresa;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.time.*;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TelegramSessaoServiceTests {
    UsuarioRepository usuarios;
    TelegramSessaoService sessoes;
    Usuario admin;
    final String cnpj = "12345678000199", cpf = "12345678900";
    Instant agora;

    @BeforeEach void setup() {
        usuarios = mock(UsuarioRepository.class);
        agora = Instant.parse("2026-11-05T12:00:00Z");
        Clock clock = new Clock() {
            public ZoneId getZone() { return ZoneOffset.UTC; }
            public Clock withZone(ZoneId zone) { return this; }
            public Instant instant() { return agora; }
        };
        var encoder = new BCryptPasswordEncoder(4);
        var acessoConta = new AcessoContaService(usuarios, encoder, clock);
        sessoes = new TelegramSessaoService(usuarios, acessoConta, clock);
        Empresa empresa = new Empresa("Loja A", cnpj); empresa.setId(10L);
        admin = new Usuario(); admin.setId(1L); admin.setEmpresa(empresa); admin.setPerfil("ADMIN");
        admin.setNomeCompleto("Ana"); admin.setSenha(encoder.encode("senha-segura-123"));
        when(usuarios.bloquearPorDocumentos(cpf, cnpj)).thenReturn(List.of(admin));
        when(usuarios.findByIdAndEmpresaIdAndAtivoTrue(1L, 10L)).thenReturn(Optional.of(admin));
    }

    TelegramSessaoService.Acesso login(String chat, String senha) {
        sessoes.processar(chat, "/start"); sessoes.processar(chat, cnpj); sessoes.processar(chat, cpf);
        return sessoes.processar(chat, senha);
    }

    @Test void credentialsAreRequiredAndChatsAreIsolated() {
        assertNull(sessoes.processar("a", "/estoque").empresaId());
        assertTrue(login("a", "senha-segura-123").mensagem().contains("Loja A"));
        assertEquals(10L, sessoes.processar("a", "/estoque").empresaId());
        assertNull(sessoes.processar("b", "/estoque").empresaId());
    }

    @Test void switchingRequiresCredentialsOfTheNewCompanyEvenWithSameCpf() {
        login("a", "senha-segura-123");
        assertNull(sessoes.processar("a", "/trocar_empresa").empresaId());
        sessoes.processar("a", "99999999000199"); sessoes.processar("a", cpf);
        assertTrue(sessoes.processar("a", "senha-segura-123").mensagem().contains("inválidas"));
        assertNull(sessoes.processar("a", "/estoque").empresaId());
        Empresa outra = new Empresa("Loja B", "99999999000199"); outra.setId(20L);
        Usuario conta = new Usuario(); conta.setId(2L); conta.setEmpresa(outra); conta.setPerfil("COLABORADOR");
        conta.setSenha(admin.getSenha());
        when(usuarios.bloquearPorDocumentos(cpf, outra.getCnpj())).thenReturn(List.of(conta));
        when(usuarios.findByIdAndEmpresaIdAndAtivoTrue(2L, 20L)).thenReturn(Optional.of(conta));
        sessoes.processar("a", "/start"); sessoes.processar("a", outra.getCnpj()); sessoes.processar("a", cpf);
        sessoes.processar("a", "senha-segura-123");
        var acesso = sessoes.processar("a", "/estoque");
        assertEquals(20L, acesso.empresaId()); assertEquals("COLABORADOR", acesso.perfil());
    }

    @Test void idleAndAbsoluteExpirationRequireNewLogin() {
        login("a", "senha-segura-123"); agora = agora.plusSeconds(901);
        assertNull(sessoes.processar("a", "/estoque").empresaId());
        login("a", "senha-segura-123");
        for (int i = 0; i < 8; i++) { agora = agora.plusSeconds(850); assertEquals(10L, sessoes.processar("a", "/estoque").empresaId()); }
        agora = agora.plusSeconds(401);
        assertNull(sessoes.processar("a", "/estoque").empresaId());
    }

    @Test void logoutDeletionAndPasswordChangesRevokeAccess() {
        login("a", "senha-segura-123"); sessoes.processar("a", "/sair");
        assertNull(sessoes.processar("a", "/estoque").empresaId());
        login("a", "senha-segura-123"); admin.setSenha("outro-hash");
        assertNull(sessoes.processar("a", "/estoque").empresaId());
        when(usuarios.findByIdAndEmpresaIdAndAtivoTrue(1L, 10L)).thenReturn(Optional.empty());
        assertNull(sessoes.processar("a", "/estoque").empresaId());
    }

    @Test void restartingLoginDoesNotBypassAttemptLimit() {
        for (int i = 0; i < 4; i++) assertTrue(login("a", "errada").mensagem().contains("inválidas"));
        assertTrue(login("a", "errada").mensagem().contains("Muitas tentativas"));
        assertTrue(login("a", "senha-segura-123").mensagem().contains("Muitas tentativas"));
        assertNull(sessoes.processar("a", "/estoque").empresaId());
    }

    @Test void accountLimitAlsoAppliesAcrossDifferentChats() {
        for (int i = 0; i < 5; i++) login("chat-" + i, "errada");
        assertTrue(login("outro", "senha-segura-123").mensagem().contains("Muitas tentativas"));
    }
}
