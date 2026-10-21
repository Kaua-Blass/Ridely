import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function main() {
  for (const v of ['DATABASE_URL', 'JWT_SECRET']) {
    if (!process.env[v]) throw new Error(`Defina ${v} no arquivo backend/.env (veja .env.example)`);
  }
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3000);
}
main();
