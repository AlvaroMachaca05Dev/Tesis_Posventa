import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function main() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: `http://localhost:${process.env.WEB_PORT ?? 5173}`, allowedHeaders: ['Authorization', 'Content-Type', 'X-Ver-Como'] });
  await app.listen(Number(process.env.API_PORT ?? 3000));
}
main();
