/* =====================================================================
   MyCoffee - Modelagem do banco de dados para SQL Server
   Requer SQL Server 2016 SP1+ (JSON, SESSION_CONTEXT, CREATE OR ALTER)

   Ordem: banco -> schemas -> tabelas -> índices -> triggers de auditoria
          -> dados iniciais -> pedido de exemplo

   Datas gravadas em UTC (SYSUTCDATETIME); converta no front-end.
   ===================================================================== */

IF DB_ID(N'MyCoffee') IS NULL
    CREATE DATABASE MyCoffee;
GO
USE MyCoffee;
GO

CREATE SCHEMA auditoria;  -- separa as tabelas de log das tabelas de negócio
GO

/* =====================================================================
   1. USUÁRIOS (clientes e funcionários) + autenticação
   ===================================================================== */
CREATE TABLE dbo.usuario (
    id               INT IDENTITY(1,1) NOT NULL,
    nome             NVARCHAR(100)     NOT NULL,
    email            VARCHAR(254)      NOT NULL,
    senha_hash       VARCHAR(255)      NOT NULL,  -- hash bcrypt/argon2 gerado pela aplicação; nunca a senha pura
    telefone         VARCHAR(11)       NULL,      -- apenas dígitos: DDD + número
    papel            VARCHAR(12)       NOT NULL CONSTRAINT df_usuario_papel     DEFAULT ('CLIENTE'),
    ativo            BIT               NOT NULL CONSTRAINT df_usuario_ativo     DEFAULT (1),
    ultimo_login_em  DATETIME2(0)      NULL,
    criado_em        DATETIME2(0)      NOT NULL CONSTRAINT df_usuario_criado    DEFAULT (SYSUTCDATETIME()),
    atualizado_em    DATETIME2(0)      NOT NULL CONSTRAINT df_usuario_atualizado DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_usuario          PRIMARY KEY CLUSTERED (id),
    CONSTRAINT uq_usuario_email    UNIQUE (email),
    CONSTRAINT ck_usuario_papel    CHECK (papel IN ('CLIENTE', 'FUNCIONARIO', 'ADMIN')),
    CONSTRAINT ck_usuario_email    CHECK (email LIKE '%_@_%._%'),
    CONSTRAINT ck_usuario_telefone CHECK (telefone NOT LIKE '%[^0-9]%' AND LEN(telefone) BETWEEN 10 AND 11)
);

/* =====================================================================
   2. CATÁLOGO
   ===================================================================== */
CREATE TABLE dbo.cafe (
    id             SMALLINT IDENTITY(1,1) NOT NULL,
    nome           NVARCHAR(60)   NOT NULL,
    descricao      NVARCHAR(255)  NOT NULL,
    preco          DECIMAL(6,2)   NOT NULL,
    imagem_url     VARCHAR(255)   NOT NULL,
    ativo          BIT            NOT NULL CONSTRAINT df_cafe_ativo      DEFAULT (1),
    criado_em      DATETIME2(0)   NOT NULL CONSTRAINT df_cafe_criado     DEFAULT (SYSUTCDATETIME()),
    atualizado_em  DATETIME2(0)   NOT NULL CONSTRAINT df_cafe_atualizado DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_cafe       PRIMARY KEY CLUSTERED (id),
    CONSTRAINT uq_cafe_nome  UNIQUE (nome),
    CONSTRAINT ck_cafe_preco CHECK (preco > 0)
);

CREATE TABLE dbo.tag (
    id    TINYINT IDENTITY(1,1) NOT NULL,
    nome  NVARCHAR(30) NOT NULL,
    CONSTRAINT pk_tag      PRIMARY KEY CLUSTERED (id),
    CONSTRAINT uq_tag_nome UNIQUE (nome)
);

CREATE TABLE dbo.cafe_tag (
    cafe_id  SMALLINT NOT NULL,
    tag_id   TINYINT  NOT NULL,
    CONSTRAINT pk_cafe_tag      PRIMARY KEY CLUSTERED (cafe_id, tag_id),
    CONSTRAINT fk_cafe_tag_cafe FOREIGN KEY (cafe_id) REFERENCES dbo.cafe (id) ON DELETE CASCADE,
    CONSTRAINT fk_cafe_tag_tag  FOREIGN KEY (tag_id)  REFERENCES dbo.tag (id)
);

