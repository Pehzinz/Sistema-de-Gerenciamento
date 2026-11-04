package com.nexo.sistema_gestao.repository;

import com.nexo.sistema_gestao.model.Categoria;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CategoriaRepository extends JpaRepository<Categoria, Long> {
    // Retorna categorias ativas de uma empresa
    List<Categoria> findByEmpresaIdAndAtivoTrue(Long empresaId);
    
    // Busca para evitar categorias com nomes duplicados na mesma empresa
    Optional<Categoria> findByNomeIgnoreCaseAndEmpresaId(String nome, Long empresaId);

    // Busca categoria pelo ID validando a empresa
    Optional<Categoria> findByIdAndEmpresaId(Long id, Long empresaId);

    //para exclusão dos dados da empresa
    List<Categoria> findByEmpresaId(Long empresaId);
}