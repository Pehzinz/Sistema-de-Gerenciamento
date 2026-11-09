package com.nexo.sistema_gestao.repository;

import com.nexo.sistema_gestao.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository 
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    @org.springframework.data.jpa.repository.Query("""
        select u from Usuario u join fetch u.empresa e
        where replace(replace(replace(u.cpf, '.', ''), '-', ''), ' ', '') = :cpf
        and replace(replace(replace(replace(e.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = :cnpj
        and u.ativo = true
        """)
    Optional<Usuario> findByCredenciaisTelegram(@org.springframework.data.repository.query.Param("cpf") String cpf,
            @org.springframework.data.repository.query.Param("cnpj") String cnpj);
    
    // Retorna todas as contas vinculadas a este CPF em empresas diferentes
    List<Usuario> findByCpf(String cpf);

    List<Usuario> findByCpfAndAtivoTrue(String cpf);
    Optional<Usuario> findByCpfAndEmpresaCnpjAndAtivoTrue(String cpf, String cnpj);
    List<Usuario> findByEmpresaIdAndAtivoTrue(Long empresaId);
    Optional<Usuario> findByIdAndEmpresaIdAndAtivoTrue(Long id, Long empresaId);
    long countByEmpresaIdAndPerfilAndAtivoTrue(Long empresaId, String perfil);

    // Busca um usuário específico de uma empresa pelo CNPJ
    Optional<Usuario> findByCpfAndEmpresaCnpj(String cpf, String cnpj);

    // Métodos Multi-tenant
    List<Usuario> findByEmpresaId(Long empresaId);
    Optional<Usuario> findByIdAndEmpresaId(Long id, Long empresaId);
}
