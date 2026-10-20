import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Papeis,
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../common/decorators';
import {
  AtualizarStatusDto,
  CriarPedidoDto,
  FiltroPedidosDto,
} from './dto/pedido.dto';
import { PedidosService } from './pedidos.service';

@ApiTags('Pedidos')
@ApiBearerAuth()
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  /** Checkout: cria o pedido do usuário autenticado. */
  @Post()
  criar(
    @Body() dto: CriarPedidoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.pedidos.criar(dto, usuario);
  }

  /** "Meus pedidos". */
  @Get('meus')
  meus(
    @Query() filtro: FiltroPedidosDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.pedidos.listarDoCliente(usuario.id, filtro);
  }

  /** Painel da equipe. */
  @Papeis('ADMIN', 'FUNCIONARIO')
  @Get()
  listar(@Query() filtro: FiltroPedidosDto) {
    return this.pedidos.listarTodos(filtro);
  }

  /** Tela de confirmação, pelo código público do pedido. */
  @Get(':codigo')
  detalhar(
    @Param('codigo', ParseUUIDPipe) codigo: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.pedidos.detalhar(codigo, usuario);
  }

  @Get(':codigo/historico')
  historico(
    @Param('codigo', ParseUUIDPipe) codigo: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.pedidos.historico(codigo, usuario);
  }

  /** Equipe avança o status (CONFIRMADO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE). */
  @Papeis('ADMIN', 'FUNCIONARIO')
  @Patch(':codigo/status')
  atualizarStatus(
    @Param('codigo', ParseUUIDPipe) codigo: string,
    @Body() dto: AtualizarStatusDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.pedidos.atualizarStatus(codigo, dto.status, usuario);
  }

  /** Cliente cancela o próprio pedido enquanto ainda está CONFIRMADO. */
  @HttpCode(200)
  @Post(':codigo/cancelar')
  cancelar(
    @Param('codigo', ParseUUIDPipe) codigo: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.pedidos.atualizarStatus(codigo, 'CANCELADO', usuario);
  }
}
