import { api } from '../../lib/api';
import type { PainelDados } from './types';

export const painel = () => api<PainelDados>('/painel');
