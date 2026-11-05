package com.nexo.sistema_gestao.model;
import jakarta.persistence.*;


@Entity 
@Table(name="categorias")
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true; // Campo para o Soft Delete

    @ManyToOne
    @JoinColumn(name = "empresa_id")
    private Empresa empresa;
    


    //Construtor para o JPA conseguir conversar com o banco de dados 
    public Categoria(){}

    public Categoria(String nome) {
        this.nome = nome;
        this.ativo = true;
    }

    
    //Metodos Getters e Setters;
    public Long getId(){return id;}
    public void setId(Long id){this.id = id;}
    public String getNome(){return nome;}
    public void setNome(String nome){this.nome = nome;}
    public boolean isAtivo() { return ativo; }
    public void setAtivo(boolean ativo) { this.ativo = ativo; }
    public Empresa getEmpresa() { return empresa; }
    public void setEmpresa(Empresa empresa) { this.empresa = empresa; }
}
