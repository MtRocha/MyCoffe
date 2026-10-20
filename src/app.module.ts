import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, PapeisGuard } from './auth/guards';
import { CafesModule } from './cafes/cafes.module';
import { opcoesTypeOrm, validarAmbiente } from './config/ambiente';
import { HealthController } from './health/health.controller';
import { PagamentosModule } from './pagamentos/pagamentos.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      validate: validarAmbiente,
    }),
    TypeOrmModule.forRootAsync({ useFactory: opcoesTypeOrm }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuditoriaModule,
    AuthModule,
    UsuariosModule,
    CafesModule,
    PagamentosModule,
    PedidosModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordem importa: limite de requisições -> JWT -> papéis
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PapeisGuard },
  ],
})
export class AppModule {}
