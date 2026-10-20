import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  Publico,
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../common/decorators';
import {
  paraUsuarioResposta,
  UsuariosService,
} from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';
import { UsuarioRespostaDto } from '../usuarios/dto/usuario-resposta.dto';
import { CadastroDto, LoginDto, RespostaAutenticacaoDto } from './dto/auth.dto';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly usuarios: UsuariosService,
  ) {}

  /** Cria uma conta de cliente e já devolve o token. */
  @Publico()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('cadastro')
  cadastrar(@Body() dto: CadastroDto): Promise<RespostaAutenticacaoDto> {
    return this.auth.cadastrar(dto);
  }

  @Publico()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<RespostaAutenticacaoDto> {
    return this.auth.login(dto);
  }

  /** Dados do usuário dono do token. */
  @ApiBearerAuth()
  @Get('me')
  async me(
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<UsuarioRespostaDto> {
    return paraUsuarioResposta(await this.usuarios.buscarPorId(usuario.id));
  }
}
