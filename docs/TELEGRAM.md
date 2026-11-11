# Telegram e consultas do Agente

## Login e troca de empresa

1. Em conversa privada com `NexoGestao_bot`, envie `/start`.
2. Informe o CNPJ, o CPF e a senha, em mensagens separadas. CNPJ e CPF aceitam pontuação.
3. O bot confirma o usuário e a empresa ativa. As consultas usam exclusivamente essa empresa.
4. Use `/trocar_empresa` ou `/trocar_usuario` para encerrar o acesso anterior e autenticar outra conta. O mesmo CPF precisa estar cadastrado e ter a senha validada na empresa escolhida.
5. Use `/sair` para encerrar. `/login` e `/start` também reiniciam o login.

O bot tenta apagar a mensagem da senha, sem registrar seu conteúdo ou encaminhá-la à IA. A exclusão pode falhar; a senha é transmitida como uma mensagem ao Telegram. As respostas e as informações já recebidas continuam no histórico do chat mesmo após sair ou trocar de empresa.

O Telegram não informa ao bot quando a pessoa simplesmente abre ou fecha o chat, nem diferencia uma sessão no navegador de outra no celular da mesma conta. A sessão expira após 15 minutos sem uso ou duas horas após autenticar. `/start` sempre exige novo login. Sessões e limites ficam em memória, por instância; reiniciar o backend encerra os acessos. Para várias réplicas, será necessário compartilhar esse estado e os limites e definir uma estratégia de recepção das atualizações do bot.

Cada chat pode enviar cinco tentativas de senha por janela de 15 minutos. Cinco senhas incorretas para a mesma conta bloqueiam o login por 15 minutos, tanto no Telegram quanto na web. Antes de cada consulta, o bot verifica se a conta ainda existe na empresa, o perfil atual e se a senha foi alterada.

## Permissões

| Perfil | Consultas no Telegram |
| --- | --- |
| ADMIN | Estoque, promoções, alertas, resumo, vendas, tendências, agenda, equipe e IA |
| COLABORADOR | Estoque, promoções e alertas de estoque |

Grupos e canais são ignorados. Nenhuma consulta recebe a empresa diretamente do texto do usuário. Uma pergunta à IA não pode mudar a empresa usada na montagem do contexto.

## Agente no sistema

O Agente mantém a IA e oferece oito atalhos: resumo, estoque, promoções, alertas, vendas, tendências, agenda e equipe. Os atalhos e comandos digitados (como `/estoque`) consultam `GET /api/agente/consultas/{comando}`, usando as mesmas rotinas do bot, sem depender da IA. O endpoint `POST /api/agente/perguntar` também reconhece comandos para clientes que ainda usam esse caminho. `/ajuda` lista os comandos e `/alerta` é aceito como alternativa a `/alertas`. A empresa vem do usuário autenticado no servidor, e os endpoints mantêm a exigência de ADMIN da tela do Agente.

## Ativação

Configure `TELEGRAM_ENABLED=true` e `BOT_TOKEN` no ambiente do backend e publique as alterações do backend e do frontend. `TELEGRAM_CHAT_ID` e `TELEGRAM_EMPRESA_ID` não são mais usados. Não é necessária alteração no esquema do banco.

Os testes automatizados usam H2, credenciais fictícias e respostas simuladas da interface. O envio e a exclusão de mensagens precisam ser conferidos no bot real após a publicação.

## Frontend atualizado e bot ainda sem login

O menu antigo com o título "Terminal Nexo" em resposta a `/start` é gerado pela implementação anterior do bot. Na implementação atual, `/start` invalida a sessão anterior e pede o CNPJ, inclusive para quem já está autenticado. Alterar apenas o frontend não atualiza o bot, que roda no processo Java do backend.

1. Confira no serviço backend do Railway se a branch e o diretório raiz são os corretos (`main` e `sistema-gestao`, para a configuração atual do projeto).
2. Confira se o deployment ativo usa o commit enviado com as alterações Java. Um push concluído não comprova que o deploy terminou. Se houver falha, consulte o primeiro erro nos logs de build/deploy antes de tentar novamente.
3. Publique o backend e aguarde a nova versão ficar ativa. Reiniciar um deployment antigo executará o código antigo novamente.
4. Confira no frontend se `VITE_API_URL` aponta para esse backend. Uma mudança nessa variável exige novo build do frontend.
5. Envie `/start`: o resultado esperado é o pedido de CNPJ. Antes de autenticar, `/estoque` não pode retornar produtos. Depois de entrar, confira a empresa confirmada pelo bot.
6. No Agente, confira tanto o botão Estoque quanto `/estoque` digitado. Ambos devem retornar a consulta direta, sem depender da chave Gemini.

Se o menu antigo persistir com o deployment correto ativo, verifique se existe outro serviço ou processo local executando a versão antiga com o mesmo token do bot. Não compartilhe o token nos logs ou nas capturas usadas para diagnóstico.
