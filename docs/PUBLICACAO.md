# Configuração, publicação e GitHub

As alterações estão nos arquivos locais. A publicação e o commit não foram executados.

## Atualização: banco reiniciado para demonstração

O responsável informou posteriormente que apagou as tabelas. Para o cadastro inicial e recuperação após essa limpeza, siga [Recuperar o cadastro](RECUPERAR_CADASTRO.md). Os resultados históricos listados abaixo pertencem ao banco anterior à limpeza e não confirmam o estado da base atual.

## Publicar a integração Cloudinary agora

A revisão dos registros históricos pode seguir separadamente da publicação da API corrigida. Os scripts SQL deste repositório são manuais: o deploy não os executa e não corrige operadores históricos por aproximação.

1. No Railway, confirme que as três variáveis `CLOUDINARY_*` estão no serviço **Sistema-Gestão** (backend). Aplique as mudanças pendentes pelo botão de deploy do painel. Use as credenciais novas, sem copiá-las para o código.
2. Envie a branch ao GitHub, abra o pull request e aguarde a CI. Revise e faça merge em `main` quando quiser publicar. Se os dois serviços Railway acompanham `main`, ambos precisam concluir o deploy.
3. Confira os diretórios raiz dos serviços: backend `sistema-gestao`; frontend `nexo-gestao-front`. Mantenha `VITE_API_URL` no frontend apontando para a API e `CORS_ALLOWED_ORIGINS` no backend apontando para o site. O Dockerfile do backend já gera o JAR; não há migração SQL automática.
4. Espere os dois deploys terminarem. Abra o site, saia e entre novamente como administrador. Em **Cadastrar produto**, escolha uma imagem JPG, PNG ou WebP com até 5 MB. Confirme que a prévia aparece e salve um produto de teste, ou use a edição de um produto existente.
5. Na nova conta Cloudinary, confira o arquivo enviado em **Media Library / Assets**, dentro de `nexo/<id-da-empresa>`. Recarregue o produto no sistema e confirme que a foto persiste. Links antigos continuam apontando para a conta antiga e não são reescritos pelo deploy.
6. Se houver 503 no pedido de assinatura, confira as três variáveis no backend e se o deploy das variáveis foi aplicado. Se o Cloudinary responder 401/403, confira se a chave e o segredo são do mesmo ambiente do Cloud name. Não crie preset unsigned: o fluxo novo não utiliza presets.

O teste com a conta real é feito depois do deploy. Os testes automatizados verificam a assinatura e o fluxo do navegador com credenciais e respostas fictícias, sem consumir sua conta Cloudinary.

## Pendências que não devem ser corrigidas apagando registros

A captura do diagnóstico detalhado informa que o usuário 1 é o único administrador da empresa 1 e tem 29 vendas vinculadas. Duas vendas verificadas têm `empresa_id` nulo; outra pertence à empresa 5 e está atribuída ao usuário da empresa 1. Não apagar esse administrador, preencher empresas ausentes por suposição ou trocar o operador da venda sem comprovação. Alterar a senha conhecida dessa conta pelo fluxo de edição de colaboradores, mantendo o acesso administrativo.

Confirmar a proteção da Data API separadamente. Se esse Supabase atende somente este sistema JDBC, desativar **Integrations → Data API → Enable Data API**; se atende outro sistema, revisar RLS/permissões conforme a auditoria. O código publicado não aplica alterações de RLS ao banco automaticamente.

## Conta de imagens escolhida

O projeto continuará usando Cloudinary para as fotos. O responsável confirmou que a conta acessível é nova e que adicionou `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` ao backend no Railway. Os valores não foram lidos nem testados por esta revisão. Usar credenciais novas em substituição às que apareceram em capturas.

As fotos existentes continuam apontando para a conta antiga, atualmente inacessível. Trocar credenciais configura os próximos uploads, mas não transfere arquivos antigos. Preserve os links existentes; para transferir as fotos será necessário obter os arquivos e enviá-los à nova conta. Não tente desativar o preset da conta antiga sem acesso a ela. O novo fluxo assinado não usa esse preset.

