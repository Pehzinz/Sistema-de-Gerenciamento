export const SENHA_MINIMA = 6;
export const SENHA_MAX_BYTES = 72;
export const ERRO_NOVA_SENHA = 'A senha deve ter ao menos 6 caracteres e até 72 bytes.';

export function novaSenhaValida(senha) {
  return senha.trim() && [...senha].length >= SENHA_MINIMA
    && new TextEncoder().encode(senha).length <= SENHA_MAX_BYTES;
}
