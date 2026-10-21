import { api } from '../../lib/api';

// TODO: chamadas de Painel à API (/painel).
export const listar = () => api<unknown[]>('/painel');
