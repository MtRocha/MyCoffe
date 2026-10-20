import { BadRequestException } from '@nestjs/common';
import { StatusPedido } from './pedido.entity';

/** Fluxo permitido de status do pedido. */
export const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  CONFIRMADO: ['EM_PREPARO', 'CANCELADO'],
  EM_PREPARO: ['SAIU_PARA_ENTREGA', 'CANCELADO'],
  SAIU_PARA_ENTREGA: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
};

export function podeMudarStatus(de: StatusPedido, para: StatusPedido) {
  return TRANSICOES[de].includes(para);
}

export const QUANTIDADE_MAXIMA_POR_ITEM = 99;

export interface ItemSolicitado {
  cafeId: number;
  quantidade: number;
}

/** Soma itens repetidos do mesmo café (a PK de item_pedido é pedido + café). */
export function agruparItens(itens: ItemSolicitado[]): ItemSolicitado[] {
  const porCafe = new Map<number, number>();
  for (const { cafeId, quantidade } of itens) {
    porCafe.set(cafeId, (porCafe.get(cafeId) ?? 0) + quantidade);
  }
  const agrupados = [...porCafe].map(([cafeId, quantidade]) => ({
    cafeId,
    quantidade,
  }));
  const excedente = agrupados.find(
    (i) => i.quantidade > QUANTIDADE_MAXIMA_POR_ITEM,
  );
  if (excedente) {
    throw new BadRequestException(
      `Quantidade máxima por café é ${QUANTIDADE_MAXIMA_POR_ITEM} (café ${excedente.cafeId})`,
    );
  }
  return agrupados;
}

/** Soma em centavos para não acumular erro de ponto flutuante. */
export function calcularSubtotal(
  itens: { quantidade: number; precoUnitario: number }[],
): number {
  const centavos = itens.reduce(
    (soma, i) => soma + Math.round(i.precoUnitario * 100) * i.quantidade,
    0,
  );
  return centavos / 100;
}
