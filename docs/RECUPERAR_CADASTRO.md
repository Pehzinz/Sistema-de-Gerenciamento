# Cadastro depois de apagar as tabelas

O responsável informou que apagou as tabelas do banco para reiniciar uma demonstração. Os diagnósticos anteriores sobre administradores e vendas descrevem o banco antes dessa limpeza; os IDs antigos não devem ser usados para corrigir uma base recriada.

## O que foi reproduzido e corrigido

O login e o cadastro são rotas públicas. Em teste HTTP com banco temporário, cadastrar a primeira empresa e entrar funcionou sem usuários preexistentes.

Ao simular uma tabela removida com o backend ligado, a consulta falhou e o encaminhamento interno para `/error` acabou recebendo 401 da configuração de segurança. Essa resposta vazia também fazia o frontend mostrar “Erro de conexão com o servidor”. Um erro interno não indicava necessariamente falta de autorização.

A correção permite somente o dispatch interno do tipo ERROR, preservando a proteção das requisições normais. Falhas de acesso ao banco passam a retornar 503 com mensagem genérica em JSON; o detalhe técnico fica nos Deploy Logs. O frontend distingue respostas HTTP de falhas de rede, mesmo quando o proxy envia uma resposta vazia ou HTML.

Após cadastrar uma empresa, o navegador passa a lembrar o CNPJ e o nome recém-cadastrados, limpa a sessão antiga e prepara o próximo login para essa empresa.

Validação local: 30 testes Java, 69 testes de interface, lint sem avisos e build aprovados. Os testes usam H2 e respostas simuladas no navegador, sem modificar o Supabase.

## Recuperar a demonstração

1. Salve as alterações em commit e envie para a branch que o Railway publica.
2. No Railway, publique a nova versão do backend **Sistema-Gestão** e do frontend **Nexo-Gestão-Front**. Aguarde ambos terminarem.
3. O backend usa `spring.jpa.hibernate.ddl-auto=update`: na inicialização, o Hibernate tenta criar tabelas ausentes. Isso exige conexão válida e permissão para criar objetos no banco. Apagar tabelas enquanto o processo está ligado não dispara essa inicialização novamente.
4. Se quiser conferir, execute `sistema-gestao/db/verificar_tabelas.sql` no SQL Editor do Supabase. É uma consulta somente de leitura que funciona mesmo com tabelas ausentes; as sete tabelas devem aparecer como `EXISTE`.
5. Abra o site atualizado. Caso apareça o nome de uma empresa antiga no login, clique em **Trocar de Empresa**. Cadastre a empresa e o administrador, com senha de pelo menos 6 caracteres, e entre. Se o banco estiver realmente vazio, é possível reutilizar CPF/CNPJ anteriores: a exigência é que não conflitem com registros existentes na base atual.
6. Se ainda houver falha, abra o último deployment do backend e a aba **Deploy Logs**, não apenas Network Logs. Procure o primeiro erro de banco: tabela ausente, permissão, senha, conexão ou falha na criação do schema. Não envie variáveis secretas junto dos logs.

Não use `create-drop` ou `create` em produção para limpar a demonstração automaticamente. Prefira um projeto Supabase/ambiente Railway separado para demonstrações, evitando apagar dados reais. A limpeza de tabelas não invalida por si só todos os JWTs emitidos: para invalidá-los em uma reinicialização intencional do ambiente de demonstração, troque o `JWT_SECRET` e publique o backend, mantendo o novo segredo somente no Railway.

Se tabelas forem recriadas pelo Hibernate, confira novamente RLS/permissões e a configuração da Data API. As proteções de tabelas removidas também deixam de existir quando elas são apagadas.

Referências: [Inicialização do banco no Spring Boot](https://docs.spring.io/spring-boot/how-to/data-initialization.html), [dispatch de erros no Spring Security](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html).
