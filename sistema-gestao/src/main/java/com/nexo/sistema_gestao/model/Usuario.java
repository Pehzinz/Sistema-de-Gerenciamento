package com.nexo.sistema_gestao.model;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonIgnore;


@Entity 
@Table(name="usuarios")
public class Usuario implements java.io.Serializable {
    //Atributos do Objeto Usuario
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nome_completo", nullable = false, length = 150)
    private String nomeCompleto;

    @Column(nullable = false, length = 14)
    private String cpf;

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    @Column(nullable = false)
    private String senha;

    @Column(nullable = false, length = 20)
    private String perfil;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean ativo = true;

    public boolean isAtivo() { return ativo; }
    public void setAtivo(boolean ativo) { this.ativo = ativo; }

    @Column(length = 20)
    private String telefone;

    @Column(columnDefinition = "TEXT")
    private String endereco;

    @Column(name = "data_nascimento")
    private LocalDate dataNascimento;

    @Column(name = "data_cadastro", insertable = false, updatable = false)
    private LocalDateTime dataCadastro;


    @ManyToOne
    @JoinColumn(name = "empresa_id")
    private Empresa empresa;

    @JsonIgnore
    @Column(length = 254)
    private String emailVerificado;

    @JsonIgnore
    @Column(length = 254)
    private String emailPendente;

    @JsonIgnore
    @Column(length = 64, unique = true)
    private String hashConfirmacaoEmail;

    @JsonIgnore
    private Instant confirmacaoEmailExpiraEm;

    @JsonIgnore
    @Column(length = 64, unique = true)
    private String hashRecuperacao;

    @JsonIgnore
    private Instant recuperacaoExpiraEm;

    @JsonIgnore
    private Integer falhasLogin;

    @JsonIgnore
    private Instant loginBloqueadoAte;

    @JsonIgnore
    @Column(length = 36)
    private String versaoCredencial;


    //Cosntrutor para o JPA trabalhar no banco de dados;
    public Usuario(){}

    
    //Metodos Getters e Setters;
    public Long getId() {return id;}
    public void setId(Long id) {this.id = id;}
    public String getNomeCompleto() {return nomeCompleto;}
    public void setNomeCompleto(String nomeCompleto) {this.nomeCompleto = nomeCompleto;}
    public String getCpf() {return cpf;}
    public void setCpf(String cpf) {this.cpf = cpf;}
    public String getSenha() {return senha;}
    public void setSenha(String senha) {this.senha = senha;}
    public String getPerfil() {return perfil;}
    public void setPerfil(String perfil) {this.perfil = perfil;}
    public String getTelefone() {return telefone;}
    public void setTelefone(String telefone) {this.telefone = telefone;}
    public String getEndereco() {return endereco;}
    public void setEndereco(String endereco) {this.endereco = endereco;}
    public LocalDate getDataNascimento() {return dataNascimento;}
    public void setDataNascimento(LocalDate dataNascimento) {this.dataNascimento = dataNascimento;}
    public LocalDateTime getDataCadastro() {return dataCadastro;}
    public void setDataCadastro(LocalDateTime dataCadastro) {this.dataCadastro = dataCadastro;} 
    public Empresa getEmpresa() { return empresa; }
    public void setEmpresa(Empresa empresa) { this.empresa = empresa; }
    public String getEmailVerificado() { return emailVerificado; }
    public String getEmailPendente() { return emailPendente; }
    public Instant getConfirmacaoEmailExpiraEm() { return confirmacaoEmailExpiraEm; }
    public Instant getRecuperacaoExpiraEm() { return recuperacaoExpiraEm; }
    public int getFalhasLogin() { return falhasLogin == null ? 0 : falhasLogin; }
    public Instant getLoginBloqueadoAte() { return loginBloqueadoAte; }
    public String getVersaoCredencial() { return versaoCredencial; }

    public void registrarFalhaLogin(Instant agora) {
        if (loginBloqueadoAte != null && !loginBloqueadoAte.isAfter(agora)) {
            limparFalhasLogin();
        }
        falhasLogin = getFalhasLogin() + 1;
        if (falhasLogin >= 5) {
            loginBloqueadoAte = agora.plusSeconds(900);
        }
    }

    public void limparFalhasLogin() {
        falhasLogin = null;
        loginBloqueadoAte = null;
    }

    public void iniciarConfirmacaoEmail(String email, String hash, Instant expiraEm) {
        emailPendente = email;
        hashConfirmacaoEmail = hash;
        confirmacaoEmailExpiraEm = expiraEm;
    }

    public void confirmarEmail() {
        emailVerificado = emailPendente;
        iniciarConfirmacaoEmail(null, null, null);
        iniciarRecuperacao(null, null);
    }

    public void iniciarRecuperacao(String hash, Instant expiraEm) {
        hashRecuperacao = hash;
        recuperacaoExpiraEm = expiraEm;
    }

    public void alterarSenha(String senhaCodificada) {
        senha = senhaCodificada;
        versaoCredencial = java.util.UUID.randomUUID().toString();
        limparFalhasLogin();
        iniciarRecuperacao(null, null);
        iniciarConfirmacaoEmail(null, null, null);
    }
}
