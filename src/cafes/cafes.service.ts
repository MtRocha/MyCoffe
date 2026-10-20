import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ehViolacaoDeUnicidade } from '../common/erros-sql';
import { Cafe } from './cafe.entity';
import {
  AtualizarCafeDto,
  CriarCafeDto,
  CriarTagDto,
  FiltroCafesDto,
} from './dto/cafe.dto';
import { Tag } from './tag.entity';

/** Escapa curingas do LIKE do SQL Server (%, _ e [). */
export function escaparLike(texto: string): string {
  return texto.replace(/[%_[]/g, '[$&]');
}

@Injectable()
export class CafesService {
  constructor(
    @InjectRepository(Cafe) private readonly cafes: Repository<Cafe>,
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Catálogo da Home. Por padrão só cafés ativos. */
  listar(
    filtro: FiltroCafesDto = {},
    incluirInativos = false,
  ): Promise<Cafe[]> {
    const qb = this.cafes
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.tags', 't')
      .orderBy('c.nome', 'ASC')
      .addOrderBy('t.id', 'ASC');

    if (!incluirInativos) qb.andWhere('c.ativo = 1');
    if (filtro.busca) {
      qb.andWhere('c.nome LIKE :busca', {
        busca: `%${escaparLike(filtro.busca)}%`,
      });
    }
    if (filtro.tag) {
      // EXISTS para filtrar sem cortar as demais tags do café
      qb.andWhere(
        `EXISTS (SELECT 1 FROM dbo.cafe_tag ct
                 JOIN dbo.tag tg ON tg.id = ct.tag_id
                 WHERE ct.cafe_id = c.id AND tg.nome = :tag)`,
        { tag: filtro.tag },
      );
    }
    return qb.getMany();
  }

  async buscar(id: number, incluirInativo = false): Promise<Cafe> {
    const cafe = await this.cafes.findOne({
      where: incluirInativo ? { id } : { id, ativo: true },
      relations: { tags: true },
      order: { tags: { id: 'ASC' } },
    });
    if (!cafe) throw new NotFoundException('Café não encontrado');
    return cafe;
  }

  /** Mais vendidos (ignorando pedidos cancelados); empate por nome. */
  async recomendacoes(limite: number): Promise<Cafe[]> {
    const linhas: { id: number }[] = await this.cafes.query(
      `SELECT TOP (@0) c.id
         FROM dbo.cafe c
         LEFT JOIN (
              SELECT i.cafe_id, SUM(i.quantidade) AS vendidos
                FROM dbo.item_pedido i
                JOIN dbo.pedido p ON p.id = i.pedido_id
               WHERE p.status <> 'CANCELADO'
               GROUP BY i.cafe_id
         ) v ON v.cafe_id = c.id
        WHERE c.ativo = 1
        ORDER BY ISNULL(v.vendidos, 0) DESC, c.nome`,
      [limite],
    );
    const ids = linhas.map((l) => l.id);
    if (!ids.length) return [];
    const cafes = await this.cafes.find({
      where: { id: In(ids) },
      relations: { tags: true },
    });
    return ids.map((id) => cafes.find((c) => c.id === id)!);
  }

  async criar(dto: CriarCafeDto, usuarioId: number): Promise<Cafe> {
    const id = await this.salvarComTratamento(usuarioId, async (m) => {
      const { tagIds, ...dados } = dto;
      const cafe = m.create(Cafe, {
        ...dados,
        ativo: true,
        tags: await this.carregarTags(m, tagIds ?? []),
      });
      return (await m.save(cafe)).id;
    });
    return this.buscar(id, true);
  }

  async atualizar(
    id: number,
    dto: AtualizarCafeDto,
    usuarioId: number,
  ): Promise<Cafe> {
    await this.salvarComTratamento(usuarioId, async (m) => {
      const cafe = await m.findOne(Cafe, {
        where: { id },
        relations: { tags: true },
      });
      if (!cafe) throw new NotFoundException('Café não encontrado');
      const { tagIds, ...dados } = dto;
      Object.assign(cafe, dados);
      if (tagIds) cafe.tags = await this.carregarTags(m, tagIds);
      await m.save(cafe);
      return id;
    });
    return this.buscar(id, true);
  }

  /** Exclusão lógica: o café sai do catálogo mas segue nos pedidos antigos. */
  async desativar(id: number, usuarioId: number): Promise<void> {
    await this.buscar(id, true);
    await this.auditoria.executarComo(usuarioId, (m) =>
      m.update(Cafe, { id }, { ativo: false }),
    );
  }

  listarTags(): Promise<Tag[]> {
    return this.tags.find({ order: { nome: 'ASC' } });
  }

  async criarTag(dto: CriarTagDto, usuarioId: number): Promise<Tag> {
    try {
      return await this.auditoria.executarComo(usuarioId, (m) =>
        m.save(m.create(Tag, { nome: dto.nome })),
      );
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ConflictException('Já existe uma tag com esse nome');
      }
      throw erro;
    }
  }

  private async carregarTags(m: EntityManager, ids: number[]): Promise<Tag[]> {
    if (!ids.length) return [];
    const tags = await m.findBy(Tag, { id: In(ids) });
    const faltando = ids.filter((id) => !tags.some((t) => t.id === id));
    if (faltando.length) {
      throw new BadRequestException(
        `Tag(s) inexistente(s): ${faltando.join(', ')}`,
      );
    }
    return tags;
  }

  private async salvarComTratamento<T>(
    usuarioId: number,
    operacao: (m: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.auditoria.executarComo(usuarioId, operacao);
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ConflictException('Já existe um café com esse nome');
      }
      throw erro;
    }
  }
}
