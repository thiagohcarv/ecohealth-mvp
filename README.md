# EcoHealth MVP

**Plataforma de documentação médica assistida por inteligência artificial.**

O EcoHealth permite que médicos gravem suas consultas em áudio, recebam transcrições automáticas via Whisper (OpenAI) e gerem notas SOAP estruturadas com GPT-4o — tudo em segundos, sem digitação.

> **Fase atual:** Alpha fechado com 20 médicos. Stack completo funcionando com mocks onde APIs externas não estão configuradas.

---

## Stack Técnico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | Express + TypeScript |
| ORM | Prisma 5 |
| Banco de dados | PostgreSQL 15 |
| IA — Transcrição | OpenAI Whisper (`whisper-1`) |
| IA — SOAP | OpenAI GPT-4o |
| Autenticação | JWT (jsonwebtoken) + OTP por email |
| PDF | PDFKit (mock ICP-Brasil) |
| Pagamentos | Stripe (mock checkout em alpha) |
| Testes E2E | Playwright |

---

## Pré-requisitos

- Node.js 18+
- Docker (para PostgreSQL local)
- Conta OpenAI com créditos (opcional — mocks automáticos sem chave)

---

## Rodar Localmente

### 1. Banco de dados (Docker)

```bash
docker run -d \
  --name ecohealth-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ecohealth_dev \
  -p 5433:5432 \
  postgres:15-alpine
```

### 2. Backend (Express + Prisma)

```bash
cd server
cp .env.example .env          # editar variáveis (ver seção abaixo)
npm install
npm run db:generate           # gera o Prisma Client
npm run db:migrate            # cria as tabelas
npm run dev                   # inicia em http://localhost:3001
```

### 3. Frontend (Next.js)

```bash
# na raiz do projeto
cp .env.example .env.local    # já tem NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev                   # inicia em http://localhost:3000
```

### 4. Testes E2E (Playwright)

Com o frontend rodando (`npm run dev`):

```bash
npm run test:e2e              # headless
npm run test:e2e:ui           # interface visual do Playwright
```

---

## Variáveis de Ambiente

### Frontend (`.env.local` na raiz)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `NEXT_PUBLIC_API_URL` | URL do backend Express | `http://localhost:3001` |
| `NEXT_PUBLIC_APP_URL` | URL do próprio frontend (CORS) | `http://localhost:3000` |

### Backend (`server/.env`)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL PostgreSQL (Docker local: `postgresql://postgres:postgres@localhost:5433/ecohealth_dev`) |
| `JWT_SECRET` | Sim | String aleatória ≥ 32 chars — `openssl rand -hex 32` |
| `NODE_ENV` | Não | `development` / `production` |
| `PORT` | Não | Porta do backend (padrão: `3001`) |
| `OPENAI_API_KEY` | Não | Chave OpenAI (`sk-proj-...`). Sem chave, mocks automáticos são usados |
| `ANTHROPIC_API_KEY` | Não | Fallback Claude 3.5 (Sprint 2) |
| `AWS_REGION` | Não | Região S3 para armazenamento de áudio (Sprint 2) |
| `AWS_ACCESS_KEY_ID` | Não | Credencial AWS S3 (Sprint 2) |
| `AWS_SECRET_ACCESS_KEY` | Não | Credencial AWS S3 (Sprint 2) |
| `S3_BUCKET_NAME` | Não | Nome do bucket S3 (padrão: `ecohealth-audio-dev`) |
| `NEXT_PUBLIC_APP_URL` | Não | URL do frontend para CORS (padrão: `http://localhost:3000`) |
| `MEMED_API_KEY` / `MEMED_SECRET_KEY` | Não | Prescrição Memed; sem elas a seção de prescrição não aparece |
| `MEMED_EXTERNAL_PREFIX` | Não | Prefixo dos ids externos na Memed (padrão: `ecohealth`) |
| `MEMED_API_URL` / `MEMED_SCRIPT_URL` | Não | URLs da Memed em produção (padrão: homologação) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Não | Envio real do código de verificação; sem elas, código fixo `123456` |
| `SIGNUP_ALLOWLIST` | Produção | E-mails/domínios liberados para cadastro (alpha por convite) |

> **Sem `OPENAI_API_KEY`:** transcrição e geração de SOAP retornam dados mockados. O fluxo completo do produto funciona para demonstração sem nenhuma chave configurada.

---

## Fluxo Completo do Produto

