package com.nexo.sistema_gestao.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

@Entity
@Table(name = "produtos")
public class Produto {

    // A MÁGICA: O banco de dados usa essa chave segura (ex: 1-1010101010)
    // O @JsonIgnore impede completamente que o React veja isso!
    @Id
    @JsonIgnore 
    private String idInterno; 

    // O React envia e recebe este campo achando que é o oficial!
    @Column(nullable = false)
    @JsonProperty("id") 
    private String id; 

    @Column(nullable = false)
    private String nome;

    private String marca;

    @Column(nullable = false)
    private Double preco;

    @Column(nullable = false)
    private Integer estoque;

    @Column(nullable = false)
    private boolean ativo = true;

    @ManyToOne
    @JoinColumn(name = "categoria_id")
    private Categoria categoria;

    @Column(length = 500)
    private String imagemUrl;

    @Column(nullable = true)
    private Double precoPromocional;
    
    @Column(nullable = true)
    private java.time.LocalDate dataFimPromocao; 
    
    @Column(nullable = true)
    private java.time.LocalDate dataInicioPromocao;

    @ManyToOne
    @JoinColumn(name = "empresa_id")
    private Empresa empresa;

    public Produto() {}

    // Getters e Setters
    public String getIdInterno() { return idInterno; }
    public void setIdInterno(String idInterno) { this.idInterno = idInterno; }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getMarca() { return marca; }
    public void setMarca(String marca) { this.marca = marca; }
    public Double getPreco() { return preco; }
    public void setPreco(Double preco) { this.preco = preco; }
    public Integer getEstoque() { return estoque; }
    public void setEstoque(Integer estoque) { this.estoque = estoque; }
    public boolean isAtivo() { return ativo; }
    public void setAtivo(boolean ativo) { this.ativo = ativo; }
    public Categoria getCategoria() { return categoria; }
    public void setCategoria(Categoria categoria) { this.categoria = categoria; }
    public String getImagemUrl(){return this.imagemUrl;}
    public void setImagemUrl(String imagemUrl){this.imagemUrl = imagemUrl;}
    public Double getPrecoPromocional() {return precoPromocional;}
    public void setPrecoPromocional(Double precoPromocional) {this.precoPromocional = precoPromocional;}
    public java.time.LocalDate getDataInicioPromocao() {return dataInicioPromocao;}
    public void setDataInicioPromocao(java.time.LocalDate dataInicioPromocao) {this.dataInicioPromocao = dataInicioPromocao;}
    public java.time.LocalDate getDataFimPromocao() {return dataFimPromocao;}
    public void setDataFimPromocao(java.time.LocalDate dataFimPromocao) {this.dataFimPromocao = dataFimPromocao;}
    public Empresa getEmpresa() { return empresa; }
    public void setEmpresa(Empresa empresa) { this.empresa = empresa; }
}