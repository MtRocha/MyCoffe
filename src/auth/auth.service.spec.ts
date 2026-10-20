import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Usuario } from '../usuarios/usuario.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';

function usuario(parcial: Partial<Usuario> = {}): Usuario {
  return {
    id: 7,
    nome: 'Cliente',
    email: 'cliente@email.com',
    senhaHash: '',
    telefone: null,
    papel: 'CLIENTE',
    ativo: true,
    ultimoLoginEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...parcial,
  };
}

describe('AuthService', () => {
  let usuarios: jest.Mocked<
    Pick<
      UsuariosService,
      | 'criarCliente'
      | 'buscarPorEmailComSenha'
      | 'registrarLogin'
      | 'buscarPorId'
    >
  >;
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    usuarios = {
      criarCliente: jest.fn(),
      buscarPorEmailComSenha: jest.fn(),
      registrarLogin: jest.fn(),
      buscarPorId: jest.fn(),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    service = new AuthService(
      usuarios as unknown as UsuariosService,
      jwt as unknown as JwtService,
    );
  });

  it('cadastra com hash bcrypt e nunca devolve o hash', async () => {
    usuarios.criarCliente.mockImplementation((dados) =>
      Promise.resolve(usuario({ senhaHash: dados.senhaHash })),
    );

    const resposta = await service.cadastrar({
      nome: 'Cliente',
      email: 'cliente@email.com',
      senha: 'Senha1234',
    });

    const { senhaHash } = usuarios.criarCliente.mock.calls[0][0];
    expect(senhaHash).not.toBe('Senha1234');
    expect(await bcrypt.compare('Senha1234', senhaHash)).toBe(true);
    expect(resposta.accessToken).toBe('token');
    expect(resposta.usuario).not.toHaveProperty('senhaHash');
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 7, papel: 'CLIENTE' });
  });

  describe('login', () => {
    const hash = bcrypt.hashSync('Senha1234', 4);

    it('autentica e registra o último login', async () => {
      usuarios.buscarPorEmailComSenha.mockResolvedValue(
        usuario({ senhaHash: hash }),
      );
      usuarios.buscarPorId.mockResolvedValue(usuario());

      const resposta = await service.login({
        email: 'cliente@email.com',
        senha: 'Senha1234',
      });

      expect(resposta.accessToken).toBe('token');
      expect(usuarios.registrarLogin).toHaveBeenCalledWith(7);
    });

    it.each([
      ['senha errada', usuario({ senhaHash: hash }), 'Errada123'],
      ['usuário inexistente', null, 'Senha1234'],
      [
        'usuário inativo',
        usuario({ senhaHash: hash, ativo: false }),
        'Senha1234',
      ],
    ])('rejeita %s com a mesma mensagem', async (_, encontrado, senha) => {
      usuarios.buscarPorEmailComSenha.mockResolvedValue(encontrado);

      await expect(
        service.login({ email: 'cliente@email.com', senha }),
      ).rejects.toThrow(new UnauthorizedException('E-mail ou senha inválidos'));
      expect(usuarios.registrarLogin).not.toHaveBeenCalled();
    });
  });
});