```
1. Médico acessa /lgpd
   └── Lê e aceita os Termos de Privacidade (LGPD v1.0)
       └── Consentimento salvo com IP + User-Agent + timestamp

2. Médico cria conta em /cadastro
   └── Preenche nome, CRM, UF, email, senha
       └── OTP de 6 dígitos enviado ao email
           └── Sem e-mail configurado (alpha): código fixo 123456

3. Verifica email em /verificar
   └── Digita OTP → conta verificada → JWT emitido

4. Dashboard /dashboard
   └── Resumo do dia: consultas, tempo poupado, SOAPs gerados
       └── Gráfico semanal e lista de últimas consultas

5. Nova Consulta /nova-consulta
   └── Busca paciente existente ou cadastra novo
       └── Informa queixa principal (opcional)
           └── Cria consulta com status RECORDING

6. Gravação /gravacao?id={consultationId}
   └── Grava áudio via MediaRecorder (WebM/Opus)
       └── Envia para PATCH /api/consultations/:id/transcribe
           └── Whisper transcreve em português
               └── GPT-4o gera nota SOAP estruturada
                   └── Status atualizado para COMPLETED

7. Visualização /historico/:id
   └── Médico revisa e edita S/O/A/P manualmente
       └── Auto-save com debounce de 2 segundos
           └── Assina e baixa PDF (botão Assinar)

8. Histórico /historico
   └── Lista todas as consultas com filtros por status e CID-10
       └── Busca por nome de paciente ou queixa

9. Configurações /configuracoes
   └── Idioma (PT/EN), modelo de IA, notificações
       └── Plano & Billing — upgrade para Pro (R$197/mês)
```

---

## Documentação da API

Com o backend rodando, acesse:

