import 'dotenv/config';
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validarConfiguracao } from './common/config';
import { configurarApp } from './configurar-app';

async function main() {
  const erros = validarConfiguracao(process.env);
  if (erros.length) {
    for (const e of erros) console.error(`Configuração inválida: ${e}`);
    process.exit(1);
  }
  // HTTPS direto (sem proxy): informe o certificado e a chave em arquivos PEM.
  const tls = process.env.TLS_CERT_FILE && process.env.TLS_KEY_FILE
    ? { httpsOptions: { cert: readFileSync(process.env.TLS_CERT_FILE), key: readFileSync(process.env.TLS_KEY_FILE) } }
    : {};
  const app = await NestFactory.create(AppModule, tls);
  configurarApp(app);
  await app.listen(Number(process.env.PORT ?? 3000));
}
main();
