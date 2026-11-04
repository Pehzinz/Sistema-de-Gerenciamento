package com.nexo.sistema_gestao.model;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity 
@Table(name="vendas")
public class Venda {
    
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne 
    @JoinColumn(name="usuario_id")
    private Usuario usuario;

    @Column(name = "forma_pagamento", nullable = false, length = 50)
    private String formaPagamento;

    @Column(nullable = false)
    private BigDecimal total;

    // A CORREÇÃO ESTÁ AQUI: O Java agora tem permissão para inserir a data
    @Column(name = "data_venda", nullable = false)
    private LocalDateTime dataVenda;

    @OneToMany(mappedBy = "venda", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<ItemVenda> itens = new ArrayList<>();

    @ManyToOne
    @JoinColumn(name = "empresa_id")
    private Empresa empresa;

    // MÁGICA DO JPA: Antes de salvar no banco, ele crava o relógio do exato segundo da venda
    @PrePersist
    protected void onCreate() {
        this.dataVenda = LocalDateTime.now();
    }

    public Venda(){}

    public Long getId(){return id;}
    public void setId(Long id){this.id = id;}
    public Usuario getUsuario(){return usuario;}
    public void setUsuario(Usuario usuario){this.usuario = usuario;}
    public String getFormaPagamento(){return formaPagamento;}
    public void setFormaPagamento(String formaPagamento){this.formaPagamento = formaPagamento;}
    public BigDecimal getTotal(){return total;}
    public void setTotal(BigDecimal total){this.total = total;}
    public LocalDateTime getDataVenda(){return dataVenda;}
    public void setDataVenda(LocalDateTime dataVenda){this.dataVenda = dataVenda;}
    public List<ItemVenda> getItens() {return itens;}
    public void setItens(List<ItemVenda> itens) {this.itens = itens;}
    public Empresa getEmpresa() { return empresa; }
    public void setEmpresa(Empresa empresa) { this.empresa = empresa; }
}