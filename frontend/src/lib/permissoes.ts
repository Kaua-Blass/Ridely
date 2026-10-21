export type Perfil = 'presidente' | 'vice-presidente' | 'tesoureiro' | 'conselheiro' | 'auxiliar' | 'associado' | 'motorista';

const todas = ['painel', 'associados', 'veiculos-rotas', 'financeiro', 'controles-financeiros', 'contratos',
  'transporte', 'comunicacao', 'relatorios', 'administracao', 'perfil'];

/** Telas visíveis por perfil. O back-end repete essas regras: esconder botão não é segurança. */
export const ACESSO: Record<Perfil, string[]> = {
  presidente: todas,
  'vice-presidente': todas.filter((t) => t !== 'administracao'),
  tesoureiro: ['painel', 'associados', 'veiculos-rotas', 'financeiro', 'controles-financeiros', 'contratos', 'comunicacao', 'relatorios', 'perfil'],
  conselheiro: ['painel', 'associados', 'veiculos-rotas', 'financeiro', 'controles-financeiros', 'contratos', 'comunicacao', 'relatorios', 'perfil'],
  auxiliar: ['painel', 'associados', 'veiculos-rotas', 'transporte', 'comunicacao', 'perfil'],
  associado: ['painel', 'financeiro', 'contratos', 'transporte', 'comunicacao', 'perfil'],
  motorista: ['painel', 'transporte', 'veiculos-rotas', 'perfil'],
};

/** Quem pode escrever em cada tela (os demais só consultam). */
export const ESCRITA: Record<string, Perfil[]> = {
  associados: ['presidente', 'vice-presidente'],
  'veiculos-rotas': ['presidente', 'vice-presidente'],
  financeiro: ['presidente', 'tesoureiro'],
  'controles-financeiros': ['presidente', 'tesoureiro'],
  contratos: ['presidente', 'vice-presidente'],
  comunicacao: ['presidente', 'vice-presidente', 'tesoureiro'],
  administracao: ['presidente'],
};

export const podeEscrever = (tela: string, perfil: Perfil) => ESCRITA[tela]?.includes(perfil) ?? false;
export const CARGO_PARA_PERFIL: Record<string, Perfil> = {
  Associado: 'associado', Presidente: 'presidente', 'Vice-presidente': 'vice-presidente',
  Tesoureiro: 'tesoureiro', Conselheiro: 'conselheiro', Auxiliar: 'auxiliar',
};

export const PERFIS: Perfil[] = ['presidente', 'vice-presidente', 'tesoureiro', 'conselheiro', 'auxiliar', 'associado', 'motorista'];
