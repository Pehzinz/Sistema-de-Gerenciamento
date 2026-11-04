package com.nexo.sistema_gestao.controller;

import com.nexo.sistema_gestao.model.Evento;
import com.nexo.sistema_gestao.model.Usuario;
import com.nexo.sistema_gestao.repository.EventoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/eventos")
public class EventoController {

    @Autowired
    private EventoRepository eventoRepository;

    private Long getEmpresaId() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return ((Usuario) auth.getPrincipal()).getEmpresa().getId();
    }

    @GetMapping
    public ResponseEntity<List<Evento>> listarTodos() {
        return ResponseEntity.ok(eventoRepository.findByEmpresaId(getEmpresaId()));
    }

    @PostMapping
    public ResponseEntity<Evento> criarEvento(@RequestBody Evento evento) {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        evento.setEmpresa(((Usuario) auth.getPrincipal()).getEmpresa());
        return ResponseEntity.status(HttpStatus.CREATED).body(eventoRepository.save(evento));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> atualizarEvento(@PathVariable Long id, @RequestBody Evento detalhesEvento) {
        Optional<Evento> eventoOpt = eventoRepository.findByIdAndEmpresaId(id, getEmpresaId());
        
        if (eventoOpt.isPresent()) {
            Evento evento = eventoOpt.get();
            evento.setTitulo(detalhesEvento.getTitulo());
            evento.setData(detalhesEvento.getData());
            evento.setHora(detalhesEvento.getHora());
            evento.setDescricao(detalhesEvento.getDescricao());
            
            return ResponseEntity.ok(eventoRepository.save(evento));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("{\"erro\": \"Evento não encontrado nesta empresa!\"}");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> excluirEvento(@PathVariable Long id) {
        Optional<Evento> eventoOpt = eventoRepository.findByIdAndEmpresaId(id, getEmpresaId());
        if (eventoOpt.isPresent()) {
            eventoRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }
}