import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export type ResultadoEmail = { status: 'enviado' | 'sem_smtp' | 'falhou'; erro?: string };

@Injectable()
export class MailService {
  private readonly log = new Logger('Email');
  private readonly transporte = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

  /** Sem SMTP_URL o e-mail só é exibido no terminal (modo desenvolvimento). Falha de envio nunca derruba a requisição:
   *  o resultado volta para quem precisa registrar a entrega (notificações). */
  async enviar(para: string, assunto: string, titulo: string, paragrafos: string[], botao?: { texto: string; url: string }): Promise<ResultadoEmail> {
    const texto = [titulo, '', ...paragrafos, ...(botao ? ['', `${botao.texto}: ${botao.url}`] : []), '', 'Ridely'].join('\n');
    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#0f2442"><h2 style="color:#1f4fb8">${esc(titulo)}</h2>${paragrafos.map((p) => `<p>${esc(p)}</p>`).join('')}${botao ? `<p><a href="${esc(botao.url)}" style="display:inline-block;background:#1f5fd6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${esc(botao.texto)}</a></p><p style="font-size:12px;color:#62758f">Se o botão não abrir, copie este endereço no navegador:<br>${esc(botao.url)}</p>` : ''}<p style="font-size:12px;color:#62758f">Ridely · Associação de transporte escolar</p></div>`;
    if (!this.transporte) {
      this.log.warn(`SMTP_URL vazio: e-mail NÃO enviado, só exibido aqui.\nPara: ${para}\nAssunto: ${assunto}\n${texto}`);
      return { status: 'sem_smtp' };
    }
    try {
      await this.transporte.sendMail({ from: process.env.MAIL_FROM, to: para, subject: assunto, text: texto, html });
      this.log.log(`E-mail enviado para ${para}: ${assunto}`);
      return { status: 'enviado' };
    } catch (e) {
      this.log.error(`Falha ao enviar e-mail para ${para}: ${(e as Error).message}`);
      return { status: 'falhou', erro: (e as Error).message.slice(0, 300) };
    }
  }
}
