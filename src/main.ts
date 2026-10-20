import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Atrás do proxy da hospedagem: usa o IP real do cliente no rate limit
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  configurarApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
