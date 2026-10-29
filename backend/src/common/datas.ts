/** Hoje no fuso da associação, como 'AAAA-MM-DD'. */
/** Relógio do servidor. RELOGIO_FALSO (ex.: 2026-10-26T14:30:00-03:00) existe só para testes e é ignorado em produção. */
const agora = () => (process.env.NODE_ENV !== 'production' && process.env.RELOGIO_FALSO ? new Date(process.env.RELOGIO_FALSO) : new Date());
/** Hoje no fuso da associação, como 'AAAA-MM-DD'. */
export const hoje = () => agora().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
/** Minutos desde a meia-noite, no fuso da associação. */
export const minutosAgora = () => {
  const [h, m] = agora().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false, hour: '2-digit', minute: '2-digit' }).split(':').map(Number);
  return (h % 24) * 60 + m;
};

export const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const ms = (s: string) => Date.parse(`${s}T12:00:00Z`);
export const diasEntre = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86_400_000);

/** 0 = domingo ... 6 = sábado. */
export const diaSemana = (s: string) => new Date(`${s}T12:00:00Z`).getUTCDay();
export const somarDias = (s: string, n: number) => new Date(ms(s) + n * 86_400_000).toISOString().slice(0, 10);
