import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

/** Configuração compartilhada entre main.ts e os testes e2e. */
export function configurarApp(app: INestApplication): void {
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const documento = new DocumentBuilder()
    .setTitle('MyCoffee API')
    .setDescription(
      'API do aplicativo mobile de cafeteria MyCoffee: catálogo, autenticação, carrinho/checkout e pedidos.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, documento),
  );
}
