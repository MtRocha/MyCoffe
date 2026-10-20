import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Usuario } from '../usuarios/usuario.entity';
import {
  paraUsuarioResposta,
  UsuarioResposta,
  UsuariosService,
} from '../usuarios/usuarios.service';
import { CadastroDto, LoginDto } from './dto/auth.dto';

export const CUSTO_BCRYPT = 12;

export interface PayloadJwt {
  sub: number;
  papel: Usuario['papel'];
}

export interface RespostaAutenticacao {
  accessToken: string;
  usuario: UsuarioResposta;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly jwt: JwtService,
  ) {}

  async cadastrar(dto: CadastroDto): Promise<RespostaAutenticacao> {
    const senhaHash = await bcrypt.hash(dto.senha, CUSTO_BCRYPT);
    const usuario = await this.usuarios.criarCliente({
      nome: dto.nome,
      email: dto.email,
      telefone: dto.telefone,
      senhaHash,
    });
    return this.gerarResposta(usuario);
  }

  async login(dto: LoginDto): Promise<RespostaAutenticacao> {
    const usuario = await this.usuarios.buscarPorEmailComSenha(dto.email);
    const senhaConfere =
      !!usuario &&
      usuario.ativo &&
      (await bcrypt.compare(dto.senha, usuario.senhaHash));
    if (!usuario || !senhaConfere) {
      // Mesma mensagem para e-mail inexistente e senha errada
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    await this.usuarios.registrarLogin(usuario.id);
    return this.gerarResposta(await this.usuarios.buscarPorId(usuario.id));
  }

  private async gerarResposta(usuario: Usuario): Promise<RespostaAutenticacao> {
    const payload: PayloadJwt = { sub: usuario.id, papel: usuario.papel };
    return {
      accessToken: await this.jwt.signAsync(payload),
      usuario: paraUsuarioResposta(usuario),
    };
  }
}
