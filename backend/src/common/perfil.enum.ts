export type Perfil = 'presidente' | 'vice-presidente' | 'tesoureiro' | 'conselheiro' | 'auxiliar' | 'associado' | 'motorista';
export const PERFIS: Perfil[] = ['presidente', 'vice-presidente', 'tesoureiro', 'conselheiro', 'auxiliar', 'associado', 'motorista'];
/** O banco usa underscore (vice_presidente); a API e o front usam hífen. */
export const perfilApi = (p: string) => p.replace('_', '-') as Perfil;
export const paraBanco = (p: string) => p.replace('-', '_');

const ROTULO_CARGO: Record<string, string> = {
  associado: 'Associado', presidente: 'Presidente', vice_presidente: 'Vice-presidente',
  tesoureiro: 'Tesoureiro', conselheiro: 'Conselheiro', auxiliar: 'Auxiliar',
};
export const rotuloCargo = (c: string | null) => (c ? ROTULO_CARGO[c] ?? c : null);
