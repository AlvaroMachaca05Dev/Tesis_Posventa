import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function main() {
  // El logo de la empresa viaja en base64 dentro del JSON: el tope por defecto (100 KB) no alcanza.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  app.enableCors({ origin: `http://localhost:${process.env.WEB_PORT ?? 5173}`, allowedHeaders: ['Authorization', 'Content-Type', 'X-Ver-Como'] });
  await app.listen(Number(process.env.API_PORT ?? 3000));
}
main();
