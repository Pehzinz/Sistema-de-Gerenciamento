package com.nexo.sistema_gestao.config;

import com.nexo.sistema_gestao.model.Categoria;
import com.nexo.sistema_gestao.model.Produto;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.CategoriaRepository;
import com.nexo.sistema_gestao.repository.ProdutoRepository;
import com.nexo.sistema_gestao.repository.UsuarioRepository;
import com.nexo.sistema_gestao.service.TelegramService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

//import java.math.BigDecimal;

@Configuration
public class TestaConexao implements CommandLineRunner {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private CategoriaRepository categoriaRepository;

    @Autowired
    private ProdutoRepository produtoRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;  //Serve para embaralhar a senha antes de salvar - Maior segurança
    
    @Autowired
    private TelegramService telegramService;  //Serve para testar se manda uma mensagem no Telegram assim que inicia a aplicação;

    @Override
    public void run(String... args) throws Exception {
        
        // 1. Cria Usuário de Teste
        if (usuarioRepository.count() == 0) {
            Usuario admin = new Usuario();
            admin.setNomeCompleto("Marina Silva");
            admin.setCpf("000.000.000-00");  //Alterar cpf:000.000.000-01 para fazer teste com novo usuario
            admin.setSenha(passwordEncoder.encode("senhaSegura123"));  //escondendo a senha - mantendo segura
            admin.setPerfil("ADMIN");
            usuarioRepository.save(admin);
        }

        // 2. Cria Categoria e Produto de Teste
        if (categoriaRepository.count() == 0) {
            Categoria categoriaAudio = new Categoria();
            categoriaAudio.setNome("Áudio");
            categoriaRepository.save(categoriaAudio);

            Produto fone = new Produto();
            fone.setId("7891020304");
            fone.setNome("Fone sem fio Air");
            fone.setMarca("Aurora");
            fone.setPreco(249.90);    //fone.setPreco(new BigDecimal("249,90"));
            fone.setEstoque(48);
            fone.setCategoria(categoriaAudio);
            produtoRepository.save(fone);

            System.out.println("=========================================");
            System.out.println("SUCESSO: Dados de teste criados no PostgreSQL!");
            System.out.println("=========================================");
        }
        telegramService.enviarAlerta("🤖 Olá! O Back-end do Nexo Gestão acabou de ser iniciado com sucesso!");
    }
}