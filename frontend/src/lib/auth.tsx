import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, post } from './api';
import type { Perfil } from './permissoes';

export interface Usuario {
  id: number; nome: string; email: string; perfil: Perfil; associadoId: number | null;
  telefone: string | null; endereco: string | null; contatoEmergencia: string | null; temFoto: boolean;
}
interface Ctx {
  usuario: Usuario | null; carregando: boolean; fotoV: number;
  entrar: (email: string, senha: string) => Promise<void>; sair: () => Promise<void>; recarregar: () => Promise<void>;
}

const AuthContext = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [fotoV, setFotoV] = useState(0); // muda a cada recarga, para o navegador buscar a foto nova

  // ao abrir a página, descobre se já existe sessão (cookie) válida
  useEffect(() => {
    api<Usuario>('/auth/me').then(setUsuario).catch(() => setUsuario(null)).finally(() => setCarregando(false));
  }, []);

  const recarregar = useCallback(async () => { setUsuario(await api<Usuario>('/auth/me')); setFotoV(Date.now()); }, []);
  async function entrar(email: string, senha: string) { setUsuario(await post<Usuario>('/auth/login', { email, senha })); setFotoV(Date.now()); }
  async function sair() { await post('/auth/logout'); setUsuario(null); }

  return <AuthContext.Provider value={{ usuario, carregando, fotoV, entrar, sair, recarregar }}>{children}</AuthContext.Provider>;
}