/* =====================================================================
   3. PAGAMENTO
   ===================================================================== */
CREATE TABLE dbo.forma_pagamento (
    id         TINYINT IDENTITY(1,1) NOT NULL,
    codigo     VARCHAR(20)  NOT NULL,
    descricao  NVARCHAR(30) NOT NULL,
    ativo      BIT          NOT NULL CONSTRAINT df_forma_pagamento_ativo DEFAULT (1),
    CONSTRAINT pk_forma_pagamento        PRIMARY KEY CLUSTERED (id),
    CONSTRAINT uq_forma_pagamento_codigo UNIQUE (codigo)
);

/* =====================================================================
   4. PEDIDO
   ===================================================================== */
CREATE TABLE dbo.pedido (
    id                  BIGINT IDENTITY(1,1) NOT NULL,
    codigo              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_pedido_codigo DEFAULT (NEWID()), -- id público usado na URL
    usuario_id          INT              NOT NULL,  -- cliente autenticado que fez o pedido
    forma_pagamento_id  TINYINT          NOT NULL,
    status              VARCHAR(20)      NOT NULL CONSTRAINT df_pedido_status DEFAULT ('CONFIRMADO'),
    subtotal            DECIMAL(10,2)    NOT NULL,  -- "Total de itens"
    taxa_entrega        DECIMAL(6,2)     NOT NULL CONSTRAINT df_pedido_taxa DEFAULT (0),
    total               AS (subtotal + taxa_entrega) PERSISTED,
    previsao_min        TINYINT          NOT NULL,  -- minutos
    previsao_max        TINYINT          NOT NULL,
    criado_em           DATETIME2(0)     NOT NULL CONSTRAINT df_pedido_criado DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_pedido              PRIMARY KEY CLUSTERED (id),       -- cluster sequencial: sem fragmentação
    CONSTRAINT uq_pedido_codigo       UNIQUE NONCLUSTERED (codigo),     -- GUID nunca como índice clusterizado
    CONSTRAINT fk_pedido_usuario      FOREIGN KEY (usuario_id)         REFERENCES dbo.usuario (id),
    CONSTRAINT fk_pedido_forma_pag    FOREIGN KEY (forma_pagamento_id) REFERENCES dbo.forma_pagamento (id),
    CONSTRAINT ck_pedido_status       CHECK (status IN ('CONFIRMADO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO')),
    CONSTRAINT ck_pedido_subtotal     CHECK (subtotal > 0),
    CONSTRAINT ck_pedido_taxa         CHECK (taxa_entrega >= 0),
    CONSTRAINT ck_pedido_previsao     CHECK (previsao_min > 0 AND previsao_max >= previsao_min)
);

CREATE TABLE dbo.item_pedido (
    pedido_id       BIGINT       NOT NULL,
    cafe_id         SMALLINT     NOT NULL,
    quantidade      TINYINT      NOT NULL,
    preco_unitario  DECIMAL(6,2) NOT NULL,  -- cópia do preço no momento da compra
    subtotal        AS (CAST(quantidade * preco_unitario AS DECIMAL(8,2))) PERSISTED,
    CONSTRAINT pk_item_pedido        PRIMARY KEY CLUSTERED (pedido_id, cafe_id),
    CONSTRAINT fk_item_pedido_pedido FOREIGN KEY (pedido_id) REFERENCES dbo.pedido (id) ON DELETE CASCADE,
    CONSTRAINT fk_item_pedido_cafe   FOREIGN KEY (cafe_id)   REFERENCES dbo.cafe (id),
    CONSTRAINT ck_item_quantidade    CHECK (quantidade BETWEEN 1 AND 99),
    CONSTRAINT ck_item_preco         CHECK (preco_unitario > 0)
);

