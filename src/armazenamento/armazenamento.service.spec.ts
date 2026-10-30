import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CriarCafeDto } from '../cafes/dto/cafe.dto';
import { ArmazenamentoService } from './armazenamento.service';

const arquivo = (mimetype: string, bytes: number[]) =>
  ({ mimetype, buffer: Buffer.from(bytes) }) as Express.Multer.File;

describe('ArmazenamentoService', () => {
  const servico = new ArmazenamentoService();
  afterEach(() => delete process.env.AZURE_SAS_URL);

  it('rejeita tipo não suportado', async () => {
    await expect(
      servico.enviarImagem(arquivo('application/pdf', [1, 2, 3])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita Content-Type falso (assinatura não confere)', async () => {
    await expect(
      servico.enviarImagem(arquivo('image/png', [0, 1, 2, 3, 4, 5, 6, 7])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('responde 503 sem AZURE_SAS_URL', async () => {
    await expect(
      servico.enviarImagem(arquivo('image/jpeg', [0xff, 0xd8, 0xff, 0xe0])),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('CriarCafeDto via multipart (tudo texto)', () => {
  it('converte preco e tagIds e dispensa imagemUrl', async () => {
    const dto = plainToInstance(CriarCafeDto, {
      nome: 'Cold Brew',
      descricao: 'Extraído a frio',
      preco: '12.50',
      tagIds: '1,2',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.preco).toBe(12.5);
    expect(dto.tagIds).toEqual([1, 2]);
  });
});
