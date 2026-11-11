package com.nexo.sistema_gestao.repository;

import com.nexo.sistema_gestao.model.Usuario;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository 
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select u from Usuario u
        where replace(replace(replace(u.cpf, '.', ''), '-', ''), ' ', '') = :cpf
        and u.empresa.id in (select e.id from Empresa e
            where replace(replace(replace(replace(e.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = :cnpj)
        and u.ativo = true order by u.id
        """)
    List<Usuario> bloquearPorDocumentos(String cpf, String cnpj);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select u from Usuario u where replace(replace(replace(u.cpf, '.', ''), '-', ''), ' ', '') = :cpf
        and u.empresa is not null and u.ativo = true order by u.id
        """)
    List<Usuario> bloquearPorCpfNormalizado(String cpf);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<Usuario> findByCpfAndAtivoTrueOrderById(String cpf);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select u from Usuario u where u.cpf = :cpf and u.ativo = true
        and u.empresa.id in (select e.id from Empresa e where e.cnpj = :cnpj) order by u.id
        """)
    List<Usuario> bloquearPorCpfECnpj(String cpf, String cnpj);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.id = :id and u.empresa.id = :empresaId and u.ativo = true")
    Optional<Usuario> bloquearAtivoPorIdEmpresa(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Usuario> findByHashRecuperacaoAndAtivoTrueAndPerfil(String hashRecuperacao, String perfil);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Usuario> findByHashConfirmacaoEmailAndAtivoTrueAndPerfil(String hashConfirmacaoEmail, String perfil);
    
    // Retorna todas as contas vinculadas a este CPF em empresas diferentes
    List<Usuario> findByCpf(String cpf);

    List<Usuario> findByCpfAndAtivoTrue(String cpf);
    List<Usuario> findByEmpresaIdAndAtivoTrue(Long empresaId);
    Optional<Usuario> findByIdAndEmpresaIdAndAtivoTrue(Long id, Long empresaId);
    long countByEmpresaIdAndPerfilAndAtivoTrue(Long empresaId, String perfil);

    // Busca um usuário específico de uma empresa pelo CNPJ
    Optional<Usuario> findByCpfAndEmpresaCnpj(String cpf, String cnpj);

    // Métodos Multi-tenant
    List<Usuario> findByEmpresaId(Long empresaId);
    Optional<Usuario> findByIdAndEmpresaId(Long id, Long empresaId);
}
