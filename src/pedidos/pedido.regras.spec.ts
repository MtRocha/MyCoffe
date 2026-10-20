import { BadRequestException } from '@nestjs/common';
import {
  agruparItens,
  calcularSubtotal,
  podeMudarStatus,
} from './pedido.regras';

describe('regras do pedido', () => {
  describe('podeMudarStatus', () => {
    it.each([
      ['CONFIRMADO', 'EM_PREPARO'],
      ['CONFIRMADO', 'CANCELADO'],
      ['EM_PREPARO', 'SAIU_PARA_ENTREGA'],
      ['EM_PREPARO', 'CANCELADO'],
      ['SAIU_PARA_ENTREGA', 'ENTREGUE'],
    ] as const)('permite %s -> %s', (de, para) => {
      expect(podeMudarStatus(de, para)).toBe(true);
    });

    it.each([
      ['CONFIRMADO', 'ENTREGUE'],
      ['EM_PREPARO', 'CONFIRMADO'],
      ['SAIU_PARA_ENTREGA', 'CANCELADO'],
      ['ENTREGUE', 'CANCELADO'],
      ['CANCELADO', 'EM_PREPARO'],
      ['CONFIRMADO', 'CONFIRMADO'],
    ] as const)('bloqueia %s -> %s', (de, para) => {
      expect(podeMudarStatus(de, para)).toBe(false);
    });
  });

  describe('agruparItens', () => {
    it('soma quantidades do mesmo café', () => {
      expect(
        agruparItens([
          { cafeId: 1, quantidade: 1 },
          { cafeId: 6, quantidade: 2 },
          { cafeId: 1, quantidade: 3 },
        ]),
      ).toEqual([
        { cafeId: 1, quantidade: 4 },
        { cafeId: 6, quantidade: 2 },
      ]);
    });

    it('rejeita mais de 99 unidades do mesmo café depois de somar', () => {
      expect(() =>
        agruparItens([
          { cafeId: 1, quantidade: 60 },
          { cafeId: 1, quantidade: 40 },
        ]),
      ).toThrow(BadRequestException);
    });
  });

  describe('calcularSubtotal', () => {
    it('reproduz o pedido de exemplo do script SQL (1 expresso + 2 lattes)', () => {
      expect(
        calcularSubtotal([
          { quantidade: 1, precoUnitario: 9.9 },
          { quantidade: 2, precoUnitario: 9.9 },
        ]),
      ).toBe(29.7);
    });

    it('não acumula erro de ponto flutuante', () => {
      // 0.1 * 3 em float daria 0.30000000000000004
      expect(calcularSubtotal([{ quantidade: 3, precoUnitario: 0.1 }])).toBe(
        0.3,
      );
    });
  });
});
