package com.nexo.sistema_gestao.repository;
import com.nexo.sistema_gestao.model.ItemVenda;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ItemVendaRepository extends JpaRepository<ItemVenda, Long>{}
