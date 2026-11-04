package com.nexo.sistema_gestao.repository;

import com.nexo.sistema_gestao.model.Venda;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository 
public interface VendaRepository extends JpaRepository<Venda, Long> {
    // Lista todas as vendas da empresa (para o Dashboard)
    List<Venda> findByEmpresaId(Long empresaId);
}