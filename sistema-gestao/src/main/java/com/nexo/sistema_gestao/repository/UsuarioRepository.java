package com.nexo.sistema_gestao.repository;

import com.nexo.sistema_gestao.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository 
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    
    // Retorna todas as contas vinculadas a este CPF em empresas diferentes
    List<Usuario> findByCpf(String cpf);

    // Busca um usuário específico de uma empresa pelo CNPJ
    Optional<Usuario> findByCpfAndEmpresaCnpj(String cpf, String cnpj);

    // Métodos Multi-tenant
    List<Usuario> findByEmpresaId(Long empresaId);
    Optional<Usuario> findByIdAndEmpresaId(Long id, Long empresaId);
}