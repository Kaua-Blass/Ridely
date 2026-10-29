export interface Inadimplente { id: number; nome: string; meses: number; referencias: string; maisAntigo: string; valor: number }
export interface Inadimplencia { geradoEm: string; total: number; associados: number; meses: number; itens: Inadimplente[] }
export interface MesCaixa { mes: string; receitas: number; despesas: number; saldo: number }
export interface FluxoCaixa { de: string; ate: string; saldoInicial: number; meses: MesCaixa[]; totais: { receitas: number; despesas: number; saldo: number; saldoFinal: number } }
export interface ContratoAVencer { id: number; associado: string; inicio: string; fim: string; valorPorDia: number; diasParaVencer: number }
export interface ContratosAVencer { geradoEm: string; prazoDias: number; itens: ContratoAVencer[] }
