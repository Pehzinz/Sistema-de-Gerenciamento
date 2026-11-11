package com.nexo.sistema_gestao.repository;

import com.nexo.sistema_gestao.model.Empresa;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EmpresaRepository extends JpaRepository<Empresa, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Empresa e where e.id = :id")
    Optional<Empresa> bloquearPorId(@org.springframework.data.repository.query.Param("id") Long id);
    Optional<Empresa> findByCnpj(String cnpj);

    @org.springframework.data.jpa.repository.Query("""
        select count(e) > 0 from Empresa e
        where replace(replace(replace(replace(e.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = :cnpj
        """)
    boolean existeCnpjNormalizado(String cnpj);
}
