package com.nexo.sistema_gestao.repository;

import com.nexo.sistema_gestao.model.Produto;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProdutoRepository extends JpaRepository<Produto, String> {
    // Busca todos os produtos ativos de uma empresa
    List<Produto> findByEmpresaIdAndAtivoTrue(Long empresaId);
    
    // Busca um produto específico de uma empresa (apenas se estiver ativo)
    Optional<Produto> findByIdAndEmpresaIdAndAtivoTrue(String id, Long empresaId);
    
    // Busca produtos de uma categoria específica dentro de uma empresa
    List<Produto> findByCategoriaIdAndEmpresaIdAndAtivoTrue(Long categoriaId, Long empresaId);

    // Necessário para o POST (quando verificamos se um código de barras já existe na empresa, mesmo inativo)
    Optional<Produto> findByIdAndEmpresaId(String id, Long empresaId);

    //para exclusão dos dados da empresa
    List<Produto> findByEmpresaId(Long empresaId);
}