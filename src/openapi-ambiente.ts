// Valores fictícios para o gerador de OpenAPI passar na validação do
// ambiente; o banco nunca é acessado (NestFactory em modo preview).
process.env.DB_HOST ??= 'nao-usado';
process.env.DB_USER ??= 'nao-usado';
process.env.DB_PASSWORD ??= 'nao-usado';
process.env.JWT_SECRET ??= 'x'.repeat(32);
process.env.OPENAPI_SERVERS ??= 'http://localhost:3000';
