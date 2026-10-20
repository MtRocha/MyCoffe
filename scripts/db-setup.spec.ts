import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dividirEmLotes } from './db-setup';

describe('dividirEmLotes', () => {
  it('separa nos GO, ignorando maiúsculas e espaços', () => {
    expect(
      dividirEmLotes('SELECT 1;\nGO\nSELECT 2;\n  go  \nSELECT 3'),
    ).toEqual(['SELECT 1;', 'SELECT 2;', 'SELECT 3']);
  });

  it('não corta palavras que contêm GO', () => {
    expect(dividirEmLotes("SELECT 'GOIÂNIA' AS GO_TO")).toHaveLength(1);
  });

  it('lê o script do projeto em lotes com as triggers isoladas', () => {
    const lotes = dividirEmLotes(
      readFileSync(
        join(__dirname, '..', 'database', 'mycoffee_sqlserver.sql'),
        'utf8',
      ),
    );
    const triggers = lotes.filter((l) => /CREATE OR ALTER TRIGGER/i.test(l));
    expect(triggers).toHaveLength(8);
    // CREATE TRIGGER precisa ser o primeiro comando do lote (comentários podem vir antes)
    for (const t of triggers) {
      const semComentarios = t
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*--.*$/gm, '')
        .trim();
      expect(semComentarios).toMatch(/^CREATE OR ALTER TRIGGER/i);
    }
  });
});