- **Swagger UI:** [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **OpenAPI JSON:** [http://localhost:3001/api/docs.json](http://localhost:3001/api/docs.json)

Para endpoints autenticados, clique em **Authorize** no Swagger e informe `Bearer <seu_token>`.

---

## Status do MVP

### Autenticação & Acesso
| Feature | Status | Observação |
|---------|--------|-----------|
| Cadastro de médico | ✅ Feito | |
| Login com email + senha | ✅ Feito | |
| OTP por email | ⚠️ Configurável | Envio real via Resend com `RESEND_API_KEY` + `EMAIL_FROM`; sem elas, código fixo `123456` (alpha) |
| JWT auth | ✅ Feito | |
| LGPD consent log | ✅ Feito | IP + User-Agent + timestamp |

### Consultas
| Feature | Status | Observação |
|---------|--------|-----------|
| Criar consulta | ✅ Feito | |
| Listar consultas com filtros | ✅ Feito | |
| Visualizar consulta com SOAP | ✅ Feito | |
| Gravação de áudio (MediaRecorder) | ✅ Feito | WebM/Opus |
| Transcrição Whisper | ✅ Feito | ⚠️ Mock sem `OPENAI_API_KEY` |
| Geração SOAP (GPT-4o) | ✅ Feito | ⚠️ Mock sem `OPENAI_API_KEY` |
| Edição manual SOAP + auto-save | ✅ Feito | Debounce 2s |
| Assinatura digital + PDF | ⚠️ Mock | ICP-Brasil real no Sprint 2 |
| CID-10 automático | ✅ Feito | Extraído pelo GPT-4o |

### Pacientes
| Feature | Status | Observação |
|---------|--------|-----------|
| Cadastro de paciente | ✅ Feito | |
| Busca por nome | ✅ Feito | |
| Histórico por paciente | ✅ Feito | |

### Infraestrutura
| Feature | Status | Observação |
|---------|--------|-----------|
| Rate limiting | ✅ Feito | 200 req/15min |
| Swagger / OpenAPI | ✅ Feito | `/api/docs` |
| Testes E2E (Playwright) | ✅ Feito | 5 testes dos fluxos críticos |
| Armazenamento S3 | ❌ Faltando | Sprint 2 |
| Email transacional | ⚠️ Configurável | Código de verificação via Resend (ver variáveis) |
| Stripe pagamentos reais | ⚠️ Mock | Webhook e checkout mock |
| Deploy produção | ✅ Feito | Vercel (frontend) + Railway (backend + Postgres) — ver [Deploy em Produção](#deploy-em-produção) |

---

## Deploy em Produção

| Camada | Plataforma | Endereço |
|--------|-----------|----------|
| Frontend | [Vercel](https://vercel.com) | `https://ecohealth-mvp.vercel.app` |
| Backend | [Railway](https://railway.com) — serviço `ecohealth-mvp` (Node, US West) | `https://ecohealth-mvp-production.up.railway.app` |
| Banco de dados | PostgreSQL no mesmo projeto Railway (com volume) | interno |

> O arquivo `server/render.yaml` é legado (uma configuração alternativa para o Render); o deploy em uso é o Railway.

### Backend no Railway

- Deploy automático a cada push na `main` (integração GitHub do Railway).
- O start segue o `server/Procfile`: `npx prisma migrate deploy && npm start` — as migrações pendentes são aplicadas antes de subir. Confira em **Deployments → View logs**, buscando por `migration`.
- Variáveis em **serviço → Variables** (lista comentada em `server/.env.production.example`). Mínimo obrigatório: `DATABASE_URL` (referência ao Postgres do projeto), `JWT_SECRET`, `ENCRYPTION_KEY`, `NODE_ENV=production`, `ALLOWED_ORIGINS` (URL da Vercel, sem barra final). Após alterar variáveis, clique em **Deploy** para aplicar.
- Saúde: `GET /health` deve responder `{"status":"ok",...}`.
- Usuário de teste: no **Console** do serviço, `npm run db:seed` (usa `SEED_USER_EMAIL`/`SEED_USER_PASSWORD`/`SEED_USER_CPF` se definidos).

### Frontend na Vercel

- Deploy automático a cada push na `main`. Root Directory = raiz do repositório (o `server/` é ignorado via `.vercelignore`).
- Variáveis: `NEXT_PUBLIC_API_URL` = URL do backend no Railway; `NEXT_PUBLIC_APP_URL` = URL da própria Vercel.

### Checklist pós-deploy

- [ ] `GET /health` no backend responde `200`
- [ ] Cadastro/login funcionam sem erros de CORS no console
- [ ] `ALLOWED_ORIGINS` no Railway inclui a URL exata da Vercel (`https://`, sem barra final)
- [ ] `JWT_SECRET` e `ENCRYPTION_KEY` são valores únicos gerados para produção
- [ ] `LOAD_TEST_MODE` ausente ou `false` em produção
- [ ] PDFs assinados ficam em `/tmp` do servidor, que é apagado a cada deploy no Railway (pendente: armazenamento persistente)

---

## Prescrição digital Memed

Integração conforme os guias **Primeiros passos** e **Boas Práticas de Integração** da Memed. Fica **desligada** enquanto as variáveis `MEMED_API_KEY` e `MEMED_SECRET_KEY` não estiverem definidas no backend: nesse caso a seção de prescrição não aparece na consulta.

| Parte | Arquivo | O que faz |
|-------|---------|-----------|
| Backend | `server/src/lib/memed.ts` | Consulta/cadastra o prescritor (external_id, nome, sobrenome, CPF, data de nascimento — RDC 1000/25 —, CRM+UF, especialidade e cidade quando encontradas) e obtém o token a cada atendimento. Chaves só no servidor. |
| Backend | `server/src/routes/memed.ts` | `/api/memed/config`, `/token` (+ dados do `setWorkplace`), dados do paciente para `setPaciente` (idExterno com prefixo), salvar (`prescricaoImpressa`) e excluir (`prescricaoExcluida`, soft delete) receitas. |
| Banco | migration `20261110120000_add_prescriptions` | Tabela `prescriptions` (payload do evento criptografado). |
| Frontend | `lib/memed.ts` | Script injetado 1x por sessão (`id="memed-prescricao-script"` + guarda `getElementById`), listeners 1x dentro de `core:moduleInit`, `setWorkplace`, abertura com `await setPaciente` + `await module.show()`. |
| Frontend | `components/memed/MemedPrescricao.tsx` | Seção "Prescrição" na tela da consulta (`/historico/[id]`): botão e receitas salvas. |
| Frontend | `components/DadosPrescritorForm.tsx` | No Perfil: CPF, data de nascimento, especialidade, cidade e local de atendimento do médico. |

**Ativar:** no Railway (serviço → Variables), definir `MEMED_API_KEY`, `MEMED_SECRET_KEY` e `MEMED_EXTERNAL_PREFIX` (homologação: chaves públicas da documentação). Em produção, também `MEMED_API_URL` e `MEMED_SCRIPT_URL` informadas pela Memed. A homologação da Memed fica indisponível das 0h às 6h em dias úteis e nos fins de semana.

---

## Estrutura do Projeto

```
ecohealth-mvp/
├── app/                    # Next.js App Router (frontend)
│   ├── cadastro/           # Tela de cadastro
│   ├── configuracoes/      # Configurações e billing
│   ├── dashboard/          # Dashboard principal
│   ├── gravacao/           # Gravação de áudio
│   ├── historico/          # Lista e detalhes de consultas
│   ├── lgpd/               # Termos de privacidade (LGPD)
│   ├── login/              # Login
│   ├── nova-consulta/      # Nova consulta
│   └── verificar/          # Verificação de OTP
├── components/             # Componentes React reutilizáveis
├── lib/                    # API client, auth helpers, i18n
├── e2e/                    # Testes Playwright
├── server/                 # Backend Express
│   ├── prisma/             # Schema e migrations
│   └── src/
│       ├── middleware/      # auth, lgpdRequired, checkPlan
│       ├── routes/          # auth, consultations, patients, billing
│       └── services/        # whisper, soapGenerator, pdfSigner, stripe
└── playwright.config.ts    # Configuração dos testes E2E
```

---

## Desenvolvimento

```bash
# Rodar tudo junto (dois terminais)
cd server && npm run dev    # terminal 1 → backend :3001
npm run dev                # terminal 2 → frontend :3000

# Prisma Studio (GUI do banco)
cd server && npm run db:studio   # http://localhost:5555

# Lint
npm run lint
```
