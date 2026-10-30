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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { TAMANHO_MAXIMO_IMAGEM } from '../armazenamento/armazenamento.service';
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

const campoImagem = () =>
  FileInterceptor('imagem', { limits: { fileSize: TAMANHO_MAXIMO_IMAGEM } });

const corpoMultipart = (obrigatorio: boolean) =>
  ApiBody({
    schema: {
      type: 'object',
      required: obrigatorio ? ['nome', 'descricao', 'preco', 'imagem'] : [],
      properties: {
        nome: { type: 'string', example: 'Cold Brew' },
        descricao: {
          type: 'string',
          example: 'Café extraído a frio por 12 horas',
        },
        preco: { type: 'number', example: 12.5 },
        imagem: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG ou WebP, até 5 MB',
        },
        tagIds: { type: 'array', items: { type: 'integer' }, example: [1, 2] },
        ...(obrigatorio
          ? {}
          : {
              ativo: {
                type: 'boolean',
                description: 'Reativa/desativa o café',
              },
            }),
      },
    },
  });

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
  @ApiConsumes('multipart/form-data', 'application/json')
  @corpoMultipart(true)
  @UseInterceptors(campoImagem())
  @Post()
  criar(
    @Body() dto: CriarCafeDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @UploadedFile() imagem?: Express.Multer.File,
  ) {
    return this.cafes.criar(dto, usuario.id, imagem);
  }

  @ApiBearerAuth()
  @Papeis('ADMIN')
  @ApiConsumes('multipart/form-data', 'application/json')
  @corpoMultipart(false)
  @UseInterceptors(campoImagem())
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarCafeDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @UploadedFile() imagem?: Express.Multer.File,
  ) {
    return this.cafes.atualizar(id, dto, usuario.id, imagem);
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
