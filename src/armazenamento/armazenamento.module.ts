import { Module } from '@nestjs/common';
import { ArmazenamentoService } from './armazenamento.service';

@Module({
  providers: [ArmazenamentoService],
  exports: [ArmazenamentoService],
})
export class ArmazenamentoModule {}
