export const moeda = valor => valor == null ? 'Não disponível' : Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
