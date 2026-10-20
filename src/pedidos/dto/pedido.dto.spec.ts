import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CriarPedidoDto } from './pedido.dto';

const valido = {
  formaPagamentoId: 1,
  itens: [{ cafeId: 1, quantidade: 2 }],
  endereco: {
    cep: '09390-120',
    logradouro: 'Av. Antônia Rosa Fioravanti',
    numero: '804',
    bairro: 'Centro',
    cidade: 'Mauá',
    uf: 'sp',
  },
};

async function errosDe(corpo: unknown) {
  const dto = plainToInstance(CriarPedidoDto, corpo);
  return { dto, erros: await validate(dto) };
}

describe('CriarPedidoDto', () => {
  it('aceita pedido válido e normaliza CEP e UF', async () => {
    const { dto, erros } = await errosDe(valido);
    expect(erros).toHaveLength(0);
    expect(dto.endereco.cep).toBe('09390120');
    expect(dto.endereco.uf).toBe('SP');
  });

  it.each([
    ['sem itens', { ...valido, itens: [] }],
    ['quantidade zero', { ...valido, itens: [{ cafeId: 1, quantidade: 0 }] }],
    ['CEP curto', { ...valido, endereco: { ...valido.endereco, cep: '123' } }],
    [
      'UF inexistente',
      { ...valido, endereco: { ...valido.endereco, uf: 'XX' } },
    ],
    ['sem endereço', { ...valido, endereco: undefined }],
  ])('rejeita %s', async (_, corpo) => {
    const { erros } = await errosDe(corpo);
    expect(erros.length).toBeGreaterThan(0);
  });
});
