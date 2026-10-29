export interface Indicador { rotulo: string; valor: string | number; detalhe: string }
export interface PainelDados { perfil: 'gerencial' | 'associado' | 'motorista'; indicadores: Indicador[] }