## Próximo passo: diagnóstico sem alterar o banco

Abra `sistema-gestao/db/diagnostico_resumo.sql`, copie todo o conteúdo e execute em **Supabase → SQL Editor → New query → Run**. O resultado é uma tabela com contagens de possíveis problemas de integridade e configuração de acesso. Ela não contém credenciais ou dados pessoais. As últimas linhas indicam configuração de RLS/permissões; não confirmam sozinhas que a Data API está exposta.

Revise os resultados antes de executar a migração. O diagnóstico não altera tabelas, fotos ou registros. A migração `001_hardening.sql` é uma etapa posterior, após revisão e backup.

## Resultados informados do banco existente

Na captura enviada pelo responsável, não apareceram duplicatas, usuários sem empresa, produtos com os problemas verificados ou categorias de outra empresa vinculadas a produtos. Foram encontrados: uma conta com o CPF de teste antigo, três vendas cujo usuário pertence a outra empresa e sete tabelas sem RLS com permissões para `anon`.

A conta com CPF de teste não deve ser apagada automaticamente: é necessário verificar se ela ainda é usada e se é a única administradora. O código anterior do caixa enviava `usuarioId: 1`, uma explicação possível para a atribuição incorreta das vendas. Isso não permite recuperar com certeza o operador histórico; não escolher um substituto por aproximação.

O arquivo `db/diagnostico_vinculos.sql` retorna somente IDs, perfis e contagens para essa revisão. Ele não altera dados nem apresenta nomes, senhas ou documentos pessoais.

Para o acesso às tabelas, verificar **Supabase → Integrations → Data API → Enable Data API**. O código deste repositório usa JDBC pelo backend Java e Cloudinary para imagens, sem consultas Supabase REST/GraphQL. Se este projeto Supabase não atende outro sistema que dependa da Data API, desativá-la é a medida imediata recomendada; isso não exige trocar a URL JDBC do Railway. Conferir login e catálogo depois da alteração. Essa medida não ativa RLS e as duas últimas contagens do diagnóstico podem permanecer em sete até o endurecimento específico das permissões/tabelas.

Referência: [Desativar a Data API quando ela não é utilizada](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api).

## Antes de publicar

1. Crie backup do banco e valide a versão em staging. Revise a [auditoria](AUDITORIA.md), principalmente contas antigas de teste, RLS/Data API e duplicatas.
2. No serviço **backend do Railway**, confira `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` e `CORS_ALLOWED_ORIGINS`. O segredo JWT precisa ser aleatório e ter pelo menos 32 bytes. Trocar o segredo desconecta sessões existentes. As origens CORS devem ser URLs exatas do frontend, separadas por vírgula. O exemplo completo está em `sistema-gestao/.env.example`.
3. Para gerar um segredo no PowerShell 7: `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`. Guarde o resultado apenas na variável `JWT_SECRET` do serviço. Nunca em código, prints ou mensagens de commit.
4. Para fotos, configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` no backend. Depois do deploy, teste upload como administrador na nova conta. Não há preset antigo a desativar nessa conta nova. Sem essas variáveis, a API retorna 503 explicando que o upload não está configurado. A chave secreta permanece no servidor. [Fluxo oficial de assinatura](https://cloudinary.com/documentation/authentication_signatures).
5. Para IA, configure `GEMINI_API_KEY` e um `GEMINI_MODEL` disponível na sua conta. Sem a chave, o agente informa que não foi configurado. O modelo é configurável; a disponibilidade real não foi verificada.
6. Para habilitar o Telegram, configure `TELEGRAM_ENABLED=true` e `BOT_TOKEN`. O bot exige CNPJ, CPF e senha em conversa privada; `TELEGRAM_CHAT_ID` e `TELEGRAM_EMPRESA_ID` deixaram de ser utilizados. Consulte [o fluxo e as permissões](TELEGRAM.md).
7. No serviço **frontend do Railway**, configure `VITE_API_URL` com a URL HTTPS pública da API. Faça novo build após mudar essa variável: valores `VITE_` são incorporados ao bundle e são públicos. Nenhuma senha/token privado deve receber prefixo `VITE_`. [Variáveis de build no Railway](https://docs.railway.com/variables).
8. Confirme que o serviço entrega `dist` com fallback para `index.html` em `/admin`, `/caixa` etc. e escuta a porta indicada pelo Railway. Teste atualizar a página diretamente em uma rota interna. Não use o servidor de desenvolvimento Vite como servidor de produção.

## Conexão Supabase e migração

O backend já usa Hikari com no máximo cinco conexões por instância. Se usar Session Pooler, copie host/porta/usuário do painel Supabase; o usuário normalmente inclui o identificador do projeto. A URL precisa ser JDBC, por exemplo `jdbc:postgresql://HOST:5432/postgres?...`, com usuário/senha em variáveis separadas. [Conexões oficiais](https://supabase.com/docs/guides/database/connecting-to-postgres).

