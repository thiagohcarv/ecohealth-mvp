# EcoHealth MVP — Guia de Deploy

---

## 1. Pré-requisitos

- Node.js ≥ 18 (recomendado: 22+)
- Docker (para PostgreSQL local) ou PostgreSQL 15+ instalado
- Conta OpenAI com créditos (para Whisper + GPT-4o reais)
- Conta Vercel (frontend) e Supabase (banco em produção)

---

## 2. Rodando Localmente (Desenvolvimento)

### Passo 1 — Clonar e instalar dependências

```bash
git clone <repo-url>
cd ecohealth-mvp

# Frontend
npm install

# Backend
cd server && npm install && cd ..
```

### Passo 2 — Banco de dados PostgreSQL via Docker

```bash
docker run -d \
  --name ecohealth-db \
  --restart unless-stopped \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ecohealth_dev \
  -p 5433:5432 \
  postgres:15-alpine
```

### Passo 3 — Variáveis de ambiente

**Backend** (`server/.env`):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ecohealth_dev
NODE_ENV=development
PORT=3001
JWT_SECRET=seu-secret-aqui-minimo-32-caracteres-use-openssl-rand
OPENAI_API_KEY=sk-proj-...
```

**Frontend** (`.env.local` na raiz):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Passo 4 — Sincronizar banco e iniciar servidores

```bash
# Sincronizar schema Prisma → PostgreSQL
cd server && npm run db:push && cd ..

# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
npm run dev
```

Acesse: **http://localhost:3000**

---

## 3. Adicionando Créditos OpenAI (Whisper Real + GPT-4o Real)

1. Acesse [platform.openai.com/account/billing](https://platform.openai.com/account/billing)
2. Adicione método de pagamento e créditos (mínimo $5)
3. Acesse [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
4. Crie uma nova chave (revogue a anterior se foi exposta)
5. Atualize `OPENAI_API_KEY` no `server/.env`
6. Reinicie o backend: `cd server && npm run dev`

O código **não precisa de nenhuma alteração** — os mocks desativam automaticamente quando a API responde com sucesso.

> **Custo estimado para MVP:**
> - Whisper: ~$0.006/min de áudio
> - GPT-4o: ~$0.005/consulta de 10min
> - 20 médicos × 20 consultas/dia × $0.011 = ~$4.40/dia

---

## 4. Deploy em Produção — Vercel + Supabase

### 4.1 Banco de Dados — Supabase

1. Crie projeto em [supabase.com](https://supabase.com)
2. Em **Settings → Database**, copie a `Connection string` (Transaction Pooler):
   ```
   postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
3. Guarde essa URL — será o `DATABASE_URL` de produção

### 4.2 Migrações no Supabase

```bash
cd server
# Aplica o schema atual no Supabase
DATABASE_URL="postgresql://postgres.xxx:senha@..." npx prisma db push
```

### 4.3 Backend — Vercel (Serverless) ou Railway

**Opção A: Railway (mais simples para Express)**

```bash
# Instalar CLI Railway
npm install -g @railway/cli
railway login

# Na pasta server/
cd server
railway init
railway up
```

Adicione as variáveis de ambiente no painel Railway:
```
DATABASE_URL=postgresql://...supabase...
JWT_SECRET=...
OPENAI_API_KEY=sk-proj-...
NODE_ENV=production
PORT=3001
```

**Opção B: Render.com**

1. Conecte o repositório GitHub
2. New Web Service → `server/` como root
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Adicione as env vars no painel

### 4.4 Frontend — Vercel

```bash
# Instalar CLI Vercel
npm install -g vercel

# Na raiz do projeto
vercel

# Ou via painel: importar repositório GitHub em vercel.com
```

**Variáveis de ambiente no Vercel:**
```
NEXT_PUBLIC_API_URL=https://ecohealth-api.railway.app
NEXT_PUBLIC_APP_URL=https://ecohealth.vercel.app
```

### 4.5 Checklist de Produção

- [ ] `NODE_ENV=production` no backend
- [ ] `JWT_SECRET` com 64+ caracteres aleatórios (`openssl rand -hex 32`)
- [ ] `OPENAI_API_KEY` válida com créditos
- [ ] CORS atualizado com URL real do frontend
- [ ] HTTPS em todos os endpoints
- [ ] Backup automático do Supabase ativado
- [ ] Rate limiting ajustado para produção
- [ ] Variáveis sensíveis **nunca** no repositório git

---

## 5. Variáveis de Ambiente Completas

### Backend (`server/.env`)

| Variável | Obrigatória | Descrição |
|----------|------------|-----------|
| `DATABASE_URL` | ✅ | Connection string PostgreSQL |
| `JWT_SECRET` | ✅ | Secret para assinar tokens (min. 32 chars) |
| `PORT` | — | Porta do servidor (padrão: 3001) |
| `NODE_ENV` | — | `development` ou `production` |
| `OPENAI_API_KEY` | ✅ para real | Chave OpenAI para Whisper + GPT-4o |
| `AWS_REGION` | — | Para upload S3 (Sprint 2) |
| `AWS_ACCESS_KEY_ID` | — | Para upload S3 (Sprint 2) |
| `AWS_SECRET_ACCESS_KEY` | — | Para upload S3 (Sprint 2) |
| `S3_BUCKET_NAME` | — | Para upload S3 (Sprint 2) |
| `ANTHROPIC_API_KEY` | — | Fallback Claude (Sprint 2) |

### Frontend (`.env.local`)

| Variável | Obrigatória | Descrição |
|----------|------------|-----------|
| `NEXT_PUBLIC_API_URL` | ✅ | URL do backend Express |
| `NEXT_PUBLIC_APP_URL` | — | URL própria do frontend |

---

## 6. Comandos Úteis

```bash
# Ver logs do banco
docker logs ecohealth-db

# Abrir Prisma Studio (GUI do banco)
cd server && npm run db:studio

# Recriar banco do zero
docker stop ecohealth-db && docker rm ecohealth-db
# Repita o docker run acima

# Build de produção frontend
npm run build && npm start

# Build de produção backend
cd server && npm run build && npm start
```
