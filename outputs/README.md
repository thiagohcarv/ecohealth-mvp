# EcoHealth MVP

> Plataforma médica com IA para gravação de consultas e geração automática de notas SOAP.

**Stack:** Next.js 14 · Express · PostgreSQL · Prisma · OpenAI Whisper + GPT-4o  
**Status:** Alpha — pronto para testes com 20 médicos

---

## O que é

EcoHealth é um assistente clínico que permite ao médico:

1. **Gravar** a consulta no celular (microfone do browser)
2. **Transcrever** automaticamente com OpenAI Whisper (PT-BR)
3. **Gerar** nota SOAP estruturada com GPT-4o
4. **Revisar e editar** cada seção (S/O/A/P) antes de salvar
5. **Consultar** o histórico de todas as consultas

Sem app instalado. Funciona no browser mobile.

---

## Início Rápido

### Requisitos

- Node.js ≥ 18
- Docker (para PostgreSQL)
- Conta OpenAI (opcional — tem mock sem créditos)

### 1. Banco de Dados

```bash
docker run -d \
  --name ecohealth-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ecohealth_dev \
  -p 5433:5432 \
  postgres:15-alpine
```

### 2. Backend

```bash
cd server
cp .env.example .env        # edite JWT_SECRET e OPENAI_API_KEY
npm install
npm run db:push             # sincroniza schema
npm run dev                 # http://localhost:3001
```

### 3. Frontend

```bash
# na raiz do projeto
npm install
npm run dev                 # http://localhost:3000
```

### 4. Acesse

Abra **http://localhost:3000** no browser (ou no celular na mesma rede).

---

## Variáveis de Ambiente

### `server/.env`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ecohealth_dev
JWT_SECRET=troque-por-string-aleatoria-minimo-32-chars
PORT=3001
NODE_ENV=development
OPENAI_API_KEY=sk-proj-...   # opcional: mock ativo sem créditos
```

### `.env.local` (raiz)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Sem crédito OpenAI? Sem problema.

O projeto funciona 100% com **mocks realistas**:

- **Whisper mock:** transcrição médica em PT-BR pré-definida
- **GPT-4o mock:** detecta cefaleia/lombar/tosse → gera SOAP + CID-10 relevante
- **Ativação automática:** quando os créditos chegarem, o mock desliga sozinho

---

## Telas

| Rota | Descrição |
|------|-----------|
| `/login` | Autenticação com e-mail + senha |
| `/cadastro` | Registro com CRM |
| `/verificar` | OTP (use `123456` em dev) |
| `/dashboard` | Consultas do dia |
| `/nova-consulta` | Criar consulta + selecionar paciente |
| `/gravacao` | Gravar → Transcrever → Gerar SOAP |
| `/historico` | Lista de consultas |
| `/historico/[id]` | SOAP completo + edição |

---

## Estrutura do Projeto

```
ecohealth-mvp/
├── app/              # Next.js pages + hooks
├── components/       # UI reutilizável
├── lib/              # API client + auth helpers
├── server/           # Express API
│   ├── src/routes/   # Endpoints REST
│   ├── src/services/ # Whisper + GPT-4o
│   └── prisma/       # Schema do banco
└── outputs/          # Documentação exportada
```

---

## API

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/verify-otp
GET    /api/auth/me

GET    /api/consultations
POST   /api/consultations
GET    /api/consultations/:id
PATCH  /api/consultations/:id/status
PATCH  /api/consultations/:id/transcribe     ← Whisper
POST   /api/consultations/:id/generate-soap  ← GPT-4o
```

Documentação completa em `server/API.md`.

---

## Deploy

Veja `outputs/DEPLOYMENT_GUIDE.md` para instruções detalhadas de deploy em **Vercel + Supabase**.

---

## Contribuindo

Este é um MVP privado em fase alpha. Issues e PRs bem-vindos após acesso ao repositório.

---

## Licença

Proprietária — EcoHealth © 2026
