export type TipoComunicado = 'aviso' | 'noticia' | 'rota' | 'cobranca';
export const TIPOS: [TipoComunicado, string][] = [['aviso', 'Aviso'], ['noticia', 'Notícia'], ['rota', 'Rota'], ['cobranca', 'Cobrança']];
/** O tesoureiro só publica cobrança e aviso (o back-end confere de novo). */
export const TIPOS_TESOUREIRO: TipoComunicado[] = ['aviso', 'cobranca'];

export interface Pagina<T> { itens: T[]; total: number; pagina: number; porPagina: number }

export interface Comunicado {
  id: number; tipo: TipoComunicado; tipoNome: string; titulo: string; mensagem: string;
  destinatario: { id: number; nome: string } | null;
  anexoNome: string | null;
  criadoEm: string; criadoPor: string | null; atualizadoEm: string | null;
  podeEditar: boolean;
  entregas: { total: number; lidas: number; emailsFalharam: number } | null;
}
export interface Destinatario { id: number; nome: string }

export interface Notificacao {
  id: number; tipo: string; titulo: string; mensagem: string; link: string | null; comunicadoId: number | null; lida: boolean; criadaEm: string;
}
export interface PaginaNotificacoes extends Pagina<Notificacao> { naoLidas: number }

export interface Rotina {
  id: string; nome: string; descricao: string;
  ultima: { origem: 'agendada' | 'manual'; iniciadaEm: string; concluidaEm: string | null; criadas: number; ignoradas: number; erro: string | null } | null;
}
export interface SituacaoRotinas {
  smtpConfigurado: boolean; agendamento: string;
  parametros: { lembreteVencimentoDias: number; cobrancaIntervaloDias: number; alertaRenovacaoDias: number };
  rotinas: Rotina[];
}
