# Revisão de segurança, qualidade e desempenho

Data: 5 de novembro de 2026.

Revisão estática do código da API, entidades, repositórios, serviços, configuração e das 11 telas React, complementada por testes locais. Acesso ao Railway, painel do Supabase, Cloudinary e Telegram não foi realizado. Não houve alteração de dados nem publicação em produção. A revisão não equivale a um pentest, teste de carga ou certificação de ausência de vulnerabilidades.

## Falhas encontradas e corrigidas

| Prioridade | Falha original | Correção |
| --- | --- | --- |
| Crítica | Qualquer usuário autenticado podia chamar ações administrativas, inclusive criar administradores, limpar estoque e encerrar a empresa. Ocultar menus no React não impedia chamadas diretas. | Regras por método/rota em `SecurityConfigurations`: leitura necessária ao caixa e registro de venda liberados a autenticados; ações administrativas exigem `ADMIN`; rotas desconhecidas negadas. |
| Crítica | O Telegram respondia a qualquer remetente com dados da empresa de ID 1. | Bot desligado por padrão; quando habilitado, exige chat privado autorizado e empresa definida pelo operador. Não é uma integração multiempresa com vinculação individual. |
| Alta | `Usuario` podia devolver o hash BCrypt da senha no JSON. | Campo de senha somente de escrita; teste verifica que hashes e a propriedade não aparecem na resposta. |
| Alta | Venda aceitava operador, preço, subtotal e total do navegador. | Operador vem do token; preço e promoção são lidos do catálogo; subtotal/total calculados no servidor; divergência do total recusa a venda. |
| Alta | Dois caixas podiam vender a mesma última unidade, por leitura/atualização de estoque sem bloqueio. | Bloqueio pessimista dos produtos, ordem estável de aquisição e transação única para estoque/venda/itens; reposição e edição individual também usam bloqueio. |
| Alta | POST de usuário, categoria ou evento aceitava um ID de entidade existente, permitindo alteração indevida via `save`. | IDs de criação são descartados; empresa vem do usuário autenticado. |
| Alta | Produto podia referenciar categoria de outra empresa. | Categoria precisa pertencer à empresa autenticada e estar ativa. |
| Alta | Inicialização criava administrador com CPF/senha conhecidos, sem vínculo com empresa. | Bootstrap `TestaConexao` removido. Contas já existentes precisam de revisão no banco; remover código não remove dados antigos. |
| Alta | Upload usava preset público do Cloudinary, reutilizável por terceiros. | Assinatura SHA-256 no backend, restrita a administradores, com pasta por empresa, ID aleatório, formatos assinados e sobrescrita desativada. O preset público antigo ainda precisa ser desativado no painel. |
| Média | Expiração do JWT dependia do fuso horário do servidor. | Expiração por `Instant` e duração fixa de duas horas; segredo exige ao menos 32 bytes. |
| Média | Não havia limite local para login/cadastro e várias entradas inválidas chegavam ao banco. | Limites por IP, respostas genéricas de credenciais inválidas e validação de campos, senhas, quantidades, preços, promoções, datas e vínculos. |
| Média | Resposta da IA com marcador de agendamento gerava gravação automática. | Removida a execução de efeitos a partir do texto da IA, tanto na API quanto no bot. |
| Média | Categoria era globalmente única por nome, prejudicando empresas diferentes; exclusão por ID ignorava a verificação de estoque existente no fluxo por nome. | Removida unicidade global da entidade e unificados os critérios de exclusão. Banco existente requer a migração manual descrita abaixo. |

## Melhorias de desempenho e qualidade

- Rotas React carregadas sob demanda. Login não precisa baixar gráficos, agente e bibliotecas de PDF para abrir.
- Consultas independentes da tela de inteligência executadas em paralelo; removida consulta a cross-selling sem uso; botão de atualização passa a funcionar.
- Consultas de vendas carregam itens/produtos relacionados com `EntityGraph`, reduzindo consultas repetidas. Configurado batch de 50 para associações.
- Cache Caffeine com expiração de cinco minutos e até 500 entradas por cache. A venda mantém invalidação dos relatórios da empresa.
- Cliente Gemini reutilizado, com timeout de conexão/leitura, credencial no ambiente e limite diário sincronizado. Erros do provedor não são devolvidos com detalhes internos.
- Relógio de inatividade do caixa atualizado por intervalo de um segundo; eventos de mouse/toque apenas atualizam a referência de atividade.
- Bloqueio do botão durante conclusão de venda; verificação de total impede concluir com valor desatualizado.
- Corrigida classificação ABC do primeiro produto quando ele sozinho ultrapassa o limite de 80%. A interface identifica despesas como estimativa de 60%, pois não existe cadastro real de custos.
- Lint sem avisos e workflow de CI para frontend/backend.

## Responsividade

Todas as telas compartilham layout com altura dinâmica, áreas flexíveis e espaçamento adaptativo. Menu lateral vira menu recolhível até 1024 px; em celulares, formulários e cartões ficam em coluna. Tabelas têm rolagem horizontal própria e modais respeitam a largura/altura disponível. Calendário mantém sete colunas. Foco de teclado visível, idioma `pt-BR` e redução de animações quando solicitada pelo sistema.

