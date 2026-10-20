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
import {
  EventoHistoricoDto,
  PedidoRespostaDto,
} from './dto/pedido-resposta.dto';
import { PedidosService } from './pedidos.service';

@ApiTags('Pedidos')
@ApiBearerAuth()
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  /** Checkout: cria o pedido do usuário autenticado. Os preços vêm do banco. */
  @Post()
  criar(
    @Body() dto: CriarPedidoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<PedidoRespostaDto> {
    return this.pedidos.criar(dto, usuario);
  }

  /** "Meus pedidos", do mais recente para o mais antigo. */
  @Get('meus')
  meus(
    @Query() filtro: FiltroPedidosDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<PedidoRespostaDto[]> {
    return this.pedidos.listarDoCliente(usuario.id, filtro);
  }

  /** Painel da equipe (FUNCIONARIO/ADMIN). Inclui os dados do cliente. */
  @Papeis('ADMIN', 'FUNCIONARIO')
  @Get()
  listar(@Query() filtro: FiltroPedidosDto): Promise<PedidoRespostaDto[]> {
    return this.pedidos.listarTodos(filtro);
  }

  /** Tela de confirmação, pelo código público do pedido (dono ou equipe). */
  @Get(':codigo')
  detalhar(
    @Param('codigo', ParseUUIDPipe) codigo: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<PedidoRespostaDto> {
    return this.pedidos.detalhar(codigo, usuario);
  }

  /** Linha do tempo de status, com quem fez cada mudança (dono ou equipe). */
  @Get(':codigo/historico')
  historico(
    @Param('codigo', ParseUUIDPipe) codigo: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EventoHistoricoDto[]> {
    return this.pedidos.historico(codigo, usuario);
  }

  /** Equipe avança o status (CONFIRMADO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE). Transição inválida = 409. */
  @Papeis('ADMIN', 'FUNCIONARIO')
  @Patch(':codigo/status')
  atualizarStatus(
    @Param('codigo', ParseUUIDPipe) codigo: string,
    @Body() dto: AtualizarStatusDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<PedidoRespostaDto> {
    return this.pedidos.atualizarStatus(codigo, dto.status, usuario);
  }

  /** Cliente cancela o próprio pedido enquanto ainda está CONFIRMADO. */
  @HttpCode(200)
  @Post(':codigo/cancelar')
  cancelar(
    @Param('codigo', ParseUUIDPipe) codigo: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<PedidoRespostaDto> {
    return this.pedidos.atualizarStatus(codigo, 'CANCELADO', usuario);
  }
}
