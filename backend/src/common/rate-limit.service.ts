import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** Limite simples em memória (suficiente para um servidor só). */
@Injectable()
export class RateLimitService {
  private readonly tentativas = new Map<string, number[]>();
  verificar(chave: string, maximo: number, janelaMs: number) {
    const agora = Date.now();
    const recentes = (this.tentativas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= maximo) throw new HttpException('Muitas tentativas. Aguarde alguns minutos.', HttpStatus.TOO_MANY_REQUESTS);
    recentes.push(agora);
    this.tentativas.set(chave, recentes);
  }
}
