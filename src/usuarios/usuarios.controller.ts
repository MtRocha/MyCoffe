import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Papeis,
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../common/decorators';
import {
  AtualizarUsuarioDto,
  FiltroUsuariosDto,
} from './dto/atualizar-usuario.dto';
import { UsuarioRespostaDto } from './dto/usuario-resposta.dto';
import { paraUsuarioResposta, UsuariosService } from './usuarios.service';

@ApiTags('Usuários (admin)')
@ApiBearerAuth()
@Papeis('ADMIN')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  async listar(
    @Query() filtro: FiltroUsuariosDto,
  ): Promise<UsuarioRespostaDto[]> {
    const lista = await this.usuarios.listar(filtro.papel);
    return lista.map(paraUsuarioResposta);
  }

  @Get(':id')
  async buscar(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UsuarioRespostaDto> {
    return paraUsuarioResposta(await this.usuarios.buscarPorId(id));
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarUsuarioDto,
    @UsuarioAtual() ator: UsuarioAutenticado,
  ): Promise<UsuarioRespostaDto> {
    return paraUsuarioResposta(await this.usuarios.atualizar(id, dto, ator));
  }
}
