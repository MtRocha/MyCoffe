import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const OBRIGATORIAS = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];

/** Falha na inicialização se faltar alguma variável essencial. */
export function validarAmbiente(env: Record<string, unknown>) {
  const faltando = OBRIGATORIAS.filter((k) => !env[k]);
  if (faltando.length) {
    throw new Error(`Variáveis de ambiente ausentes: ${faltando.join(', ')}`);
  }
  if (String(env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
  }
  return env;
}

const verdadeiro = (valor: string | undefined, padrao: boolean) =>
  valor === undefined ? padrao : valor.toLowerCase() === 'true';

/** Configuração de conexão compartilhada pela API e pelos scripts. */
export function configuracaoBanco(env: NodeJS.ProcessEnv = process.env) {
  return {
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 1433),
    username: env.DB_USER ?? '',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'MyCoffee',
    // Azure SQL exige encrypt=true; SQL Server local costuma usar certificado próprio
    encrypt: verdadeiro(env.DB_ENCRYPT, false),
    trustServerCertificate: verdadeiro(env.DB_TRUST_SERVER_CERTIFICATE, true),
  };
}

export function opcoesTypeOrm(): TypeOrmModuleOptions {
  const db = configuracaoBanco();
  return {
    type: 'mssql',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    autoLoadEntities: true,
    // O schema vem do script SQL (database/), nunca do TypeORM
    synchronize: false,
    options: {
      encrypt: db.encrypt,
      trustServerCertificate: db.trustServerCertificate,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  };
}
