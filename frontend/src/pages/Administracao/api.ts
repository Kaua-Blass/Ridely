import { api } from '../../lib/api';

// TODO: chamadas de Administração à API (/administracao).
export const listar = () => api<unknown[]>('/administracao');
