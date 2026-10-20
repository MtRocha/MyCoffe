import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, Repository } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Cafe } from '../cafes/cafe.entity';
import { ehEquipe, UsuarioAutenticado } from '../common/decorators';
import { FormaPagamento } from '../pagamentos/forma-pagamento.entity';
import { Papel } from '../usuarios/usuario.entity';
import { CriarPedidoDto, FiltroPedidosDto } from './dto/pedido.dto';
import {
  EventoHistoricoDto,
  PedidoRespostaDto,
} from './dto/pedido-resposta.dto';
import { EnderecoEntrega } from './endereco-entrega.entity';
import { ItemPedido } from './item-pedido.entity';
import { Pedido, StatusPedido } from './pedido.entity';
import {
  agruparItens,
  calcularSubtotal,
  podeMudarStatus,
} from './pedido.regras';

// Classes de resposta ficam em dto/ para o plugin do Swagger documentá-las
export type PedidoResposta = PedidoRespostaDto;
export type EventoHistorico = EventoHistoricoDto;

export function paraPedidoResposta(
  p: Pedido,
  incluirCliente: boolean,
): PedidoResposta {
  const resposta: PedidoResposta = {
    codigo: p.codigo,
    status: p.status,
    criadoEm: p.criadoEm,
    subtotal: p.subtotal,
    taxaEntrega: p.taxaEntrega,
    total: p.total,
    previsaoMin: p.previsaoMin,
    previsaoMax: p.previsaoMax,
    formaPagamento: {
      id: p.formaPagamento.id,
      codigo: p.formaPagamento.codigo,
      descricao: p.formaPagamento.descricao,
    },
    itens: (p.itens ?? []).map((i) => ({
      cafeId: i.cafeId,
      nome: i.cafe.nome,
      imagemUrl: i.cafe.imagemUrl,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      subtotal: i.subtotal,
    })),
    endereco: p.endereco
      ? {
          cep: p.endereco.cep,
          logradouro: p.endereco.logradouro,
          numero: p.endereco.numero,
          complemento: p.endereco.complemento,
          bairro: p.endereco.bairro,
          cidade: p.endereco.cidade,
          uf: p.endereco.uf,
        }
      : null,
  };
  if (incluirCliente && p.usuario) {
    resposta.cliente = {
      id: p.usuario.id,
      nome: p.usuario.nome,
      email: p.usuario.email,
      telefone: p.usuario.telefone,
    };
  }
  return resposta;
}

@Injectable()
export class PedidosService {
  private readonly taxaEntrega: number;
  private readonly previsaoMin: number;
  private readonly previsaoMax: number;

  constructor(
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    private readonly auditoria: AuditoriaService,
    config: ConfigService,
  ) {
    this.taxaEntrega = Number(config.get('TAXA_ENTREGA', 3.5));
    this.previsaoMin = Number(config.get('PREVISAO_MIN_MINUTOS', 20));
    this.previsaoMax = Number(config.get('PREVISAO_MAX_MINUTOS', 30));
  }

  /**
   * Checkout. Os preços vêm sempre do banco (nunca do app), e pedido,
   * itens e endereço são gravados na mesma transação.
   */
  async criar(
    dto: CriarPedidoDto,
    usuario: UsuarioAutenticado,
  ): Promise<PedidoResposta> {
    const itens = agruparItens(dto.itens);
    const codigo = randomUUID();

    await this.auditoria.executarComo(usuario.id, async (m) => {
      const forma = await m.findOneBy(FormaPagamento, {
        id: dto.formaPagamentoId,
        ativo: true,
      });
      if (!forma) throw new BadRequestException('Forma de pagamento inválida');

      const cafes = await m.findBy(Cafe, {
        id: In(itens.map((i) => i.cafeId)),
        ativo: true,
      });
      const indisponiveis = itens
        .filter((i) => !cafes.some((c) => c.id === i.cafeId))
        .map((i) => i.cafeId);
      if (indisponiveis.length) {
        throw new BadRequestException(
          `Café(s) indisponível(is): ${indisponiveis.join(', ')}`,
        );
      }

      const itensComPreco = itens.map((i) => ({
        ...i,
        precoUnitario: cafes.find((c) => c.id === i.cafeId)!.preco,
      }));

      const resultado = await m.insert(Pedido, {
        codigo,
        usuarioId: usuario.id,
        formaPagamentoId: forma.id,
        status: 'CONFIRMADO',
        subtotal: calcularSubtotal(itensComPreco),
        taxaEntrega: this.taxaEntrega,
        previsaoMin: this.previsaoMin,
        previsaoMax: this.previsaoMax,
      });
      const pedidoId = String((resultado.identifiers[0] as { id: string }).id);

      await m.insert(
        ItemPedido,
        itensComPreco.map((i) => ({ pedidoId, ...i })),
      );
      await m.insert(EnderecoEntrega, {
        pedidoId,
        ...dto.endereco,
        complemento: dto.endereco.complemento || null,
      });
    });

    return paraPedidoResposta(await this.carregar(codigo), false);
  }

