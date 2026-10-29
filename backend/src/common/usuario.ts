import type { Request } from 'express';
import { Perfil, perfilApi } from './perfil.enum';

export interface UsuarioPublico {
  id: number; nome: string; email: string; perfil: Perfil; associadoId: number | null;
  telefone: string | null; endereco: string | null; contatoEmergencia: string | null; temFoto: boolean;
}
export const usuarioPublico = (u: any): UsuarioPublico => ({
  id: u.id, nome: u.nome, email: u.email, perfil: perfilApi(u.perfil), associadoId: u.associado_id,
  telefone: u.telefone, endereco: u.endereco, contatoEmergencia: u.contato_emergencia, temFoto: !!u.foto_path,
});
export type ReqAuth = Request & { usuario?: UsuarioPublico };
