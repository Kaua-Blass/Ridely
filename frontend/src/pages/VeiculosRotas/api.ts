import { api } from '../../lib/api';

// TODO: chamadas de Veículos e rotas à API (/veiculos-rotas).
export const listar = () => api<unknown[]>('/veiculos-rotas');
