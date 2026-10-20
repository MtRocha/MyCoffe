import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

const DESCRICAO = `API do aplicativo mobile de cafeteria MyCoffee: catálogo, autenticação, carrinho/checkout e pedidos.

**Autenticação:** faça \`POST /auth/login\` (ou \`/auth/cadastro\`), copie o \`accessToken\` e clique em **Authorize**.
As rotas sem cadeado são públicas.

**Papéis:** CLIENTE (padrão do cadastro), FUNCIONARIO e ADMIN. "Equipe" = FUNCIONARIO ou ADMIN.

**Fluxo do pedido:** CONFIRMADO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE.
O cliente pode cancelar enquanto o pedido está CONFIRMADO; a equipe, até EM_PREPARO.

**Erros:** respostas no formato \`{ "statusCode", "message", "error" }\`. 400 = dados inválidos,
401 = sem token ou token inválido, 403 = papel sem permissão, 404 = não encontrado, 409 = conflito.`;

/** Documento OpenAPI (usado pelo /docs e pelo script npm run openapi). */
export function criarDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('MyCoffee API')
    .setDescription(DESCRICAO)
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Autenticação', 'Cadastro, login e dados do usuário logado')
    .addTag('Catálogo', 'Cafés, tags e recomendações')
    .addTag('Pagamento', 'Formas de pagamento do checkout')
    .addTag('Pedidos', 'Checkout, acompanhamento e painel da equipe')
    .addTag('Usuários (admin)', 'Gestão de papéis e acesso')
    .addTag('Health', 'Monitoramento');
  for (const url of process.env.OPENAPI_SERVERS?.split(',') ?? []) {
    if (url.trim()) builder.addServer(url.trim());
  }
  return SwaggerModule.createDocument(app, builder.build());
}

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
  SwaggerModule.setup('docs', app, () => criarDocumentoOpenApi(app), {
    customSiteTitle: 'MyCoffee API',
    swaggerOptions: { persistAuthorization: true },
  });
}