Para `sslmode=verify-full`, baixe a CA do painel, disponibilize-a na imagem/volume do backend e configure `sslrootcert` para esse caminho. O arquivo de exemplo usa `/app/certs/supabase-ca.crt`, mas esse arquivo não é incluído automaticamente no Dockerfile. Se optar por incluí-lo na imagem, adicione o certificado público em `sistema-gestao/certs/supabase-ca.crt` e uma instrução `COPY certs/supabase-ca.crt /app/certs/supabase-ca.crt` no estágio final do Dockerfile. Não desative a verificação de certificado para resolver erros de configuração.

Execute `sistema-gestao/db/preflight.sql` e revise os resultados. Corrija vínculos/duplicatas com conhecimento do negócio e backup. Então aplique `sistema-gestao/db/001_hardening.sql` primeiro em staging. Ele não é executado pelo Spring nem pela CI. Em bases grandes, a criação de índices pode bloquear escrita; planeje a janela com quem administra o banco.

## Conferir localmente

Na pasta `nexo-gestao-front`:

```powershell
npm ci
npm run lint -- --deny-warnings
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

Na pasta `sistema-gestao`, com JDK 21 ou superior:

```powershell
.\mvnw.cmd clean verify
```

O wrapper pode precisar baixar Maven na primeira execução. Se o Windows apontar falha de permissão no cache, execute em um terminal normal com acesso ao seu perfil/cache. Nos testes desta revisão, foi necessário chamar o Maven já instalado no cache explicitamente por causa das restrições do ambiente; o wrapper original foi preservado.

## Commit e envio para o GitHub

Abra o terminal **na raiz deste projeto**. O remoto `origin` já aponta para `https://github.com/Pehzinz/Sistema-de-Gerenciamento` e a branch atual verificada foi `main`.

```powershell
git status
git diff
git switch -c codex/seguranca-responsividade
git add .
git diff --cached --stat
git diff --cached
git commit -m "Corrige seguranca e adapta layout responsivo"
git push -u origin codex/seguranca-responsividade
```

O `commit` salva a revisão localmente; o `push` envia a branch ao GitHub. Na revisão do diff, confira que não há credenciais ou arquivos pessoais. `.env`, `node_modules`, `dist` e saídas do Playwright estão no `.gitignore`. Já existiam alterações locais em `App.css` e `WebConfig.java`; elas foram preservadas e também aparecerão no commit se você usar `git add .`.

Se for seu primeiro commit e o Git pedir identidade, configure o nome/email **deste repositório**, usando seus dados ou o email privado disponibilizado pelo GitHub:

```powershell
git config user.name "Seu Nome"
git config user.email "Seu email de commit"
```

Abra o [repositório no GitHub](https://github.com/Pehzinz/Sistema-de-Gerenciamento) e use **Compare & pull request** para comparar `codex/seguranca-responsividade` com `main`. Aguarde a CI e revise o diff. Depois de preparar as variáveis e o banco, faça merge. Se o Railway acompanha `main`, esse merge poderá disparar a publicação automaticamente.

Se o push for rejeitado ou houver conflitos, examine a mensagem antes de prosseguir. Evite `push --force` e `reset --hard`, pois podem sobrescrever trabalho.
