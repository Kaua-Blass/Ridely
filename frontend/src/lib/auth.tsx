import { createContext, ReactNode, useContext, useState } from 'react';
import { api, definirToken } from './api';
import type { Perfil } from './permissoes';

export interface Usuario { id: number; nome: string; email: string; perfil: Perfil; associadoId: number | null; fotoUrl?: string }
interface Ctx { usuario: Usuario | null; entrar: (email: string, senha: string) => Promise<void>; sair: () => void }

const AuthContext = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  async function entrar(email: string, senha: string) {
    const r = await api<{ token: string; usuario: Usuario }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    definirToken(r.token);
    setUsuario(r.usuario);
  }
  const sair = () => { definirToken(null); setUsuario(null); };
  return <AuthContext.Provider value={{ usuario, entrar, sair }}>{children}</AuthContext.Provider>;
}
