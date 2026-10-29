export class ApiError extends Error {
  constructor(mensagem: string, public status: number) { super(mensagem); }
}

/** Cliente HTTP único. A sessão vai em cookie httpOnly: o JavaScript nunca enxerga o token. */
export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const headers = new Headers(opcoes.headers);
  if (!(opcoes.body instanceof FormData)) headers.set('Content-Type', 'application/json'); // com FormData o navegador define o tipo
  const r = await fetch(`/api${caminho}`, { credentials: 'same-origin', ...opcoes, headers });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = Array.isArray(corpo.message) ? corpo.message.join(' ') : corpo.message;
    throw new ApiError(m ?? 'Erro na requisição', r.status);
  }
  return corpo as T;
}
const com = (metodo: string) => <T,>(caminho: string, dados: unknown = {}) => api<T>(caminho, { method: metodo, body: JSON.stringify(dados) });
export const post = com('POST');
export const patch = com('PATCH');
export const put = com('PUT');
export const del = <T,>(caminho: string) => api<T>(caminho, { method: 'DELETE' });
