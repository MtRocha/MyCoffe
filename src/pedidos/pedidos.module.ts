import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnderecoEntrega } from './endereco-entrega.entity';
import { ItemPedido } from './item-pedido.entity';
import { Pedido } from './pedido.entity';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido, ItemPedido, EnderecoEntrega])],
  controllers: [PedidosController],
  providers: [PedidosService],
})
export class PedidosModule {}
