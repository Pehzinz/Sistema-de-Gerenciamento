# Telegram e consultas do Agente

## Login e troca de empresa

1. Em conversa privada com `NexoGestao_bot`, envie `/start`.
2. Informe o CNPJ, o CPF e a senha, em mensagens separadas. CNPJ e CPF aceitam pontuação.
3. O bot confirma o usuário e a empresa ativa. As consultas usam exclusivamente essa empresa.
4. Use `/trocar_empresa` ou `/trocar_usuario` para encerrar o acesso anterior e autenticar outra conta. O mesmo CPF precisa estar cadastrado e ter a senha validada na empresa escolhida.
5. Use `/sair` para encerrar. `/login` e `/start` também reiniciam o login.

O bot tenta apagar a mensagem da senha, sem registrar seu conteúdo ou encaminhá-la à IA. A exclusão pode falhar; a senha é transmitida como uma mensagem ao Telegram. As respostas e as informações já recebidas continuam no histórico do chat mesmo após sair ou trocar de empresa.

O Telegram não informa ao bot quando a pessoa simplesmente abre ou fecha o chat, nem diferencia uma sessão no navegador de outra no celular da mesma conta. A sessão expira após 15 minutos sem uso ou duas horas após autenticar. `/start` sempre exige novo login. Sessões e limites ficam em memória, por instância; reiniciar o backend encerra os acessos. Para várias réplicas, será necessário compartilhar esse estado e os limites e definir uma estratégia de recepção das atualizações do bot.

São permitidas cinco tentativas de senha por janela de 15 minutos, por chat e por combinação de CPF/CNPJ. Reiniciar o fluxo não remove o limite. Antes de cada consulta, o bot verifica se a conta ainda existe na empresa, o perfil atual e se a senha foi alterada.

## Permissões

| Perfil | Consultas no Telegram |
| --- | --- |
| ADMIN | Estoque, promoções, alertas, resumo, vendas, tendências, agenda, equipe e IA |
| COLABORADOR | Estoque, promoções e alertas de estoque |

Grupos e canais são ignorados. Nenhuma consulta recebe a empresa diretamente do texto do usuário. Uma pergunta à IA não pode mudar a empresa usada na montagem do contexto.

## Agente no sistema

O Agente mantém a IA e oferece oito atalhos: resumo, estoque, promoções, alertas, vendas, tendências, agenda e equipe. Os atalhos consultam `GET /api/agente/consultas/{comando}`, usando as mesmas rotinas do bot, sem depender da IA. A empresa vem do usuário autenticado no servidor, e o endpoint mantém a exigência de ADMIN da tela do Agente.

## Ativação

Configure `TELEGRAM_ENABLED=true` e `BOT_TOKEN` no ambiente do backend e publique as alterações do backend e do frontend. `TELEGRAM_CHAT_ID` e `TELEGRAM_EMPRESA_ID` não são mais usados. Não é necessária alteração no esquema do banco.

Os testes automatizados usam H2, credenciais fictícias e respostas simuladas da interface. O envio e a exclusão de mensagens precisam ser conferidos no bot real após a publicação.
