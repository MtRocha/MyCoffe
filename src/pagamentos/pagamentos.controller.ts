import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Publico } from '../common/decorators';
import { FormaPagamento } from './forma-pagamento.entity';

@ApiTags('Pagamento')
@Controller('formas-pagamento')
export class FormasPagamentoController {
  constructor(
    @InjectRepository(FormaPagamento)
    private readonly formas: Repository<FormaPagamento>,
  ) {}

  /** Formas de pagamento disponíveis no checkout. */
  @Publico()
  @Get()
  listar(): Promise<FormaPagamento[]> {
    return this.formas.find({ where: { ativo: true }, order: { id: 'ASC' } });
  }
}
