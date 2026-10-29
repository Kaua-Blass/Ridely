import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Configuração comum da API: usada pelo main.ts e pelos testes de integração, para os dois subirem iguais. */
export function configurarApp(app: INestApplication) {
  // atrás de um proxy reverso (nginx, Caddy...), o IP real do cliente vem no cabeçalho X-Forwarded-For.
  // TRUST_PROXY=1 confia no primeiro proxy; sem a variável, o IP usado é o da própria conexão.
  if (process.env.TRUST_PROXY) {
    const v = process.env.TRUST_PROXY;
    app.getHttpAdapter().getInstance().set('trust proxy', /^\d+$/.test(v) ? Number(v) : v);
  }
  // cabeçalhos de segurança (sem X-Powered-By, com nosniff, CSP restritiva para JSON/PDF e HSTS em produção)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
