/** Códigos do SQL Server para violação de UNIQUE / PRIMARY KEY. */
const VIOLACAO_UNICA = new Set([2601, 2627]);

interface ErroComNumero {
  number?: number;
  driverError?: { number?: number };
}

export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const e = erro as ErroComNumero;
  const numero = e.driverError?.number ?? e.number;
  return numero !== undefined && VIOLACAO_UNICA.has(numero);
}
