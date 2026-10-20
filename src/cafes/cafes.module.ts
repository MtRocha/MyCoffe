import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cafe } from './cafe.entity';
import { CafesController, TagsController } from './cafes.controller';
import { CafesService } from './cafes.service';
import { Tag } from './tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cafe, Tag])],
  controllers: [CafesController, TagsController],
  providers: [CafesService],
})
export class CafesModule {}