CREATE TABLE dbo.endereco_entrega (
    pedido_id    BIGINT        NOT NULL,
    cep          CHAR(8)       NOT NULL,
    logradouro   NVARCHAR(120) NOT NULL,
    numero       VARCHAR(10)   NOT NULL,  -- aceita "S/N", "804A"
    complemento  NVARCHAR(60)  NULL,
    bairro       NVARCHAR(60)  NOT NULL,
    cidade       NVARCHAR(60)  NOT NULL,
    uf           CHAR(2)       NOT NULL,
    CONSTRAINT pk_endereco_entrega PRIMARY KEY CLUSTERED (pedido_id),
    CONSTRAINT fk_endereco_pedido  FOREIGN KEY (pedido_id) REFERENCES dbo.pedido (id) ON DELETE CASCADE,
    CONSTRAINT ck_endereco_cep     CHECK (cep NOT LIKE '%[^0-9]%' AND LEN(cep) = 8),
    CONSTRAINT ck_endereco_uf      CHECK (uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
                                                 'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))
);

/* =====================================================================
   5. TABELAS DE LOG (preenchidas somente pelas triggers)
   - usuario_id vem do SESSION_CONTEXT definido pela aplicação após o login
   - sem FK para usuario: o log precisa sobreviver mesmo se o usuário sumir
   - compressão de página: logs crescem muito e quase só recebem INSERT
   ===================================================================== */
CREATE TABLE auditoria.log_alteracao (
    id             BIGINT IDENTITY(1,1) NOT NULL,
    tabela         VARCHAR(50)    NOT NULL,
    chave          VARCHAR(50)    NOT NULL,  -- PK do registro (composta separada por "|")
    dados_antigos  NVARCHAR(MAX)  NOT NULL,  -- JSON da linha antes do UPDATE
    dados_novos    NVARCHAR(MAX)  NOT NULL,  -- JSON da linha depois do UPDATE
    usuario_id     INT            NULL,
    login_banco    NVARCHAR(128)  NOT NULL CONSTRAINT df_log_alt_login DEFAULT (ORIGINAL_LOGIN()),
    data_hora      DATETIME2(3)   NOT NULL CONSTRAINT df_log_alt_data  DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_log_alteracao PRIMARY KEY CLUSTERED (id)
) WITH (DATA_COMPRESSION = PAGE);

CREATE TABLE auditoria.log_exclusao (
    id               BIGINT IDENTITY(1,1) NOT NULL,
    tabela           VARCHAR(50)    NOT NULL,
    chave            VARCHAR(50)    NOT NULL,
    dados_excluidos  NVARCHAR(MAX)  NOT NULL,  -- JSON da linha excluída
    usuario_id       INT            NULL,
    login_banco      NVARCHAR(128)  NOT NULL CONSTRAINT df_log_exc_login DEFAULT (ORIGINAL_LOGIN()),
    data_hora        DATETIME2(3)   NOT NULL CONSTRAINT df_log_exc_data  DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_log_exclusao PRIMARY KEY CLUSTERED (id)
) WITH (DATA_COMPRESSION = PAGE);
GO

/* =====================================================================
   6. ÍNDICES (PKs e UNIQUEs já criam os seus)
   ===================================================================== */
-- Home: catálogo só de cafés ativos, índice filtrado e de cobertura
CREATE NONCLUSTERED INDEX ix_cafe_ativos
    ON dbo.cafe (nome) INCLUDE (descricao, preco, imagem_url) WHERE ativo = 1;

CREATE NONCLUSTERED INDEX ix_cafe_tag_tag ON dbo.cafe_tag (tag_id);

-- Tela de funcionários/admin: listar usuários ativos por papel
CREATE NONCLUSTERED INDEX ix_usuario_papel
    ON dbo.usuario (papel) INCLUDE (nome, email) WHERE ativo = 1;

-- "Meus pedidos" do cliente
CREATE NONCLUSTERED INDEX ix_pedido_usuario_data
    ON dbo.pedido (usuario_id, criado_em DESC) INCLUDE (status, total);

-- Painel dos funcionários: pedidos por status
CREATE NONCLUSTERED INDEX ix_pedido_status_data
    ON dbo.pedido (status, criado_em DESC) INCLUDE (usuario_id, total);

CREATE NONCLUSTERED INDEX ix_pedido_forma_pag ON dbo.pedido (forma_pagamento_id);

-- Relatórios de venda por café
CREATE NONCLUSTERED INDEX ix_item_pedido_cafe
    ON dbo.item_pedido (cafe_id) INCLUDE (quantidade, preco_unitario);

-- Consulta de histórico de um registro
CREATE NONCLUSTERED INDEX ix_log_alteracao_registro
    ON auditoria.log_alteracao (tabela, chave, data_hora DESC) WITH (DATA_COMPRESSION = PAGE);
CREATE NONCLUSTERED INDEX ix_log_exclusao_registro
    ON auditoria.log_exclusao (tabela, chave, data_hora DESC) WITH (DATA_COMPRESSION = PAGE);
GO

/* =====================================================================
   7. TRIGGERS DE AUDITORIA (AFTER UPDATE, DELETE)
   Padrão de todas:
   - SET NOCOUNT ON e processamento em conjunto (funciona com N linhas)
   - UPDATE: grava antes/depois em JSON, só quando algo realmente mudou
   - DELETE: grava a linha excluída em JSON
   - TRIGGER_NESTLEVEL evita reentrada quando a trigger atualiza atualizado_em
   ===================================================================== */

-- ---------- usuario (não registra senha_hash nem logins no log) ----------
CREATE OR ALTER TRIGGER dbo.trg_usuario_auditoria
ON dbo.usuario
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(@@PROCID) > 1 OR NOT EXISTS (SELECT 1 FROM deleted) RETURN;

    DECLARE @usuario_id INT = TRY_CAST(SESSION_CONTEXT(N'usuario_id') AS INT);
    DECLARE @alterados TABLE (id INT PRIMARY KEY);

    IF EXISTS (SELECT 1 FROM inserted)
    BEGIN
        INSERT INTO auditoria.log_alteracao (tabela, chave, dados_antigos, dados_novos, usuario_id)
        OUTPUT CAST(inserted.chave AS INT) INTO @alterados (id)
        SELECT 'usuario',
               CAST(d.id AS VARCHAR(50)),
               j.antigo,
               JSON_MODIFY(j.novo, '$.senha_alterada', CAST(IIF(i.senha_hash <> d.senha_hash, 1, 0) AS BIT)),
               @usuario_id
        FROM deleted d
        JOIN inserted i ON i.id = d.id
        CROSS APPLY (SELECT
            antigo = (SELECT d.id, d.nome, d.email, d.telefone, d.papel, d.ativo
                      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            novo   = (SELECT i.id, i.nome, i.email, i.telefone, i.papel, i.ativo
                      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        ) j
        WHERE j.antigo COLLATE Latin1_General_BIN2 <> j.novo COLLATE Latin1_General_BIN2
           OR i.senha_hash <> d.senha_hash;

        UPDATE u SET atualizado_em = SYSUTCDATETIME()
        FROM dbo.usuario u JOIN @alterados a ON a.id = u.id;
    END
    ELSE
    BEGIN
        INSERT INTO auditoria.log_exclusao (tabela, chave, dados_excluidos, usuario_id)
        SELECT 'usuario',
               CAST(d.id AS VARCHAR(50)),
               (SELECT d.id, d.nome, d.email, d.telefone, d.papel, d.ativo, d.criado_em
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @usuario_id
        FROM deleted d;
    END
END;
GO

-- ---------- cafe ----------
CREATE OR ALTER TRIGGER dbo.trg_cafe_auditoria
ON dbo.cafe
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(@@PROCID) > 1 OR NOT EXISTS (SELECT 1 FROM deleted) RETURN;

    DECLARE @usuario_id INT = TRY_CAST(SESSION_CONTEXT(N'usuario_id') AS INT);
    DECLARE @alterados TABLE (id SMALLINT PRIMARY KEY);

    IF EXISTS (SELECT 1 FROM inserted)
    BEGIN
        INSERT INTO auditoria.log_alteracao (tabela, chave, dados_antigos, dados_novos, usuario_id)
        OUTPUT CAST(inserted.chave AS SMALLINT) INTO @alterados (id)
        SELECT 'cafe', CAST(d.id AS VARCHAR(50)), j.antigo, j.novo, @usuario_id
        FROM deleted d
        CROSS APPLY (SELECT
            antigo = (SELECT x.* FROM deleted  x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            novo   = (SELECT x.* FROM inserted x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        ) j
        WHERE j.antigo COLLATE Latin1_General_BIN2 <> j.novo COLLATE Latin1_General_BIN2;

        UPDATE c SET atualizado_em = SYSUTCDATETIME()
        FROM dbo.cafe c JOIN @alterados a ON a.id = c.id;
    END
    ELSE
    BEGIN
        INSERT INTO auditoria.log_exclusao (tabela, chave, dados_excluidos, usuario_id)
        SELECT 'cafe', CAST(d.id AS VARCHAR(50)),
               (SELECT x.* FROM deleted x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @usuario_id
        FROM deleted d;
    END
END;
GO

-- ---------- tag ----------
CREATE OR ALTER TRIGGER dbo.trg_tag_auditoria
ON dbo.tag
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    DECLARE @usuario_id INT = TRY_CAST(SESSION_CONTEXT(N'usuario_id') AS INT);

    IF EXISTS (SELECT 1 FROM inserted)
        INSERT INTO auditoria.log_alteracao (tabela, chave, dados_antigos, dados_novos, usuario_id)
        SELECT 'tag', CAST(d.id AS VARCHAR(50)), j.antigo, j.novo, @usuario_id
        FROM deleted d
        CROSS APPLY (SELECT
            antigo = (SELECT x.* FROM deleted  x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            novo   = (SELECT x.* FROM inserted x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        ) j
        WHERE j.antigo COLLATE Latin1_General_BIN2 <> j.novo COLLATE Latin1_General_BIN2;
    ELSE
        INSERT INTO auditoria.log_exclusao (tabela, chave, dados_excluidos, usuario_id)
        SELECT 'tag', CAST(d.id AS VARCHAR(50)),
               (SELECT x.* FROM deleted x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @usuario_id
        FROM deleted d;
END;
GO

-- ---------- cafe_tag (só tem chave: alteração é bloqueada, use DELETE + INSERT) ----------
CREATE OR ALTER TRIGGER dbo.trg_cafe_tag_auditoria
ON dbo.cafe_tag
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;

    IF EXISTS (SELECT 1 FROM inserted)
        THROW 50001, N'cafe_tag não pode ser alterada: exclua a associação e insira a nova.', 1;

    INSERT INTO auditoria.log_exclusao (tabela, chave, dados_excluidos, usuario_id)
    SELECT 'cafe_tag',
           CONCAT(d.cafe_id, '|', d.tag_id),
           (SELECT d.cafe_id, d.tag_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           TRY_CAST(SESSION_CONTEXT(N'usuario_id') AS INT)
    FROM deleted d;
END;
GO

-- ---------- forma_pagamento ----------
CREATE OR ALTER TRIGGER dbo.trg_forma_pagamento_auditoria
ON dbo.forma_pagamento
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    DECLARE @usuario_id INT = TRY_CAST(SESSION_CONTEXT(N'usuario_id') AS INT);

    IF EXISTS (SELECT 1 FROM inserted)
        INSERT INTO auditoria.log_alteracao (tabela, chave, dados_antigos, dados_novos, usuario_id)
        SELECT 'forma_pagamento', CAST(d.id AS VARCHAR(50)), j.antigo, j.novo, @usuario_id
        FROM deleted d
        CROSS APPLY (SELECT
            antigo = (SELECT x.* FROM deleted  x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            novo   = (SELECT x.* FROM inserted x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        ) j
        WHERE j.antigo COLLATE Latin1_General_BIN2 <> j.novo COLLATE Latin1_General_BIN2;
    ELSE
        INSERT INTO auditoria.log_exclusao (tabela, chave, dados_excluidos, usuario_id)
        SELECT 'forma_pagamento', CAST(d.id AS VARCHAR(50)),
               (SELECT x.* FROM deleted x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @usuario_id
        FROM deleted d;
END;
GO

-- ---------- pedido (o log de alteração funciona como histórico de status) ----------
CREATE OR ALTER TRIGGER dbo.trg_pedido_auditoria
ON dbo.pedido
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    DECLARE @usuario_id INT = TRY_CAST(SESSION_CONTEXT(N'usuario_id') AS INT);

    IF EXISTS (SELECT 1 FROM inserted)
        INSERT INTO auditoria.log_alteracao (tabela, chave, dados_antigos, dados_novos, usuario_id)
        SELECT 'pedido', CAST(d.id AS VARCHAR(50)), j.antigo, j.novo, @usuario_id
        FROM deleted d
        CROSS APPLY (SELECT
            antigo = (SELECT x.* FROM deleted  x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            novo   = (SELECT x.* FROM inserted x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        ) j
        WHERE j.antigo COLLATE Latin1_General_BIN2 <> j.novo COLLATE Latin1_General_BIN2;
    ELSE
        INSERT INTO auditoria.log_exclusao (tabela, chave, dados_excluidos, usuario_id)
        SELECT 'pedido', CAST(d.id AS VARCHAR(50)),
               (SELECT x.* FROM deleted x WHERE x.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @usuario_id
        FROM deleted d;
END;
GO

-- ---------- item_pedido (chave composta não pode ser alterada) ----------
CREATE OR ALTER TRIGGER dbo.trg_item_pedido_auditoria
ON dbo.item_pedido
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    DECLARE @usuario_id INT = TRY_CAST(SESSION_CONTEXT(N'usuario_id') AS INT);

    IF EXISTS (SELECT 1 FROM inserted)
    BEGIN
        IF UPDATE(pedido_id) OR UPDATE(cafe_id)
            THROW 50002, N'A chave de item_pedido não pode ser alterada: exclua o item e insira novamente.', 1;

        INSERT INTO auditoria.log_alteracao (tabela, chave, dados_antigos, dados_novos, usuario_id)
        SELECT 'item_pedido', CONCAT(d.pedido_id, '|', d.cafe_id), j.antigo, j.novo, @usuario_id
        FROM deleted d
        CROSS APPLY (SELECT
            antigo = (SELECT x.* FROM deleted  x WHERE x.pedido_id = d.pedido_id AND x.cafe_id = d.cafe_id
                      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            novo   = (SELECT x.* FROM inserted x WHERE x.pedido_id = d.pedido_id AND x.cafe_id = d.cafe_id
                      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        ) j
        WHERE j.antigo COLLATE Latin1_General_BIN2 <> j.novo COLLATE Latin1_General_BIN2;
    END
    ELSE
        INSERT INTO auditoria.log_exclusao (tabela, chave, dados_excluidos, usuario_id)
        SELECT 'item_pedido', CONCAT(d.pedido_id, '|', d.cafe_id),
               (SELECT x.* FROM deleted x WHERE x.pedido_id = d.pedido_id AND x.cafe_id = d.cafe_id
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @usuario_id
        FROM deleted d;
END;
GO

-- ---------- endereco_entrega ----------
CREATE OR ALTER TRIGGER dbo.trg_endereco_entrega_auditoria
ON dbo.endereco_entrega
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    DECLARE @usuario_id INT = TRY_CAST(SESSION_CONTEXT(N'usuario_id') AS INT);

    IF EXISTS (SELECT 1 FROM inserted)
    BEGIN
        IF UPDATE(pedido_id)
            THROW 50003, N'O pedido de um endereço de entrega não pode ser trocado.', 1;

        INSERT INTO auditoria.log_alteracao (tabela, chave, dados_antigos, dados_novos, usuario_id)
        SELECT 'endereco_entrega', CAST(d.pedido_id AS VARCHAR(50)), j.antigo, j.novo, @usuario_id
        FROM deleted d
        CROSS APPLY (SELECT
            antigo = (SELECT x.* FROM deleted  x WHERE x.pedido_id = d.pedido_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            novo   = (SELECT x.* FROM inserted x WHERE x.pedido_id = d.pedido_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        ) j
        WHERE j.antigo COLLATE Latin1_General_BIN2 <> j.novo COLLATE Latin1_General_BIN2;
    END
    ELSE
        INSERT INTO auditoria.log_exclusao (tabela, chave, dados_excluidos, usuario_id)
        SELECT 'endereco_entrega', CAST(d.pedido_id AS VARCHAR(50)),
               (SELECT x.* FROM deleted x WHERE x.pedido_id = d.pedido_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @usuario_id
        FROM deleted d;
END;
GO

/* =====================================================================
   8. DADOS INICIAIS
   ===================================================================== */
INSERT INTO dbo.tag (nome) VALUES
    (N'Tradicional'), (N'Gelado'), (N'Com leite'), (N'Especial'), (N'Alcoólico');

INSERT INTO dbo.forma_pagamento (codigo, descricao) VALUES
    ('CARTAO_CREDITO', N'Cartão de crédito'),
    ('CARTAO_DEBITO',  N'Cartão de débito'),
    ('DINHEIRO',       N'Dinheiro');

-- ATENÇÃO: senha_hash abaixo é apenas um marcador. A aplicação gera o hash real (bcrypt/argon2).
INSERT INTO dbo.usuario (nome, email, senha_hash, telefone, papel) VALUES
    (N'Administrador',   'admin@mycoffee.com',   '$2b$12$SUBSTITUIR.PELO.HASH.GERADO.NA.APLICACAO', NULL,          'ADMIN'),
    (N'Barista Exemplo', 'barista@mycoffee.com', '$2b$12$SUBSTITUIR.PELO.HASH.GERADO.NA.APLICACAO', '11999990000', 'FUNCIONARIO'),
    (N'Cliente Exemplo', 'cliente@email.com',    '$2b$12$SUBSTITUIR.PELO.HASH.GERADO.NA.APLICACAO', '11988887777', 'CLIENTE');

INSERT INTO dbo.cafe (nome, descricao, preco, imagem_url) VALUES
    (N'Expresso Tradicional', N'O tradicional café feito com água quente e grãos moídos', 9.90, '/img/expresso-tradicional.png'),
    (N'Expresso Americano',   N'Expresso diluído, menos intenso que o tradicional', 9.90, '/img/expresso-americano.png'),
    (N'Expresso Cremoso',     N'Café expresso tradicional com espuma cremosa', 9.90, '/img/expresso-cremoso.png'),
    (N'Expresso Gelado',      N'Bebida preparada com café expresso e cubos de gelo', 9.90, '/img/expresso-gelado.png'),
    (N'Café com Leite',       N'Meio a meio de expresso tradicional com leite vaporizado', 9.90, '/img/cafe-com-leite.png'),
    (N'Latte',                N'Uma dose de café expresso com o dobro de leite e espuma cremosa', 9.90, '/img/latte.png'),
    (N'Capuccino',            N'Bebida com canela feita de doses iguais de café, leite e espuma', 9.90, '/img/capuccino.png'),
    (N'Macchiato',            N'Café expresso misturado com um pouco de leite quente e espuma', 9.90, '/img/macchiato.png'),
    (N'Mocaccino',            N'Café expresso com calda de chocolate, pouco leite e espuma', 9.90, '/img/mocaccino.png'),
    (N'Chocolate Quente',     N'Bebida feita com chocolate dissolvido no leite quente e café', 9.90, '/img/chocolate-quente.png'),
    (N'Cubano',               N'Drink gelado de café expresso com rum, creme de leite e hortelã', 9.90, '/img/cubano.png'),
    (N'Havaiano',             N'Bebida adocicada preparada com café e leite de coco', 9.90, '/img/havaiano.png'),
    (N'Árabe',                N'Bebida preparada com grãos de café árabe e especiarias', 9.90, '/img/arabe.png'),
    (N'Irlandês',             N'Bebida a base de café, uísque irlandês, açúcar e chantilly', 9.90, '/img/irlandes.png');

INSERT INTO dbo.cafe_tag (cafe_id, tag_id)
SELECT c.id, t.id
FROM (VALUES
    (N'Expresso Tradicional', N'Tradicional'),
    (N'Expresso Americano',   N'Tradicional'),
    (N'Expresso Cremoso',     N'Tradicional'),
    (N'Expresso Gelado',      N'Tradicional'), (N'Expresso Gelado',  N'Gelado'),
    (N'Café com Leite',       N'Tradicional'), (N'Café com Leite',   N'Com leite'),
    (N'Latte',                N'Tradicional'), (N'Latte',            N'Com leite'),
    (N'Capuccino',            N'Tradicional'), (N'Capuccino',        N'Com leite'),
    (N'Macchiato',            N'Tradicional'), (N'Macchiato',        N'Com leite'),
    (N'Mocaccino',            N'Tradicional'), (N'Mocaccino',        N'Com leite'),
    (N'Chocolate Quente',     N'Especial'),    (N'Chocolate Quente', N'Com leite'),
    (N'Cubano',               N'Especial'),    (N'Cubano', N'Alcoólico'), (N'Cubano', N'Gelado'),
    (N'Havaiano',             N'Especial'),
    (N'Árabe',                N'Especial'),
    (N'Irlandês',             N'Especial'),    (N'Irlandês',         N'Alcoólico')
) AS v (cafe, tag)
JOIN dbo.cafe c ON c.nome = v.cafe
JOIN dbo.tag  t ON t.nome = v.tag;
GO

/* =====================================================================
   9. EXEMPLO: pedido das telas (1 Expresso Tradicional + 2 Latte)
   A aplicação, após autenticar, informa quem é o usuário da sessão:
       EXEC sp_set_session_context @key = N'usuario_id', @value = <id>;
   As triggers leem esse valor para preencher usuario_id nos logs.
   ===================================================================== */
SET XACT_ABORT ON;

DECLARE @cliente INT = (SELECT id FROM dbo.usuario WHERE email = 'cliente@email.com');
DECLARE @barista INT = (SELECT id FROM dbo.usuario WHERE email = 'barista@mycoffee.com');
DECLARE @pedido  BIGINT;

EXEC sp_set_session_context @key = N'usuario_id', @value = @cliente;

BEGIN TRY
    BEGIN TRANSACTION;

    INSERT INTO dbo.pedido (usuario_id, forma_pagamento_id, subtotal, taxa_entrega, previsao_min, previsao_max)
    SELECT @cliente, id, 29.70, 3.50, 20, 30
    FROM dbo.forma_pagamento WHERE codigo = 'CARTAO_CREDITO';

    SET @pedido = SCOPE_IDENTITY();

    INSERT INTO dbo.item_pedido (pedido_id, cafe_id, quantidade, preco_unitario)
    SELECT @pedido, c.id, v.qtd, c.preco
    FROM (VALUES (N'Expresso Tradicional', 1), (N'Latte', 2)) AS v (nome, qtd)
    JOIN dbo.cafe c ON c.nome = v.nome;

    INSERT INTO dbo.endereco_entrega (pedido_id, cep, logradouro, numero, complemento, bairro, cidade, uf)
    VALUES (@pedido, '09390120', N'Av. Antônia Rosa Fioravanti', '804', N'Fatec Mauá', N'Centro', N'Mauá', 'SP');

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- Funcionário logado muda o status: a trigger grava o antes/depois em log_alteracao
EXEC sp_set_session_context @key = N'usuario_id', @value = @barista;
UPDATE dbo.pedido SET status = 'EM_PREPARO' WHERE id = @pedido;
GO

/* =====================================================================
   10. CONSULTAS DE APOIO
   ===================================================================== */

-- Home: catálogo com as tags
-- SELECT c.id, c.nome, c.descricao, c.preco, c.imagem_url,
--        STRING_AGG(t.nome, ', ') WITHIN GROUP (ORDER BY t.id) AS tags   -- SQL Server 2017+
-- FROM dbo.cafe c
-- JOIN dbo.cafe_tag ct ON ct.cafe_id = c.id
-- JOIN dbo.tag t       ON t.id = ct.tag_id
-- WHERE c.ativo = 1
-- GROUP BY c.id, c.nome, c.descricao, c.preco, c.imagem_url;

-- Login: busca pelo e-mail (a verificação do hash é feita na aplicação)
-- SELECT id, nome, senha_hash, papel FROM dbo.usuario WHERE email = @email AND ativo = 1;

-- Tela de confirmação pelo código público da URL
-- SELECT e.logradouro, e.numero, e.bairro, e.cidade, e.uf,
--        p.previsao_min, p.previsao_max, f.descricao AS pagamento, p.total
-- FROM dbo.pedido p
-- JOIN dbo.endereco_entrega e ON e.pedido_id = p.id
-- JOIN dbo.forma_pagamento f  ON f.id = p.forma_pagamento_id
-- WHERE p.codigo = @codigo;

-- Histórico de status de um pedido, com quem alterou
-- SELECT l.data_hora, u.nome AS alterado_por, u.papel,
--        JSON_VALUE(l.dados_antigos, '$.status') AS de,
--        JSON_VALUE(l.dados_novos,   '$.status') AS para
-- FROM auditoria.log_alteracao l
-- LEFT JOIN dbo.usuario u ON u.id = l.usuario_id
-- WHERE l.tabela = 'pedido' AND l.chave = '1'
-- ORDER BY l.data_hora;
