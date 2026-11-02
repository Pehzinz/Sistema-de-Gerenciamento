package com.nexo.sistema_gestao.repository;

import com.nexo.sistema_gestao.model.Evento;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EventoRepository extends JpaRepository<Evento, Long> {
    // Lista todos os eventos da empresa
    List<Evento> findByEmpresaId(Long empresaId);

    // Busca um evento específico da empresa
    Optional<Evento> findByIdAndEmpresaId(Long id, Long empresaId);

    // Busca eventos futuros de uma empresa
    List<Evento> findByEmpresaIdAndDataGreaterThanEqualOrderByDataAscHoraAsc(Long empresaId, String data);
}