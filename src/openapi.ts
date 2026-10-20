/**
 * Gera docs/openapi.json e docs/openapi.yaml sem conectar no banco.
 *   npm run openapi
 * Roda a partir do dist/ porque o plugin do Swagger (nest-cli.json)
 * só documenta os DTOs durante o "nest build".
 */
// Precisa ser o primeiro import: define o ambiente antes do AppModule carregar
import './openapi-ambiente';
import { NestFactory } from '@nestjs/core';
import { dump } from 'js-yaml';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { criarDocumentoOpenApi } from './app.setup';

async function gerar() {
  // preview: monta o grafo de módulos sem instanciar providers (sem banco)
  const app = await NestFactory.create(AppModule, {
    preview: true,
    abortOnError: false,
    logger: false,
  });
  const documento = criarDocumentoOpenApi(app);

  const pasta = join(__dirname, '..', 'docs');
  mkdirSync(pasta, { recursive: true });
  writeFileSync(
    join(pasta, 'openapi.json'),
    JSON.stringify(documento, null, 2) + '\n',
  );
  writeFileSync(
    join(pasta, 'openapi.yaml'),
    dump(documento, { noRefs: true, lineWidth: -1 }),
  );
  console.log(
    `OpenAPI gerado em docs/ (${Object.keys(documento.paths).length} rotas)`,
  );
  await app.close();
}

void gerar();
