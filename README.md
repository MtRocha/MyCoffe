# MyCoffee API

API REST do aplicativo mobile de cafeteria **MyCoffee**: catálogo, autenticação, carrinho/checkout, pedidos e recomendação de cafés.

Projeto acadêmico. Equipe: Alexsandro, Matheus e Rafael.

**Stack:** NestJS 11 · TypeORM · SQL Server 2022 · JWT · Swagger · Jest

## Como rodar localmente

Pré-requisitos: Node 20+ e um SQL Server com **login SQL** (o driver Node não suporta Windows Authentication). O jeito mais fácil é usar Docker:

```bash
docker run -d --name mycoffee-sql -e ACCEPT_EULA=Y -e "MSSQL_SA_PASSWORD=SuaSenhaForte!123" -p 14330:1433 mcr.microsoft.com/mssql/server:2022-latest
```

```bash
npm install
cp .env.example .env        # ajuste DB_PORT/DB_PASSWORD/JWT_SECRET
npm run db:setup            # cria o banco a partir de database/mycoffee_sqlserver.sql
npm run start:dev
```

- API: http://localhost:3000
- Documentação interativa (Swagger): http://localhost:3000/docs

O `db:setup` define a senha `SEED_SENHA_PADRAO` para os usuários de exemplo do script:
`admin@mycoffee.com` (ADMIN), `barista@mycoffee.com` (FUNCIONARIO) e `cliente@email.com` (CLIENTE).

## Banco de dados

O schema vem **só** do script `database/mycoffee_sqlserver.sql` (DER em `database/DER_MyCoffee.pdf`); o TypeORM não altera tabelas (`synchronize: false`).

**Auditoria:** as triggers gravam quem alterou cada registro lendo `SESSION_CONTEXT('usuario_id')`. Toda escrita da API passa pelo `AuditoriaService`, que abre uma transação e executa `sp_set_session_context` na mesma conexão antes de gravar. O histórico de status do pedido (`GET /pedidos/:codigo/historico`) é lido dessas tabelas de log.

## Endpoints

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/health` | público | API e banco no ar |
| POST | `/auth/cadastro` | público | Cria conta de cliente e devolve token |
| POST | `/auth/login` | público | Login (JWT) |
| GET | `/auth/me` | logado | Dados do usuário |
| GET | `/cafes?tag=&busca=` | público | Catálogo (só ativos) |
| GET | `/cafes/recomendacoes?limite=` | público | Mais vendidos |
| GET | `/cafes/:id` | público | Detalhe do café |
| GET | `/cafes/gestao` | equipe | Catálogo incluindo inativos |
| POST / PATCH / DELETE | `/cafes[/:id]` | admin | Cadastro; DELETE desativa (exclusão lógica) |
| GET / POST | `/tags` | público / admin | Tags do catálogo |
| GET | `/formas-pagamento` | público | Opções do checkout |
| POST | `/pedidos` | logado | Checkout (preços sempre vêm do banco) |
| GET | `/pedidos/meus` | logado | "Meus pedidos" |
| GET | `/pedidos/:codigo` | dono ou equipe | Tela de confirmação |
| GET | `/pedidos/:codigo/historico` | dono ou equipe | Linha do tempo de status |
| POST | `/pedidos/:codigo/cancelar` | dono | Cancela enquanto CONFIRMADO |
| GET | `/pedidos?status=` | equipe | Painel de pedidos |
| PATCH | `/pedidos/:codigo/status` | equipe | CONFIRMADO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE (ou CANCELADO) |
| GET / PATCH | `/usuarios[/:id]` | admin | Papel e ativação de usuários |

Equipe = papéis `FUNCIONARIO` e `ADMIN`. Rotas protegidas usam o header `Authorization: Bearer <token>`.

### Swagger / OpenAPI

- Interativo: `/docs` em qualquer instância da API (JSON em `/docs-json`, YAML em `/docs-yaml`).
- Arquivos: [`docs/openapi.json`](docs/openapi.json) e [`docs/openapi.yaml`](docs/openapi.yaml), para importar no Postman/Insomnia ou gerar o cliente do app. Regenere após mudar rotas ou DTOs (não precisa de banco):

```bash
npm run openapi
```

Para incluir a URL pública na lista de servidores: `OPENAPI_SERVERS=https://sua-api.azurewebsites.net,http://localhost:3000 npm run openapi`.

## Testes

```bash
npm test            # unitários (regras de pedido, auth, guards, validação)
npm run test:e2e    # fluxo completo contra SQL Server real
```

Os testes e2e usam o `.env.test` (copie o `.env` trocando `DB_NAME=MyCoffee_Test`) e **recriam** esse banco a cada execução. Por segurança, o script só apaga bancos cujo nome termina em `_Test`.

## Variáveis de ambiente

Veja `.env.example`. Para Azure SQL: `DB_ENCRYPT=true`, `DB_TRUST_SERVER_CERTIFICATE=false` e `DB_CRIAR_BANCO=false` (o banco é criado pelo portal).
