import { api } from '../../lib/api';

// TODO: chamadas de Meu perfil à API (/perfil).
export const listar = () => api<unknown[]>('/perfil');
