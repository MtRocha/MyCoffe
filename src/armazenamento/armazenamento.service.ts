import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';

/** Tipos aceitos e a extensão gravada no blob. */
const TIPOS_IMAGEM: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024; // 5 MB

/** Assinaturas (magic numbers) para não confiar só no Content-Type enviado. */
function assinaturaConfere(tipo: string, b: Buffer): boolean {
  switch (tipo) {
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return (
        b.subarray(0, 4).toString('ascii') === 'RIFF' &&
        b.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    default:
      return false;
  }
}

/** Armazenamento de imagens no Azure Blob Storage (container via SAS URL). */
@Injectable()
export class ArmazenamentoService {
  private readonly logger = new Logger(ArmazenamentoService.name);
  private container?: ContainerClient;

  private obterContainer(): ContainerClient {
    if (this.container) return this.container;
    const sasUrl = process.env.AZURE_SAS_URL;
    if (!sasUrl) {
      throw new ServiceUnavailableException(
        'Armazenamento de imagens não configurado (AZURE_SAS_URL)',
      );
    }
    this.container = new ContainerClient(sasUrl);
    return this.container;
  }

  /** Envia a imagem e devolve a URL pública do blob (sem o token SAS). */
  async enviarImagem(arquivo: Express.Multer.File, pasta = 'cafes') {
    const extensao = TIPOS_IMAGEM[arquivo.mimetype];
    if (!extensao || !assinaturaConfere(arquivo.mimetype, arquivo.buffer)) {
      throw new BadRequestException(
        'Imagem inválida: envie um arquivo JPEG, PNG ou WebP',
      );
    }
    const blob = this.obterContainer().getBlockBlobClient(
      `${pasta}/${randomUUID()}.${extensao}`,
    );
    await blob.uploadData(arquivo.buffer, {
      blobHTTPHeaders: {
        blobContentType: arquivo.mimetype,
        blobCacheControl: 'public, max-age=31536000, immutable',
      },
    });
    return blob.url.split('?')[0];
  }

  /** Remove um blob criado por nós; ignora URLs de outra origem. Nunca lança. */
  async remover(url?: string | null): Promise<void> {
    try {
      if (!url || !process.env.AZURE_SAS_URL) return;
      const container = this.obterContainer();
      const base = container.url.split('?')[0] + '/';
      if (!url.startsWith(base)) return;
      await container
        .getBlockBlobClient(decodeURIComponent(url.slice(base.length)))
        .deleteIfExists();
    } catch (erro) {
      this.logger.warn(`Falha ao remover imagem ${url}: ${String(erro)}`);
    }
  }
}
