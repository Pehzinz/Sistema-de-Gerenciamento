//Como uma venda pode conter vários produtos diferentes, esta classe conecta os produtos à venda, guardando a quantidade e o subtotal
package com.nexo.sistema_gestao.model;
import jakarta.persistence.*;
import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "itens_venda")
public class ItemVenda {
    //Atributos do Objeto ItemVendas
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Conecta este item à Venda principal
    @ManyToOne
    @JoinColumn(name = "venda_id")
    @JsonIgnore 
    private Venda venda;

    // Conecta este item a um Produto do estoque
    @ManyToOne
    @JoinColumn(name = "produto_id")
    private Produto produto;

    @Column(nullable = false)
    private Integer quantidade;

    @Column(name = "preco_unitario", nullable = false)
    private BigDecimal precoUnitario;

    @Column(nullable = false)
    private BigDecimal subtotal;


    //Construtor para o JPA conseguir trabalhar no banco de dados
    public ItemVenda(){}

    //Metodos Getters e Setters;
    public Long getId(){return id;}
    public void setId(Long id){this.id = id;}
    public Venda getVenda(){return venda;}
    public void setVenda(Venda venda){this.venda = venda;}
    public Produto getProduto(){return produto;}
    public void setProduto(Produto produto){this.produto = produto;}
    public Integer getQuantidade(){return quantidade;}
    public void setQuantidade(Integer quantidade){this.quantidade = quantidade;}
    public BigDecimal getPrecoUnitario(){return precoUnitario;}
    public void setPrecoUnitario(BigDecimal precoUnitario){this.precoUnitario = precoUnitario;}
    public BigDecimal getSubtotal(){return subtotal;}
    public void setSubtotal(BigDecimal subtotal){this.subtotal = subtotal;}
}