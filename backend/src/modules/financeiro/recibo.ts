import PDFDocument from 'pdfkit';
import type { Writable } from 'stream';
import { brl } from '../../common/caixa';

export interface DadosRecibo {
  numero: number; associado: string; referencia: string; vencimento: string; pagoEm: string; valor: number; multa: number; forma: string;
  conta: string; recebidoPor: string | null; observacao: string | null; estornadoEm: string | null; estornoMotivo: string | null;
}
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const FORMA: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', transferencia: 'Transferência bancária', cartao: 'Cartão' };

/** Recibo em PDF (A5). Recibo estornado sai marcado em vermelho. */
export function gerarRecibo(d: DadosRecibo, saida: Writable) {
  const doc = new PDFDocument({ size: 'A5', margin: 40, info: { Title: `Recibo ${String(d.numero).padStart(6, '0')}` } });
  doc.pipe(saida);
  const total = d.valor + d.multa;
  const ref = `${d.referencia.slice(5)}/${d.referencia.slice(0, 4)}`;

  doc.font('Helvetica-Bold').fontSize(15).fillColor('#1f4fb8').text(process.env.ASSOCIACAO_NOME ?? 'Associação de Transporte Escolar', { align: 'center' });
  doc.moveDown(0.6).font('Helvetica-Bold').fontSize(20).fillColor('#0f2442').text(`RECIBO Nº ${String(d.numero).padStart(6, '0')}`, { align: 'center' });
  doc.moveDown(0.3).font('Helvetica').fontSize(11).fillColor('#62758f').text(`Valor: ${brl(total)}`, { align: 'center' });
  if (d.estornadoEm) {
    doc.moveDown(0.6).font('Helvetica-Bold').fontSize(14).fillColor('#b3302f').text(`ESTORNADO em ${br(d.estornadoEm)}`, { align: 'center' });
    if (d.estornoMotivo) doc.font('Helvetica').fontSize(10).text(`Motivo: ${d.estornoMotivo}`, { align: 'center' });
  }
  doc.moveDown(1.2).font('Helvetica').fontSize(11).fillColor('#0f2442')
    .text(`Recebemos de ${d.associado} a importância de ${brl(total)}, referente à mensalidade de ${ref} (vencimento em ${br(d.vencimento)}).`, { align: 'justify' });

  doc.moveDown(1);
  const linha = (rotulo: string, valor: string, forte = false) => {
    doc.font('Helvetica').fontSize(10).fillColor('#62758f').text(rotulo, { continued: true });
    doc.font(forte ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f2442').text(`  ${valor}`);
  };
  linha('Valor da mensalidade:', brl(d.valor));
  linha('Multa por atraso:', d.multa > 0 ? brl(d.multa) : 'não houve');
  linha('Total recebido:', brl(total), true);
  doc.moveDown(0.6);
  linha('Pago em:', br(d.pagoEm));
  linha('Forma de pagamento:', FORMA[d.forma] ?? d.forma);
  linha('Conta de recebimento:', d.conta);
  if (d.observacao) linha('Observação:', d.observacao);
  doc.moveDown(1.6);
  linha('Recebido por:', d.recebidoPor ?? '-');
  linha('Emitido em:', new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  doc.end();
}
