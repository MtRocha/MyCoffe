import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * As triggers de auditoria leem SESSION_CONTEXT('usuario_id') para saber
 * quem fez a alteração. Como as conexões vêm de um pool, o valor precisa
 * ser definido na MESMA conexão da escrita: por isso toda escrita roda
 * dentro de uma transação que começa gravando o usuário na sessão.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly dataSource: DataSource) {}

  async executarComo<T>(
    usuarioId: number | null,
    operacao: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `EXEC sp_set_session_context @key = N'usuario_id', @value = @0`,
        [usuarioId],
      );
      return operacao(manager);
    });
  }
}
