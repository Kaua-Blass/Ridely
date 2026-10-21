import { api } from '../../lib/api';

// TODO: chamadas de Entrar à API (/auth).
export const listar = () => api<unknown[]>('/auth');
