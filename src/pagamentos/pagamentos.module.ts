import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormaPagamento } from './forma-pagamento.entity';
import { FormasPagamentoController } from './pagamentos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FormaPagamento])],
  controllers: [FormasPagamentoController],
})
export class PagamentosModule {}
