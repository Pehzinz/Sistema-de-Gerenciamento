package com.nexo.sistema_gestao;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class CustosMigrationTests {
    @Test void migrationAddsNullableColumnsAndCanBeRepeatedWithoutChangingExistingCosts() throws Exception {
        try (var conexao = DriverManager.getConnection("jdbc:h2:mem:costsMigration;MODE=PostgreSQL", "sa", "");
             var sql = conexao.createStatement()) {
            sql.execute("create table produtos (id varchar primary key, empresa_id bigint)");
            sql.execute("create table itens_venda (id bigint primary key)");
            sql.execute("insert into produtos values ('produto', 1)");
            sql.execute("insert into itens_venda values (1)");
            var script = new FileSystemResource("db/002_custos_produtos.sql");
            ScriptUtils.executeSqlScript(conexao, script);
            try (var resultado = sql.executeQuery("select custo_unitario from itens_venda")) {
                assertTrue(resultado.next()); assertNull(resultado.getBigDecimal(1));
            }
            sql.execute("update produtos set custo_unitario=12.50 where id='produto'");
            ScriptUtils.executeSqlScript(conexao, script);
            try (var resultado = sql.executeQuery("select custo_unitario from produtos")) {
                assertTrue(resultado.next()); assertEquals(new java.math.BigDecimal("12.50"), resultado.getBigDecimal(1));
            }
        }
    }
}
