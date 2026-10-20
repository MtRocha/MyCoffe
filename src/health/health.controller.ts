import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Publico } from '../common/decorators';

export class HealthDto {
  /** @example "ok" */
  status: string;

  /** @example "ok" */
  banco: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /** Usado pela hospedagem para saber se a API e o banco estão no ar. Banco fora = 503. */
  @Publico()
  @Get()
  async verificar(): Promise<HealthDto> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', banco: 'ok' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'erro',
        banco: 'indisponível',
      });
    }
  }
}
