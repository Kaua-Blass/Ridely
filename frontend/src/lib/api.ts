export class ApiError extends Error {
  constructor(mensagem: string, public status: number) { super(mensagem); }
}

/** Cliente HTTP único. A sessão vai em cookie httpOnly: o JavaScript nunca enxerga o token. */
export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    credentials: 'same-origin',
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...opcoes.headers },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = Array.isArray(corpo.message) ? corpo.message.join(' ') : corpo.message;
    throw new ApiError(m ?? 'Erro na requisição', r.status);
  }
  return corpo as T;
}
export const post = <T,>(caminho: string, dados: unknown = {}) => api<T>(caminho, { method: 'POST', body: JSON.stringify(dados) });
