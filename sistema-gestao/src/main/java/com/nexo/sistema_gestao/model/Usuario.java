package com.nexo.sistema_gestao.model;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;


@Entity 
@Table(name="usuarios")
public class Usuario{
    //Atributos do Objeto Usuario
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nome_completo", nullable = false, length = 150)
    private String nomeCompleto;

    @Column(nullable = false, length = 14)
    private String cpf;

    @Column(nullable = false)
    private String senha;

    @Column(nullable = false, length = 20)
    private String perfil;

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
}