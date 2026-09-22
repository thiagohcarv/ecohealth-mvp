# EcoHealth MVP — Status do Projeto

**Versão:** 0.1.0-alpha  
**Data:** Junho 2026  
**Fase:** MVP Alpha (pronto para testes com 20 médicos)

---

## Telas Implementadas (9/9)

| Rota | Tela | Status | Observação |
|------|------|--------|------------|
| `/` | Landing / Home | ✅ Pronto | Redirect para login |
| `/login` | Login médico | ✅ Pronto | JWT, validação CRM |
| `/cadastro` | Cadastro | ✅ Pronto | Email + CRM + CPF |
| `/verificar` | Verificação OTP | ✅ Pronto | Mock OTP: `123456` |
| `/dashboard` | Dashboard | ✅ Pronto | Lista consultas do dia |
| `/nova-consulta` | Nova Consulta | ✅ Pronto | Busca/cria paciente |
| `/gravacao` | Gravação + Transcrição + SOAP | ✅ Pronto | Fluxo completo com mocks |
| `/historico` | Histórico | ✅ Pronto | Lista + filtros |
| `/historico/[id]` | Detalhe Consulta | ✅ Pronto | SOAP completo editável |

---

## Funcionalidades Prontas

### Autenticação
- [x] Registro com e-mail, CRM, CPF
- [x] Login com JWT (24h de validade)
- [x] Verificação OTP por e-mail (mock `123456` em dev)
- [x] Middleware `authenticate` protegendo todas as rotas privadas
- [x] Rate limiting (200 req/15min)

### Gravação de Áudio
- [x] MediaRecorder API nativa (sem bibliotecas externas)
- [x] Waveform em tempo real via Web Audio API (AnalyserNode)
- [x] Timer de duração da gravação
- [x] Estados visuais: idle → recording → sending → done
- [x] Anéis de ripple animados durante gravação

### Transcrição Whisper (T08)
- [x] Integração OpenAI Whisper API (PT-BR, modelo `whisper-1`)
- [x] Upload multipart via `https` nativo (contorna bug do SDK com Node 24)
- [x] **Mock ativo:** retorna transcrição realista em PT-BR quando cota esgotada (429)
- [x] Retry automático 2x para erros de rede
- [x] Salva transcrição no banco (`AudioRecording.transcription`)
- [x] Persiste localmente (`localStorage`)

### Nota SOAP — GPT-4o (T11)
- [x] Integração OpenAI GPT-4o para geração estruturada
- [x] **Mock inteligente:** detecta keywords (cefaleia → G44.2, lombar → M54.5, tosse → J20.9)
- [x] Campos: Subjetivo / Objetivo / Avaliação / Plano
- [x] CID-10 sugerido automaticamente
- [x] Confiança da IA (0–100%)
- [x] Tabs editáveis com auto-save no localStorage
- [x] Persiste no banco (`SoapNote`)

### Backend API
- [x] 11 endpoints REST documentados em `server/API.md`
- [x] Validação com Zod em todas as rotas
- [x] PostgreSQL + Prisma ORM
- [x] Helmet, CORS, rate limiting

---

## Stack Técnica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | Next.js | 14.2.35 |
| UI | Tailwind CSS | 3.4 |
| Backend | Express | 4.21 |
| ORM | Prisma | 5.22 |
| Banco de Dados | PostgreSQL | 15+ |
| Linguagem | TypeScript | 5.7 |
| Auth | JWT (jsonwebtoken) | 9.0 |
| Transcrição | OpenAI Whisper | whisper-1 |
| IA Clínica | OpenAI GPT-4o | gpt-4o |
| Validação | Zod | 3.24 |
| Container DB | Docker | — |

---

## Como Rodar Localmente

```bash
# 1. PostgreSQL via Docker
docker run -d \
  --name ecohealth-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ecohealth_dev \
  -p 5433:5432 \
  postgres:15

# 2. Backend
cd server
cp ../.env.example .env   # preencher OPENAI_API_KEY e JWT_SECRET
npm install
npm run db:push
npm run dev               # http://localhost:3001

# 3. Frontend (outro terminal)
cd ..
npm install
npm run dev               # http://localhost:3000
```

---

## O Que Falta (Próximas Sprints)

### Sprint 2 — Produto
- [ ] **Assinatura digital** do médico na nota SOAP (CFM exige)
- [ ] **Upload S3 real** para armazenar gravações (LGPD/CFM)
- [ ] **Email real** de verificação OTP (Resend/SendGrid)
- [ ] **Dashboard** com dados reais (sem mock)
- [ ] **Histórico** integrado ao banco (hoje usa dados hardcoded)
- [ ] **Edição e re-geração** de SOAP após salvar

### Sprint 3 — Escala
- [ ] **Plano de assinatura** (Stripe)
- [ ] **Multi-tenancy** por clínica/consultório
- [ ] **Exportação PDF** da nota (para prontuário)
- [ ] **Integração HIS** (Hospital Information System) via HL7/FHIR
- [ ] **Busca semântica** no histórico

### Sprint 4 — Confiabilidade
- [ ] Testes automatizados (Jest + Supertest)
- [ ] CI/CD (GitHub Actions)
- [ ] Monitoramento (Sentry + Datadog)
- [ ] Backup automatizado do banco

---

## Credenciais de Desenvolvimento

| Item | Valor |
|------|-------|
| OTP (dev) | `123456` |
| DB | `postgresql://postgres:postgres@localhost:5433/ecohealth_dev` |
| Backend | `http://localhost:3001` |
| Frontend | `http://localhost:3000` |
