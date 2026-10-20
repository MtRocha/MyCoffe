import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Publico } from '../common/decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /** Usado pela hospedagem para saber se a API e o banco estão no ar. */
  @Publico()
  @Get()
  async verificar() {
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
