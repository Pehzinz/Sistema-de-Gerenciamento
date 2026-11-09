# Autoatendimento do colaborador

O perfil `COLABORADOR` usa o Caixa PDV sem Navbar, ocupando toda a área disponível. Um botão discreto no canto inferior esquerdo abre a autorização de saída. O administrador continua com o Caixa e a navegação habituais.

## Escala visual do totem

A interface do colaborador usa uma área de conteúdo de até 1600 px, tipografia maior, campos e ações principais com 64 px de altura, controles de quantidade de 48 px e opções de pagamento com pelo menos 76 px. O total e as informações dos produtos têm maior destaque. Telas de até 1100 px organizam os painéis verticalmente; em telas menores, o formulário de inclusão também se empilha. O botão de saída permanece discreto. Esses estilos são exclusivos do perfil de autoatendimento e não alteram a escala do Caixa do administrador.

## Saída autorizada

O responsável informa CPF e senha de administrador da empresa configurada no terminal. A validação usa o endpoint de login existente, sujeito ao limite de tentativas do servidor. Credenciais de colaborador, administrador de outra empresa, resposta inválida, falha de rede ou erro do servidor não liberam a saída.

Após a autorização, o sistema encerra a identidade do colaborador e volta ao login, mantendo o vínculo do terminal com a empresa. A identidade/token do administrador não é gravada no navegador. Cancelar aborta a solicitação pendente e apaga os campos; a inatividade também fecha a autorização e limpa os dados. A proteção de remoção e redução de itens do carrinho continua disponível.

Enquanto a sessão de colaborador estiver ativa, navegar para a raiz do sistema volta ao PDV. As outras páginas continuam protegidas por perfil. A sessão continua sujeita à expiração do JWT já definida no backend; este ajuste não cria uma sessão permanente.

## Tela cheia no site

O PDV do colaborador solicita a Fullscreen API na primeira interação de toque/clique ou teclado. Se a API não estiver disponível ou for recusada, o Caixa continua utilizável. Não existe alternância de tela cheia por duplo clique no aplicativo. Não há alteração no comportamento de tela cheia para o administrador.

Uma página comum não consegue impor que somente F11 permita sair, bloquear os controles do navegador ou impedir todos os atalhos do sistema. A API depende de interação do usuário e o navegador controla a saída. Duplo clique na barra de título pertence ao navegador/Windows, fora do controle da página.

Referência: [MDN — Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide).

## Bloqueio do equipamento com Windows e Edge

Para um terminal público, configure **Acesso atribuído / modo quiosque de aplicativo único**, usando uma conta Windows própria para o totem e Microsoft Edge em tela cheia. O responsável deve manter uma conta Windows de administrador separada.

1. No equipamento do totem, abra **Configurações → Contas → Outros usuários → Configurar um quiosque**. A nomenclatura pode variar conforme a versão/edição do Windows.
2. Crie/selecione a conta dedicada do quiosque, escolha Microsoft Edge e o modo de exibição de um único site em tela cheia (**Digital/Interactive Signage**). Informe o endereço de login do Nexo.
3. Configure as políticas `URLBlocklist` e `URLAllowlist` para permitir apenas os endereços necessários ao sistema. Inclua os serviços usados pelo terminal ao validar essa configuração.
4. Entre na conta do quiosque, faça login no Nexo como colaborador e teste o fluxo completo de compra e a saída autorizada. Verifique também os atalhos físicos disponíveis no teclado do terminal.

Como teste do modo de navegador, antes da configuração de Acesso atribuído, feche as janelas do Edge e execute manualmente no PowerShell, substituindo o endereço:

```powershell
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --kiosk "https://SEU-SITE/" --edge-kiosk-type=fullscreen --no-first-run
```

Esse comando abre o navegador em modo quiosque, mas o confinamento do equipamento depende também do Acesso atribuído. No modo quiosque do Edge, F11 e F12 são bloqueados pelo navegador: F11 deixa de ser um atalho de saída. A saída administrativa do ambiente Windows é separada da autorização do PDV; normalmente usa Ctrl+Alt+Del e o acesso à conta Windows do responsável.

O botão do PDV encerra a sessão do Nexo; ele não fecha o Edge nem remove o bloqueio do Windows. O perfil `ADMIN` mantém o layout normal do site, mas as restrições do navegador/Windows pertencem ao dispositivo inteiro, independentemente do perfil usado no Nexo.

Documentação oficial: [Configurar o modo quiosque do Edge](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-configure-kiosk-mode) e [Configurar um quiosque com Acesso atribuído](https://learn.microsoft.com/en-us/windows/configuration/assigned-access/quickstart-kiosk).

Esta alteração prepara o aplicativo. Nenhuma configuração do navegador ou do Windows foi aplicada automaticamente nesta máquina.
