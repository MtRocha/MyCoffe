import { ValueTransformer } from 'typeorm';

/** DECIMAL do SQL Server -> number no JavaScript. */
export const decimalParaNumero: ValueTransformer = {
  to: (valor?: number | null) => valor,
  from: (valor?: string | number | null) =>
    valor === null || valor === undefined ? valor : Number(valor),
};

/** UNIQUEIDENTIFIER vem em maiúsculas do SQL Server; padronizamos em minúsculas. */
export const guidMinusculo: ValueTransformer = {
  to: (valor?: string | null) => valor,
  from: (valor?: string | null) => valor?.toLowerCase(),
};
