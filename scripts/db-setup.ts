/**
 * Cria o banco MyCoffee a partir de database/mycoffee_sqlserver.sql
 * e troca os hashes de senha "marcadores" dos usuários de exemplo.
 *
 *   npm run db:setup              -> cria se ainda não existir
 *   npm run db:setup -- --recriar -> apaga e recria (só bancos *_Test)
 *
 * Variáveis: as mesmas da API (.env), mais SEED_SENHA_PADRAO.
 * DB_CRIAR_BANCO=false pula o CREATE DATABASE (ex.: Azure SQL, onde
 * o banco é criado pelo portal).
 */
import { config as carregarEnv } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as sql from 'mssql';
import { configuracaoBanco } from '../src/config/ambiente';

carregarEnv({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  quiet: true,
});

const ARQUIVO_SQL = join(__dirname, '..', 'database', 'mycoffee_sqlserver.sql');

function conectar(database: string) {
  const db = configuracaoBanco();
  return new sql.ConnectionPool({
    server: db.host,
    port: db.port,
    user: db.username,
    password: db.password,
    database,
    options: {
      encrypt: db.encrypt,
      trustServerCertificate: db.trustServerCertificate,
    },
  }).connect();
}

/** Divide o script nos separadores GO (como o sqlcmd/SSMS fazem). */
export function dividirEmLotes(script: string): string[] {
  return script
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((lote) => lote.trim())
    .filter(Boolean);
}

/** CREATE DATABASE e USE ficam por conta deste script, não do arquivo. */
function ehLoteDoBanco(lote: string): boolean {
  const semComentarios = lote
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim();
  return /^(IF\s+DB_ID|USE\s)/i.test(semComentarios);
}

export async function prepararBanco(opcoes: { recriar?: boolean } = {}) {
  const { database } = configuracaoBanco();
  if (!/^\w+$/.test(database))
    throw new Error(`Nome de banco inválido: ${database}`);

  if (process.env.DB_CRIAR_BANCO !== 'false') {
    const master = await conectar('master');
    try {
      if (opcoes.recriar) {
        if (!database.endsWith('_Test')) {
          throw new Error(
            '--recriar só é permitido em bancos terminados em _Test',
          );
        }
        await master.request().batch(`
          IF DB_ID(N'${database}') IS NOT NULL
          BEGIN
            ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
            DROP DATABASE [${database}];
          END`);
      }
      await master
        .request()
        .batch(
          `IF DB_ID(N'${database}') IS NULL CREATE DATABASE [${database}];`,
        );
    } finally {
      await master.close();
    }
  }

  const pool = await conectar(database);
  try {
    const existe = await pool
      .request()
      .query<{ ok: number }>(
        `SELECT CASE WHEN OBJECT_ID('dbo.usuario') IS NULL THEN 0 ELSE 1 END AS ok`,
      );
    if (existe.recordset[0].ok) {
      console.log(`Schema já existe em ${database}; pulando criação.`);
    } else {
      const lotes = dividirEmLotes(readFileSync(ARQUIVO_SQL, 'utf8')).filter(
        (l) => !ehLoteDoBanco(l),
      );
      for (const lote of lotes) await pool.request().batch(lote);
      console.log(`Schema criado em ${database} (${lotes.length} lotes).`);
    }

    const senha = process.env.SEED_SENHA_PADRAO;
    if (senha) {
      const hash = await bcrypt.hash(senha, 12);
      const r = await pool
        .request()
        .input('hash', sql.VarChar(255), hash)
        .query(
          `UPDATE dbo.usuario SET senha_hash = @hash WHERE senha_hash LIKE '%SUBSTITUIR%'`,
        );
      if (r.rowsAffected[0]) {
        console.log(
          `Senha definida para ${r.rowsAffected[0]} usuário(s) de exemplo.`,
        );
      }
    } else {
      console.warn(
        'SEED_SENHA_PADRAO não definida: usuários de exemplo continuam sem login.',
      );
    }
  } finally {
    await pool.close();
  }
}

if (require.main === module) {
  prepararBanco({ recriar: process.argv.includes('--recriar') }).catch(
    (erro: unknown) => {
      console.error(erro);
      process.exit(1);
    },
  );
}
