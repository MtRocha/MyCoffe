import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../common/decorators';
import { ehViolacaoDeUnicidade } from '../common/erros-sql';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { UsuarioRespostaDto } from './dto/usuario-resposta.dto';
import { Papel, Usuario } from './usuario.entity';

export interface NovoUsuario {
  nome: string;
  email: string;
  senhaHash: string;
  telefone?: string | null;
}

export type UsuarioResposta = UsuarioRespostaDto;

export function paraUsuarioResposta(u: Usuario): UsuarioResposta {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    telefone: u.telefone,
    papel: u.papel,
    ativo: u.ativo,
    ultimoLoginEm: u.ultimoLoginEm,
    criadoEm: u.criadoEm,
    atualizadoEm: u.atualizadoEm,
  };
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly auditoria: AuditoriaService,
  ) {}

  buscarPorEmailComSenha(email: string): Promise<Usuario | null> {
    return this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.senhaHash')
      .where('u.email = :email', { email })
      .getOne();
  }

  buscarAtivoPorId(id: number): Promise<Usuario | null> {
    return this.usuarios.findOneBy({ id, ativo: true });
  }

  async buscarPorId(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.findOneBy({ id });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return usuario;
  }

  async criarCliente(dados: NovoUsuario): Promise<Usuario> {
    try {
      const id = await this.auditoria.executarComo(null, async (m) => {
        const resultado = await m.insert(Usuario, {
          ...dados,
          telefone: dados.telefone ?? null,
          papel: 'CLIENTE',
          ativo: true,
        });
        return (resultado.identifiers[0] as { id: number }).id;
      });
      return this.buscarPorId(id);
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw erro;
    }
  }

  async registrarLogin(id: number): Promise<void> {
    await this.auditoria.executarComo(id, (m) =>
      m.update(Usuario, { id }, { ultimoLoginEm: new Date() }),
    );
  }

  listar(papel?: Papel): Promise<Usuario[]> {
    return this.usuarios.find({
      where: papel ? { papel } : {},
      order: { nome: 'ASC' },
    });
  }

  async atualizar(
    id: number,
    dto: AtualizarUsuarioDto,
    ator: UsuarioAutenticado,
  ): Promise<Usuario> {
    await this.buscarPorId(id);
    if (
      id === ator.id &&
      (dto.ativo === false || (dto.papel && dto.papel !== 'ADMIN'))
    ) {
      throw new BadRequestException(
        'Um administrador não pode desativar nem rebaixar a si mesmo',
      );
    }
    if (dto.papel !== undefined || dto.ativo !== undefined) {
      await this.auditoria.executarComo(ator.id, (m) =>
        m.update(Usuario, { id }, dto),
      );
    }
    return this.buscarPorId(id);
  }
}
