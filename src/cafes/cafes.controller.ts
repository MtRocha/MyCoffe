import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Papeis,
  Publico,
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../common/decorators';
import { CafesService } from './cafes.service';
import {
  AtualizarCafeDto,
  CriarCafeDto,
  CriarTagDto,
  FiltroCafesDto,
  RecomendacoesDto,
} from './dto/cafe.dto';

@ApiTags('Catálogo')
@Controller('cafes')
export class CafesController {
  constructor(private readonly cafes: CafesService) {}

  /** Catálogo público (somente cafés ativos). */
  @Publico()
  @Get()
  listar(@Query() filtro: FiltroCafesDto) {
    return this.cafes.listar(filtro);
  }

  /** Recomendação de cafés: os mais vendidos. */
  @Publico()
  @Get('recomendacoes')
  recomendacoes(@Query() dto: RecomendacoesDto) {
    return this.cafes.recomendacoes(dto.limite);
  }

  /** Catálogo completo, incluindo inativos (equipe). */
  @ApiBearerAuth()
  @Papeis('ADMIN', 'FUNCIONARIO')
  @Get('gestao')
  listarGestao(@Query() filtro: FiltroCafesDto) {
    return this.cafes.listar(filtro, true);
  }

  @Publico()
  @Get(':id')
  buscar(@Param('id', ParseIntPipe) id: number) {
    return this.cafes.buscar(id);
  }

  @ApiBearerAuth()
  @Papeis('ADMIN')
  @Post()
  criar(
    @Body() dto: CriarCafeDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.cafes.criar(dto, usuario.id);
  }

  @ApiBearerAuth()
  @Papeis('ADMIN')
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarCafeDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.cafes.atualizar(id, dto, usuario.id);
  }

  /** Exclusão lógica (ativo = 0). */
  @ApiBearerAuth()
  @Papeis('ADMIN')
  @HttpCode(204)
  @Delete(':id')
  desativar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.cafes.desativar(id, usuario.id);
  }
}

@ApiTags('Catálogo')
@Controller('tags')
export class TagsController {
  constructor(private readonly cafes: CafesService) {}

  @Publico()
  @Get()
  listar() {
    return this.cafes.listarTags();
  }

  @ApiBearerAuth()
  @Papeis('ADMIN')
  @Post()
  criar(@Body() dto: CriarTagDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.cafes.criarTag(dto, usuario.id);
  }
}
