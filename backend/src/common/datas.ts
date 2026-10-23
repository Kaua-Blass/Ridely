/** Hoje no fuso da associação, como 'AAAA-MM-DD'. */
export const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const ms = (s: string) => Date.parse(`${s}T12:00:00Z`);
export const diasEntre = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86_400_000);
