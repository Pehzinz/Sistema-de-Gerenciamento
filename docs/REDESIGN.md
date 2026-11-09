# Redesign Nexo — 09/11/2026

A versão anterior está preservada no commit `2556291` e em uma cópia local completa dos arquivos versionados:

`.design-backups/nexo-antes-redesign-2026-11-09.zip`

O ZIP foi criado antes da primeira alteração. Inclui os arquivos versionados do repositório, sem dependências instaladas nem uma cópia do banco. A pasta é ignorada pelo Git; mantenha esse arquivo enquanto avalia o visual. Não há exclusão automática.

Para consultar a versão antiga, extraia esse ZIP em uma pasta separada. Para voltar ao visual anterior neste projeto, restaure os arquivos de `nexo-gestao-front/src` a partir da cópia, removendo apenas os novos componentes `label-input.jsx` e `animated-gradient.tsx`. Se houver alterações posteriores, compare os arquivos antes de substituir. O redesign não altera o banco nem o backend.

## Componentes e tema

- [Spell Label Input](https://spell.sh/docs/label-input): adaptação manual do código público para JSX e CSS, com rótulos associados, IDs únicos, refs, atributos nativos e botão de mostrar/ocultar senha em português.
- [Spell Animated Gradient](https://spell.sh/docs/animated-gradient): shader WebGL original e parâmetros exatos do preset Mist, com cores `#171021`, `#8e44ad`, `#171021`. A integração dispensa `next-themes`, limita a resolução do canvas, pausa em abas ocultas, respeita movimento reduzido e mantém um fundo estático quando WebGL não está disponível.
- Código de origem: [repositório Spell UI](https://github.com/xxtomm/spell-ui/tree/main/registry/spell-ui). Licença MIT preservada em `nexo-gestao-front/SPELL-UI-LICENSE.txt`.
- Instalação manual para manter o React/Vite e CSS existentes, sem introduzir Next.js, Tailwind ou configuração shadcn. Nenhuma nova dependência de execução.
- Tema compartilhado em `src/App.css`: paleta, tipografia, superfícies, navegação, tabelas, formulários, modais e login. Os estilos normalizam as declarações visuais inline das páginas atuais e mantêm seus layouts e estados.
- Campos textuais, numéricos, de senha e de data/hora usam `LabelInput`; seletores, upload, área de texto e opções de pagamento mantêm seus controles nativos e recebem o tema comum.

## Verificação

Execute no diretório `nexo-gestao-front`:

```powershell
npm run build
npm run lint -- --deny-warnings
npm run test:e2e
```

Os testes usam respostas simuladas da API. O conjunto cobre todas as rotas em 320, 390, 768, 1024 e 1440 pixels, além dos fluxos existentes. `tests/design.spec.js` verifica os novos campos, a visibilidade de senha e o login sem WebGL. Capturas de revisão são geradas em `test-results/`.

## Ajustes de padronização

Os campos de preço e custo agora começam na mesma altura. O seletor do controle de estoque usa o mesmo padrão de rótulo flutuante e altura dos demais campos. Os filtros das colunas do estoque mantêm o formato compacto anterior, sem receber as dimensões dos seletores de formulário.

Grupos de ações adjacentes compartilham um contorno arredondado com segmentos internos, na paleta roxa do projeto. Ações de exclusão continuam identificadas em vermelho. O texto dos botões permanece em uma linha; em espaços insuficientes, os segmentos podem ocupar outra linha dentro do grupo.

O login e a navegação usam o mesmo símbolo de camadas do Nexo. No desktop, o botão no topo da barra lateral alterna entre o menu completo e os ícones. A escolha é lembrada neste navegador. No celular, o botão Menu continua abrindo a navegação com os nomes das páginas.

## Publicar estes ajustes na Vercel

Os checks compartilhados mostram a integração do repositório com a Vercel. Para enviar os arquivos locais, execute na raiz do repositório:

```powershell
git status
git add nexo-gestao-front docs/REDESIGN.md
git commit -m "Padroniza formularios, botoes e barra lateral"
git push -u origin HEAD
```

Se a branch tiver um pull request aberto, o push o atualiza. Aguarde os checks de frontend/backend e o deploy de Preview da Vercel. Abra o link do Preview e confira as telas. Depois faça merge na branch configurada como produção na Vercel, normalmente `main`, para iniciar a publicação no endereço principal. Aguarde o deployment ficar Ready antes de conferir o site.

O comportamento depende da integração Git e da branch de produção configuradas no projeto. Consulte [Deploying Git Repositories with Vercel](https://vercel.com/docs/git). Estes ajustes alteram somente o frontend e não exigem migração do banco ou novas variáveis de ambiente.
