// Cliente HTTP único. O token de acesso fica em memória (AuthProvider).
let token: string | null = null;
export const definirToken = (t: string | null) => { token = t; };

export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opcoes.headers },
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'Erro na requisição');
  return r.json() as Promise<T>;
}
