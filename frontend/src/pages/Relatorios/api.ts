import { api } from '../../lib/api';

// TODO: chamadas de Relatórios à API (/relatorios).
export const listar = () => api<unknown[]>('/relatorios');