  async detalhar(
    codigo: string,
    usuario: UsuarioAutenticado,
  ): Promise<PedidoResposta> {
    const pedido = await this.carregarComAcesso(codigo, usuario);
    return paraPedidoResposta(pedido, ehEquipe(usuario));
  }

  async listarDoCliente(
    usuarioId: number,
    filtro: FiltroPedidosDto,
  ): Promise<PedidoResposta[]> {
    return this.listar(filtro, usuarioId);
  }

  /** Painel da equipe: todos os pedidos, filtrando por status. */
  async listarTodos(filtro: FiltroPedidosDto): Promise<PedidoResposta[]> {
    return this.listar(filtro);
  }

  async atualizarStatus(
    codigo: string,
    novo: StatusPedido,
    ator: UsuarioAutenticado,
  ): Promise<PedidoResposta> {
    await this.auditoria.executarComo(ator.id, async (m) => {
      // UPDLOCK evita duas pessoas mudando o mesmo pedido ao mesmo tempo
      const pedido = await m.findOne(Pedido, {
        where: { codigo },
        lock: { mode: 'pessimistic_write' },
      });
      if (!pedido) throw new NotFoundException('Pedido não encontrado');
      if (!ehEquipe(ator)) {
        if (pedido.usuarioId !== ator.id) {
          throw new NotFoundException('Pedido não encontrado');
        }
        if (novo !== 'CANCELADO' || pedido.status !== 'CONFIRMADO') {
          throw new ForbiddenException(
            'O cliente só pode cancelar pedidos ainda não iniciados',
          );
        }
      }
      if (!podeMudarStatus(pedido.status, novo)) {
        throw new ConflictException(
          `Não é possível mudar de ${pedido.status} para ${novo}`,
        );
      }
      await m.update(Pedido, { id: pedido.id }, { status: novo });
    });
    return this.detalhar(codigo, ator);
  }

  /** Histórico de status a partir do log das triggers de auditoria. */
  async historico(
    codigo: string,
    usuario: UsuarioAutenticado,
  ): Promise<EventoHistorico[]> {
    const pedido = await this.carregarComAcesso(codigo, usuario);
    const linhas: {
      dataHora: Date;
      de: StatusPedido | null;
      para: StatusPedido;
      usuarioId: number | null;
      usuarioNome: string | null;
      usuarioPapel: Papel | null;
    }[] = await this.pedidos.query(
      `SELECT l.data_hora AS dataHora,
              JSON_VALUE(l.dados_antigos, '$.status') AS de,
              JSON_VALUE(l.dados_novos,   '$.status') AS para,
              u.id AS usuarioId, u.nome AS usuarioNome, u.papel AS usuarioPapel
         FROM auditoria.log_alteracao l
         LEFT JOIN dbo.usuario u ON u.id = l.usuario_id
        WHERE l.tabela = 'pedido' AND l.chave = @0
          AND ISNULL(JSON_VALUE(l.dados_antigos, '$.status'), '')
              <> ISNULL(JSON_VALUE(l.dados_novos, '$.status'), '')
        ORDER BY l.data_hora, l.id`,
      [pedido.id],
    );

    return [
      {
        status: 'CONFIRMADO',
        statusAnterior: null,
        dataHora: pedido.criadoEm,
        alteradoPor: {
          id: pedido.usuario.id,
          nome: pedido.usuario.nome,
          papel: pedido.usuario.papel,
        },
      },
      ...linhas.map((l) => ({
        status: l.para,
        statusAnterior: l.de,
        dataHora: l.dataHora,
        alteradoPor:
          l.usuarioId === null
            ? null
            : { id: l.usuarioId, nome: l.usuarioNome!, papel: l.usuarioPapel! },
      })),
    ];
  }

  private async listar(
    filtro: FiltroPedidosDto,
    usuarioId?: number,
  ): Promise<PedidoResposta[]> {
    const pedidos = await this.pedidos.find({
      where: {
        ...(usuarioId !== undefined && { usuarioId }),
        ...(filtro.status && { status: filtro.status }),
      },
      relations: {
        itens: { cafe: true },
        endereco: true,
        formaPagamento: true,
        usuario: true,
      },
      order: { criadoEm: 'DESC', id: 'DESC' },
      skip: (filtro.pagina - 1) * filtro.limite,
      take: filtro.limite,
    });
    return pedidos.map((p) => paraPedidoResposta(p, usuarioId === undefined));
  }

  private async carregar(codigo: string): Promise<Pedido> {
    const pedido = await this.pedidos.findOne({
      where: { codigo },
      relations: {
        itens: { cafe: true },
        endereco: true,
        formaPagamento: true,
        usuario: true,
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    return pedido;
  }

  /** Cliente só enxerga os próprios pedidos (404 para não revelar que existe). */
  private async carregarComAcesso(
    codigo: string,
    usuario: UsuarioAutenticado,
  ): Promise<Pedido> {
    const pedido = await this.carregar(codigo);
    if (!ehEquipe(usuario) && pedido.usuarioId !== usuario.id) {
      throw new NotFoundException('Pedido não encontrado');
    }
    return pedido;
  }
}
