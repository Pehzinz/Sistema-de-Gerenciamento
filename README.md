# Nexo Gestão

Sistema de gestão com React/Vite e API Java 21/Spring Boot, hospedado no Railway com PostgreSQL do Supabase.

- [Revisão de segurança, qualidade e desempenho](docs/AUDITORIA.md)
- [Configuração, publicação e commit no GitHub](docs/PUBLICACAO.md)

## Executar e verificar

Configure as variáveis do backend no ambiente do processo, conforme [o exemplo](sistema-gestao/.env.example). O Spring não lê `.env` automaticamente. Para desenvolvimento, use um banco separado de produção.

```powershell
cd sistema-gestao
.\mvnw.cmd spring-boot:run
```

Em outro terminal:

```powershell
cd nexo-gestao-front
npm ci
npm run dev
```

Para definir outra API, copie `nexo-gestao-front/.env.example` para `.env.local` e ajuste `VITE_API_URL`. Variáveis `VITE_` são públicas.

```powershell
cd nexo-gestao-front
npm run lint -- --deny-warnings
npm run build
npx playwright install chromium
npm run test:e2e
```

```powershell
cd sistema-gestao
.\mvnw.cmd clean verify
```

Os testes Java usam H2 em memória e não precisam das credenciais do Supabase. Os testes de interface usam respostas simuladas da API. A CI executa os dois conjuntos em pull requests e pushes.

## Mudanças de comportamento

O login passa a durar a sessão da aba; credenciais antigas em `localStorage` são removidas. O JWT expira após duas horas. Novas senhas precisam ter pelo menos 12 caracteres e no máximo 72 bytes. Senhas antigas continuam aceitas no login.

Colaboradores podem consultar produtos/dados da empresa e registrar vendas. Gestão do catálogo, equipe, relatórios, calendário, agente e configurações exige perfil `ADMIN` no servidor.

Fotos exigem as variáveis `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` no backend. O Telegram fica desligado por padrão. A IA orienta o usuário a salvar eventos no calendário e não grava comandos extraídos de respostas do modelo.
