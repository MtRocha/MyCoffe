import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArmazenamentoModule } from '../armazenamento/armazenamento.module';
import { Cafe } from './cafe.entity';
import { CafesController, TagsController } from './cafes.controller';
import { CafesService } from './cafes.service';
import { Tag } from './tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cafe, Tag]), ArmazenamentoModule],
  controllers: [CafesController, TagsController],
  providers: [CafesService],
})
export class CafesModule {}
