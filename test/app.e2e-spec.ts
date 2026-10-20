import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';

/**
 * Fluxo completo contra um SQL Server real (banco MyCoffee_Test,
 * recriado a partir de database/mycoffee_sqlserver.sql no global-setup).
 */
describe('MyCoffee API (e2e)', () => {
  let app: INestApplication<App>;
  const senhaSeed = process.env.SEED_SENHA_PADRAO ?? 'MyCoffee@2026';

  let tokenCliente: string;
  let tokenOutroCliente: string;
  let tokenBarista: string;
  let tokenAdmin: string;
  let codigoPedido: string;

  const endereco = {
    cep: '09390-120',
    logradouro: 'Av. Antônia Rosa Fioravanti',
    numero: '804',
    complemento: 'Fatec Mauá',
    bairro: 'Centro',
    cidade: 'Mauá',
    uf: 'SP',
  };

  const api = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string, senha = senhaSeed) {
    const res = await api().post('/auth/login').send({ email, senha });
    expect(res.status).toBe(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();

    tokenBarista = await login('barista@mycoffee.com');
    tokenAdmin = await login('admin@mycoffee.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('infra', () => {
    it('GET /health confirma API e banco', () =>
      api().get('/health').expect(200, { status: 'ok', banco: 'ok' }));

    it('GET /docs-json publica o OpenAPI', async () => {
      const res = await api().get('/docs-json').expect(200);
      expect(res.body).toHaveProperty('paths./pedidos');
    });
  });

  describe('catálogo', () => {
    it('lista os 14 cafés do script com tags', async () => {
      const res = await api().get('/cafes').expect(200);
      const cafes = res.body as {
        nome: string;
        preco: number;
        tags: { nome: string }[];
      }[];
      expect(cafes).toHaveLength(14);
      const latte = cafes.find((c) => c.nome === 'Latte')!;
      expect(latte.preco).toBe(9.9);
      expect(latte.tags.map((t) => t.nome)).toEqual([
        'Tradicional',
        'Com leite',
      ]);
    });

    it('filtra por tag sem perder as outras tags do café', async () => {
      const res = await api()
        .get('/cafes')
        .query({ tag: 'Gelado' })
        .expect(200);
      const cafes = res.body as { nome: string; tags: unknown[] }[];
      expect(cafes.map((c) => c.nome).sort()).toEqual([
        'Cubano',
        'Expresso Gelado',
      ]);
      expect(cafes.find((c) => c.nome === 'Cubano')!.tags).toHaveLength(3);
    });

    it('busca por nome tratando curingas do LIKE como texto', async () => {
      const res = await api()
        .get('/cafes')
        .query({ busca: 'expresso' })
        .expect(200);
      expect(res.body).toHaveLength(4);
      await api().get('/cafes').query({ busca: '%' }).expect(200, []);
    });

    it('GET /cafes/:id e 404 para inexistente', async () => {
      await api().get('/cafes/1').expect(200);
      await api().get('/cafes/9999').expect(404);
      await api().get('/cafes/abc').expect(400);
    });

    it('lista tags e formas de pagamento', async () => {
      const tags = await api().get('/tags').expect(200);
      expect(tags.body).toHaveLength(5);
      const formas = await api().get('/formas-pagamento').expect(200);
      expect(
        (formas.body as { codigo: string }[]).map((f) => f.codigo),
      ).toEqual(['CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO']);
    });
  });

  describe('autenticação', () => {
    const novo = {
      nome: 'Rafael Teste',
      email: 'Rafael.Teste@Email.com',
      senha: 'Cafe12345',
      telefone: '(11) 98888-7777',
    };

    it('cadastra cliente, normaliza dados e não expõe hash', async () => {
      const res = await api().post('/auth/cadastro').send(novo).expect(201);
      const body = res.body as {
        accessToken: string;
        usuario: Record<string, unknown>;
      };
      expect(body.usuario).toMatchObject({
        email: 'rafael.teste@email.com',
        telefone: '11988887777',
        papel: 'CLIENTE',
      });
      expect(body.usuario).not.toHaveProperty('senhaHash');
      tokenCliente = body.accessToken;
    });

    it('não permite e-mail duplicado', () =>
      api().post('/auth/cadastro').send(novo).expect(409));

    it('não aceita escolher o próprio papel', () =>
      api()
        .post('/auth/cadastro')
        .send({ ...novo, email: 'x@email.com', papel: 'ADMIN' })
        .expect(400));

    it('valida senha fraca', () =>
      api()
        .post('/auth/cadastro')
        .send({ ...novo, email: 'y@email.com', senha: 'abc' })
        .expect(400));

    it('rejeita senha errada', () =>
      api()
        .post('/auth/login')
        .send({ email: novo.email, senha: 'Errada123' })
        .expect(401));

    it('GET /auth/me exige token', async () => {
      await api().get('/auth/me').expect(401);
      await api().get('/auth/me').set(auth('token-falso')).expect(401);
      const res = await api()
        .get('/auth/me')
        .set(auth(tokenCliente))
        .expect(200);
      expect(res.body).toMatchObject({ nome: 'Rafael Teste' });
    });

    it('login do cliente de exemplo do script SQL', async () => {
      tokenOutroCliente = await login('cliente@email.com');
    });
  });

  describe('pedidos', () => {
    it('exige autenticação', () => api().post('/pedidos').send({}).expect(401));

    it('cria pedido somando itens repetidos e usando o preço do banco', async () => {
      const res = await api()
        .post('/pedidos')
        .set(auth(tokenCliente))
        .send({
          formaPagamentoId: 1,
          itens: [
            { cafeId: 1, quantidade: 1 },
            { cafeId: 6, quantidade: 2 },
            { cafeId: 1, quantidade: 1 },
          ],
          endereco,
        })
        .expect(201);

      const pedido = res.body as Record<string, unknown> & {
        codigo: string;
        itens: { cafeId: number; quantidade: number; subtotal: number }[];
      };
      expect(pedido).toMatchObject({
        status: 'CONFIRMADO',
        subtotal: 39.6,
        taxaEntrega: 3.5,
        total: 43.1,
        previsaoMin: 20,
        previsaoMax: 30,
        formaPagamento: { codigo: 'CARTAO_CREDITO' },
        endereco: { cep: '09390120', uf: 'SP', complemento: 'Fatec Mauá' },
      });
      expect(pedido.itens).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cafeId: 1, quantidade: 2, subtotal: 19.8 }),
          expect.objectContaining({ cafeId: 6, quantidade: 2, subtotal: 19.8 }),
        ]),
      );
      expect(pedido.codigo).toMatch(/^[0-9a-f-]{36}$/);
      codigoPedido = pedido.codigo;
    });

    it('não aceita preço enviado pelo cliente', () =>
      api()
        .post('/pedidos')
        .set(auth(tokenCliente))
        .send({
          formaPagamentoId: 1,
          itens: [{ cafeId: 1, quantidade: 1, precoUnitario: 0.01 }],
          endereco,
        })
        .expect(400));

    it.each([
      [
        'café inexistente',
        { formaPagamentoId: 1, itens: [{ cafeId: 999, quantidade: 1 }] },
      ],
      [
        'forma de pagamento inexistente',
        { formaPagamentoId: 99, itens: [{ cafeId: 1, quantidade: 1 }] },
      ],
      [
        'sem endereço',
        {
          formaPagamentoId: 1,
          itens: [{ cafeId: 1, quantidade: 1 }],
          endereco: undefined,
        },
      ],
    ])('rejeita %s', (_, corpo) =>
      api()
        .post('/pedidos')
        .set(auth(tokenCliente))
        .send({ endereco, ...corpo })
        .expect(400),
    );

    it('cliente vê os próprios pedidos', async () => {
      const res = await api()
        .get('/pedidos/meus')
        .set(auth(tokenCliente))
        .expect(200);
      expect((res.body as { codigo: string }[]).map((p) => p.codigo)).toEqual([
        codigoPedido,
      ]);
      await api()
        .get(`/pedidos/${codigoPedido}`)
        .set(auth(tokenCliente))
        .expect(200);
    });

    it('outro cliente não enxerga o pedido', async () => {
      await api()
        .get(`/pedidos/${codigoPedido}`)
        .set(auth(tokenOutroCliente))
        .expect(404);
      await api().get('/pedidos').set(auth(tokenOutroCliente)).expect(403);
    });

    it('cliente não muda status pela rota da equipe', () =>
      api()
        .patch(`/pedidos/${codigoPedido}/status`)
        .set(auth(tokenCliente))
        .send({ status: 'ENTREGUE' })
        .expect(403));

    it('barista avança o status e o painel mostra o cliente', async () => {
      const res = await api()
        .patch(`/pedidos/${codigoPedido}/status`)
        .set(auth(tokenBarista))
        .send({ status: 'EM_PREPARO' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'EM_PREPARO',
        cliente: { nome: 'Rafael Teste' },
      });

      const painel = await api()
        .get('/pedidos')
        .query({ status: 'EM_PREPARO' })
        .set(auth(tokenBarista))
        .expect(200);
      // inclui o pedido de exemplo do script SQL, que também está EM_PREPARO
      expect(painel.body).toHaveLength(2);
    });

    it('bloqueia transição fora do fluxo', () =>
      api()
        .patch(`/pedidos/${codigoPedido}/status`)
        .set(auth(tokenBarista))
        .send({ status: 'ENTREGUE' })
        .expect(409));

    it('cliente não cancela pedido já em preparo', () =>
      api()
        .post(`/pedidos/${codigoPedido}/cancelar`)
        .set(auth(tokenCliente))
        .expect(403));

    it('histórico vem das triggers de auditoria, com quem alterou', async () => {
      await api()
        .patch(`/pedidos/${codigoPedido}/status`)
        .set(auth(tokenBarista))
        .send({ status: 'SAIU_PARA_ENTREGA' })
        .expect(200);

      const res = await api()
        .get(`/pedidos/${codigoPedido}/historico`)
        .set(auth(tokenCliente))
        .expect(200);
      const eventos = res.body as {
        status: string;
        statusAnterior: string | null;
        alteradoPor: { nome: string; papel: string } | null;
      }[];
      expect(
        eventos.map((e) => [e.statusAnterior, e.status, e.alteradoPor?.papel]),
      ).toEqual([
        [null, 'CONFIRMADO', 'CLIENTE'],
        ['CONFIRMADO', 'EM_PREPARO', 'FUNCIONARIO'],
        ['EM_PREPARO', 'SAIU_PARA_ENTREGA', 'FUNCIONARIO'],
      ]);
    });

    it('cliente cancela pedido ainda CONFIRMADO', async () => {
      const criado = await api()
        .post('/pedidos')
        .set(auth(tokenCliente))
        .send({
          formaPagamentoId: 3,
          itens: [{ cafeId: 2, quantidade: 1 }],
          endereco,
        })
        .expect(201);
      const { codigo } = criado.body as { codigo: string };

      const res = await api()
        .post(`/pedidos/${codigo}/cancelar`)
        .set(auth(tokenCliente))
        .expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELADO' });
      await api()
        .post(`/pedidos/${codigo}/cancelar`)
        .set(auth(tokenCliente))
        .expect(403);
    });

    it('código inválido na URL', () =>
      api().get('/pedidos/nao-e-uuid').set(auth(tokenCliente)).expect(400));
  });

  describe('recomendações', () => {
    it('ordena pelos mais vendidos, ignorando cancelados', async () => {
      const res = await api()
        .get('/cafes/recomendacoes')
        .query({ limite: 2 })
        .expect(200);
      // Latte: 2 (script) + 2 (teste) = 4; Expresso Tradicional: 1 + 2 = 3
      // Expresso Americano só aparece em pedido cancelado
      expect((res.body as { nome: string }[]).map((c) => c.nome)).toEqual([
        'Latte',
        'Expresso Tradicional',
      ]);
    });
  });

  describe('gestão do catálogo (admin)', () => {
    let idCafe: number;

    it('cliente e barista não cadastram café', async () => {
      const cafe = {
        nome: 'Cold Brew',
        descricao: 'Extraído a frio',
        preco: 12.5,
        imagemUrl: '/img/cold-brew.png',
      };
      await api().post('/cafes').set(auth(tokenCliente)).send(cafe).expect(403);
      await api().post('/cafes').set(auth(tokenBarista)).send(cafe).expect(403);
    });

    it('admin cadastra café com tags', async () => {
      const res = await api()
        .post('/cafes')
        .set(auth(tokenAdmin))
        .send({
          nome: 'Cold Brew',
          descricao: 'Extraído a frio por 12 horas',
          preco: 12.5,
          imagemUrl: '/img/cold-brew.png',
          tagIds: [2, 4],
        })
        .expect(201);
      const cafe = res.body as {
        id: number;
        preco: number;
        tags: { nome: string }[];
      };
      expect(cafe.preco).toBe(12.5);
      expect(cafe.tags.map((t) => t.nome).sort()).toEqual([
        'Especial',
        'Gelado',
      ]);
      idCafe = cafe.id;
    });

    it('nome duplicado e tag inexistente', async () => {
      await api()
        .post('/cafes')
        .set(auth(tokenAdmin))
        .send({
          nome: 'Latte',
          descricao: 'Repetido',
          preco: 1,
          imagemUrl: '/x.png',
        })
        .expect(409);
      await api()
        .patch(`/cafes/${idCafe}`)
        .set(auth(tokenAdmin))
        .send({ tagIds: [99] })
        .expect(400);
    });

    it('altera preço e tags', async () => {
      const res = await api()
        .patch(`/cafes/${idCafe}`)
        .set(auth(tokenAdmin))
        .send({ preco: 13.9, tagIds: [2] })
        .expect(200);
      expect(res.body).toMatchObject({
        preco: 13.9,
        tags: [{ nome: 'Gelado' }],
      });
    });

    it('desativa (exclusão lógica): some do catálogo mas fica na gestão', async () => {
      await api().delete(`/cafes/${idCafe}`).set(auth(tokenAdmin)).expect(204);
      await api().get(`/cafes/${idCafe}`).expect(404);
      const publico = await api().get('/cafes').expect(200);
      expect(publico.body).toHaveLength(14);
      const gestao = await api()
        .get('/cafes/gestao')
        .set(auth(tokenBarista))
        .expect(200);
      expect(gestao.body).toHaveLength(15);
    });

    it('café inativo não pode ser pedido', () =>
      api()
        .post('/pedidos')
        .set(auth(tokenCliente))
        .send({
          formaPagamentoId: 1,
          itens: [{ cafeId: idCafe, quantidade: 1 }],
          endereco,
        })
        .expect(400));

    it('admin cria tag e nome repetido dá 409', async () => {
      await api()
        .post('/tags')
        .set(auth(tokenAdmin))
        .send({ nome: 'Sem lactose' })
        .expect(201);
      await api()
        .post('/tags')
        .set(auth(tokenAdmin))
        .send({ nome: 'Sem lactose' })
        .expect(409);
    });
  });

  describe('usuários (admin)', () => {
    it('só admin lista usuários', async () => {
      await api().get('/usuarios').set(auth(tokenBarista)).expect(403);
      const res = await api()
        .get('/usuarios')
        .query({ papel: 'FUNCIONARIO' })
        .set(auth(tokenAdmin))
        .expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({ email: 'barista@mycoffee.com' }),
      ]);
    });

    it('usuário desativado perde acesso na hora, mesmo com token válido', async () => {
      const me = await api()
        .get('/auth/me')
        .set(auth(tokenOutroCliente))
        .expect(200);
      const { id } = me.body as { id: number };

      await api()
        .patch(`/usuarios/${id}`)
        .set(auth(tokenAdmin))
        .send({ ativo: false })
        .expect(200);
      await api().get('/auth/me').set(auth(tokenOutroCliente)).expect(401);
      await api()
        .post('/auth/login')
        .send({ email: 'cliente@email.com', senha: senhaSeed })
        .expect(401);
    });

    it('admin não rebaixa a si mesmo', async () => {
      const me = await api().get('/auth/me').set(auth(tokenAdmin)).expect(200);
      const { id } = me.body as { id: number };
      await api()
        .patch(`/usuarios/${id}`)
        .set(auth(tokenAdmin))
        .send({ papel: 'CLIENTE' })
        .expect(400);
    });
  });
});
