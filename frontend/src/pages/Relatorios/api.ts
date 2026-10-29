import { api } from '../../lib/api';
import type { ContratosAVencer, FluxoCaixa, Inadimplencia } from './types';

export const inadimplencia = () => api<Inadimplencia>('/relatorios/inadimplencia');
export const fluxoCaixa = (de: string, ate: string) => api<FluxoCaixa>(`/relatorios/fluxo-caixa?de=${de}&ate=${ate}`);
export const contratosAVencer = () => api<ContratosAVencer>('/relatorios/contratos-a-vencer');

export type Tipo = 'inadimplencia' | 'fluxo' | 'contratos';
/** Link de exportação. O cookie de sessão vai junto, então o navegador baixa o arquivo direto. */
export const urlExportar = (tipo: Tipo, formato: 'pdf' | 'csv', de?: string, ate?: string) =>
  `/api/relatorios/exportar/${tipo}?formato=${formato}${de ? `&de=${de}` : ''}${ate ? `&ate=${ate}` : ''}`;