## Validação executada

- `npm run lint -- --deny-warnings` e `npm run build`: aprovados.
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas reportadas no momento da consulta. Isso não cobre dependências Java nem substitui análise de código.
- Playwright: 61 testes aprovados, cobrindo as 11 telas em 320, 390, 768, 1024 e 1440 px, ausência de transbordamento na página/conteúdo principal, menu mobile, modal do calendário e redirecionamentos por perfil/login, upload assinado para a conta configurada e tratamento da ausência de configuração.
- Maven `verify`: 15 testes aprovados, incluindo testes de integração HTTP com banco H2 temporário, incluindo permissões, hashes, isolamento, IDs fornecidos pelo cliente, adulteração de preços, estoque concorrente, cadastro/login, expiração e upload; teste do limite de tentativas.
- Inspeção visual de capturas mobile de estoque, cadastro, calendário e modal. Testes de interface usam dados simulados; não exercitam serviços externos reais.

Os testes locais usaram Java 27 compilando com alvo 21 e Node 24. A CI está configurada para Java 21 e Node 24, mas só será executada no GitHub após o envio. Concorrência deve ser novamente exercitada contra PostgreSQL de staging; H2 não reproduz todos os comportamentos do PostgreSQL.

## Pendências de produção e limites da revisão

1. **Supabase/Data API:** conferir RLS, grants, funções e acesso dos papéis `anon`/`authenticated`. O projeto usa JWT próprio e JDBC; esse token não configura automaticamente políticas `auth.uid()` do Supabase. Se a Data API não for usada, considerar desativá-la. Usar papel de banco com privilégios mínimos; não expor credenciais JDBC/secret/service-role ao frontend. [Documentação do Supabase](https://supabase.com/docs/guides/database/secure-data).
2. **TLS do PostgreSQL:** verificar a URL efetiva do Railway. Preferir `sslmode=verify-full` com CA instalada e hostname correto; não basta alterar o exemplo sem disponibilizar o certificado. A configuração real não foi inspecionada. [Conexões e certificado](https://supabase.com/docs/guides/database/connecting-to-postgres).
3. **Schema e dados antigos:** executar primeiro `db/preflight.sql` em ambiente controlado. Depois de revisar resultados/backup, aplicar `db/001_hardening.sql` em staging e produção. Ele cria índices de consulta/unicidade e remove somente a restrição global de nome de categoria. Não apaga duplicatas, registros órfãos ou contas de teste. CPF/CNPJ ainda precisam de padronização de máscaras e validação de dígitos verificadores; os índices propostos usam os valores armazenados.
4. **Migrações:** `spring.jpa.hibernate.ddl-auto=update` foi mantido por compatibilidade. Depois de alinhar o schema e introduzir migrações versionadas, usar `validate` em produção; não trocar às cegas em um banco existente.
5. **Upload:** configurar credenciais do Cloudinary, desativar preset unsigned antigo e conferir quotas/restrições no provedor. A checagem local de 5 MB melhora a interface, mas não é controle de quota contra um cliente adulterado. Assinaturas do Cloudinary têm validade definida pelo provedor e não são tokens de uso único. [Assinaturas](https://cloudinary.com/documentation/authentication_signatures).
6. **Escala:** os endpoints de produtos/vendas ainda retornam listas completas. Históricos grandes precisam de paginação, filtros por período, agregações no PostgreSQL e renderização de tabelas por página. `EntityGraph`/cache reduzem consultas repetidas, mas não limitam o tamanho de uma empresa. Não foram executados benchmarks nem testes de carga.
7. **Sessões:** `sessionStorage` reduz persistência e compartilhamento involuntário entre abas, mas continua acessível a JavaScript. JWT emitido continua válido até expirar; alterar senha não revoga automaticamente tokens antigos. Considerar revogação/versionamento de sessão e cookies HttpOnly se houver evolução do modelo de autenticação.
8. **Limites de uso:** rate limit e quota Gemini são locais a cada instância e reiniciam com o processo. Replicação exige limites compartilhados/gateway. A quota Gemini de 20/dia é global à instância, incluindo o bot. Conferir IP real e tratamento de cabeçalhos encaminhados pelo proxy; cadastrar proteção de borda e limite de tamanho de corpo conforme a infraestrutura.
9. **Integridade/auditoria:** valores históricos já adulterados não são recalculados. Não há chave de idempotência persistente para venda: repetir uma requisição bem-sucedida pode gerar outra venda se houver estoque. Falta trilha de auditoria e reautenticação no servidor para encerramento de conta. Operações em lote de limpeza/exclusão de empresa precisam ser coordenadas com vendas ativas.
10. **Dependências e frontend em produção:** executar análise de composição de dependências Java e manter atualizações regulares; não foi realizada varredura completa de CVEs Maven nem auditoria do histórico Git. Conferir CSP, cabeçalhos, HTTPS, cache de arquivos com hash e fallback de SPA no serviço que entrega o frontend. Validar também Safari/iOS e Firefox em dispositivos reais.

## Fontes técnicas

- [Autorização por rota no Spring Security](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html).
- [Segurança dos presets do Cloudinary](https://cloudinary.com/documentation/upload_presets).
- [Variáveis no Railway](https://docs.railway.com/variables).
