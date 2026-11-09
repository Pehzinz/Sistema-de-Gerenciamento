package com.nexo.sistema_gestao;

import com.nexo.sistema_gestao.model.*;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.boot.model.relational.internal.SqlStringGenerationContextImpl;
import org.hibernate.engine.jdbc.env.spi.JdbcEnvironment;
import org.hibernate.mapping.Table;
import org.hibernate.tool.schema.extract.spi.ColumnInformation;
import org.hibernate.tool.schema.extract.spi.TableInformation;
import org.hibernate.tool.schema.internal.StandardTableMigrator;
import org.junit.jupiter.api.Test;
import java.sql.Types;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProdutoSchemaTests {
    @Test void atualizacaoPostgresSeparaTipoDoDefault() {
        var registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect")
                .applySetting("hibernate.boot.allow_jdbc_metadata_access", false)
                .build();
        try {
            var metadata = new MetadataSources(registry)
                    .addAnnotatedClasses(Produto.class, Categoria.class, Empresa.class, Usuario.class, Venda.class, ItemVenda.class)
                    .buildMetadata();
            var coluna = metadata.getEntityBinding(Produto.class.getName()).getProperty("tipoEstoque").getColumns().getFirst();
            var tabela = new Table();
            tabela.setName("produtos");
            tabela.addColumn(coluna);
            var existente = mock(ColumnInformation.class);
            when(existente.getTypeCode()).thenReturn(Types.VARCHAR);
            when(existente.getTypeName()).thenReturn("varchar");
            when(existente.getColumnSize()).thenReturn(255);
            var informacao = mock(TableInformation.class);
            when(informacao.getColumn(any())).thenReturn(existente);
            var ambiente = registry.getService(JdbcEnvironment.class);
            var comandos = new StandardTableMigrator(ambiente.getDialect()).getSqlAlterStrings(
                    tabela, metadata, informacao, SqlStringGenerationContextImpl.forTests(ambiente));
            assertEquals(1, comandos.length);
            assertTrue(comandos[0].contains("set data type varchar(32)"), comandos[0]);
            assertFalse(comandos[0].contains("default"), comandos[0]);
            assertEquals("'PADRAO'", coluna.getDefaultValue());
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }
}
