import { prepararBanco } from '../scripts/db-setup';

/** Recria o banco MyCoffee_Test do zero antes da suíte e2e. */
export default async function () {
  process.env.NODE_ENV = 'test';
  await prepararBanco({ recriar: true });
}
