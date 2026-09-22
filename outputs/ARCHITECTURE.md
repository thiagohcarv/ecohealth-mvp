# EcoHealth MVP — Arquitetura

---

## Diagrama de Pastas

```
ecohealth-mvp/
├── app/                          # Next.js App Router (frontend)
│   ├── page.tsx                  # Landing / redirect
│   ├── layout.tsx                # Layout global (fontes, meta)
│   ├── globals.css               # Design tokens, animações
│   ├── login/page.tsx            # Autenticação
│   ├── cadastro/page.tsx         # Registro médico
│   ├── verificar/page.tsx        # OTP e-mail
│   ├── dashboard/page.tsx        # Listagem do dia
│   ├── nova-consulta/page.tsx    # Seleção de paciente
│   ├── historico/
│   │   ├── page.tsx              # Lista de consultas
│   │   └── [id]/page.tsx         # Detalhe + SOAP completo
│   ├── gravacao/
│   │   ├── page.tsx              # Orquestrador do fluxo
│   │   └── components/
│   │       ├── AudioRecorder.tsx # UI de gravação (4 estados)
│   │       └── SoapNote.tsx      # Tabs S/O/A/P editáveis
│   └── hooks/
│       ├── useAudioRecorder.ts   # MediaRecorder + Web Audio API
│       ├── useWhisper.ts         # Upload áudio + retry
│       └── useSoapGenerator.ts  # Geração SOAP via API
│
├── components/
│   ├── EcoHealthLogo.tsx         # Logo SVG
│   ├── layout/MobileScreen.tsx   # Container mobile 390px
│   └── ui/
│       ├── BottomNav.tsx         # Navegação inferior
│       ├── Button.tsx            # Botão reutilizável
│       └── Input.tsx             # Input reutilizável
│
├── lib/
│   ├── api.ts                    # Cliente HTTP (fetch wrapper + auth headers)
│   └── auth.ts                  # Helpers de autenticação frontend
│
├── server/                       # Express API (backend)
│   ├── src/
│   │   ├── index.ts              # App Express (CORS, Helmet, rate limit)
│   │   ├── routes/
│   │   │   ├── auth.ts           # /api/auth/* (register, login, OTP)
│   │   │   └── consultations.ts  # /api/consultations/* (CRUD + IA)
│   │   ├── services/
│   │   │   ├── whisperService.ts       # OpenAI Whisper (+ mock 429)
│   │   │   └── soapGeneratorService.ts # GPT-4o SOAP (+ mock keywords)
│   │   ├── middleware/
│   │   │   └── auth.ts           # JWT middleware
│   │   └── lib/
│   │       ├── prisma.ts         # Singleton Prisma Client
│   │       └── jwt.ts            # sign/verify tokens
│   └── prisma/
│       └── schema.prisma         # Schema do banco
│
└── outputs/                      # Documentação exportada
    ├── PROJECT_STATUS.md
    ├── DEPLOYMENT_GUIDE.md
    └── ARCHITECTURE.md
```

---

## Fluxo de Dados — Frontend ↔ Backend ↔ DB

### Fluxo de Autenticação

```
Browser                    Express API               PostgreSQL
  │                             │                        │
  ├─ POST /api/auth/login ──────►                        │
  │   { email, senha }          │                        │
  │                             ├─ SELECT users ─────────►
  │                             ◄─ { id, hash } ─────────┤
  │                             │  bcrypt.compare()       │
  │                             │  signToken(userId)      │
  ◄─ { token, nome, crm } ──────┤                        │
  │                             │                        │
  ├─ localStorage("eco_token")  │                        │
```

### Fluxo Principal — Gravação → Transcrição → SOAP

```
Browser (gravacao/page.tsx)        Express API           PostgreSQL
  │                                     │                    │
  │ 1. useAudioRecorder.startRecording()│                    │
  │    MediaRecorder + Web Audio API    │                    │
  │                                     │                    │
  │ 2. stopRecording() → Blob           │                    │
  │                                     │                    │
  │ 3. PATCH /api/consultations/:id/transcribe              │
  │    FormData { audioFile: Blob } ────►                    │
  │                                     ├─ multer: tmp file  │
  │                                     ├─ whisperService    │
  │                                     │  └─ OpenAI API     │
  │                                     │     (ou mock 429)  │
  │                                     ├─ UPSERT audio_     │
  │                                     │  recordings ───────►
  ◄─ { transcription, duration } ───────┤                    │
  │                                     │                    │
  │ 4. POST /api/consultations/:id/generate-soap            │
  │    { } (sem body) ──────────────────►                    │
  │                                     ├─ SELECT audio_     │
  │                                     │  recordings ───────►
  │                                     │◄───────────────────┤
  │                                     ├─ soapGeneratorService
  │                                     │  └─ GPT-4o API     │
  │                                     │     (ou mock)      │
  │                                     ├─ UPSERT soap_notes►
  │                                     ├─ UPDATE consultations
  ◄─ { soapNote: { S, O, A, P, CID } } ─┤                    │
  │                                     │                    │
  │ 5. SoapNote.tsx: tabs editáveis     │                    │
  │    auto-save localStorage           │                    │
```

---

## Banco de Dados — Modelo Entidade-Relacionamento

```
users (médicos)
  ├── id, email, name, crm, password, isVerified
  │
  ├──< patients (1:N)
  │     └── id, name, cpf, dateOfBirth, doctorId
  │
  └──< consultations (1:N)
        ├── id, date, status, chiefComplaint
        ├── doctorId → users
        ├── patientId → patients
        │
        ├──< audioRecording (1:1)
        │     ├── s3Key, s3Bucket, durationSec
        │     ├── transcription (TEXT)
        │     └── transcriptionStatus (PENDING/COMPLETED/ERROR)
        │
        └──< soapNote (1:1)
              ├── subjective, objective, assessment, plan (TEXT)
              ├── icd10Codes (String[])
              ├── confidence (Float)
              ├── model ("gpt-4o" | "mock")
              └── soapStatus (PENDING/COMPLETED/ERROR)
```

---

## Estrutura de Componentes Reutilizáveis

### Layout
```
MobileScreen
  └── Wrapper 390px max-width, min-height 100dvh
      Fundo branco, shadow lateral
```

### Navegação
```
BottomNav
  ├── Ícone Dashboard (/dashboard)
  ├── Ícone + Nova Consulta (/nova-consulta) — ação central
  └── Ícone Histórico (/historico)
```

### UI Primitivos
```
Button
  ├── Props: children, loading, disabled, icon, variant
  └── Variantes: primary (gradient), outline, ghost

Input
  ├── Props: label, error, icon, type
  └── Estilos: input-shadow, focus:border-primary
```

### Específicos de Gravação
```
AudioRecorder
  ├── Props: consultationId, onTranscriptionComplete
  ├── Estados: default → recording → sending → done
  ├── Usa: useAudioRecorder + useWhisper
  └── Web Audio API: AnalyserNode → waveform em tempo real

SoapNote
  ├── Props: soapData, consultationId, onChange
  ├── Tabs: S / O / A / P
  ├── Textarea editável por tab
  └── CID-10 chips + % confiança
```

---

## Decisões de Arquitetura

| Decisão | Escolha | Razão |
|---------|---------|-------|
| API HTTP no serviço Whisper | `https` nativo + `form-data` | Bug ECONNRESET do OpenAI SDK com Node 24 |
| Mock por keyword | Detecta cefaleia/lombar/tosse | SOAP mock relevante sem IA |
| `db push` vs migrations | `db push` em dev | Ambiente interativo bloqueado em CI |
| localStorage + DB | Ambos | Resiliência a falhas de rede |
| Mock automático em 429 | Fallback no serviço | Zero mudança frontend quando crédito chegar |
| `Suspense` em gravação | Envolta `useSearchParams` | Exigência do Next.js 14 App Router |

---

## API Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/register` | — | Registrar médico |
| POST | `/api/auth/login` | — | Login + JWT |
| POST | `/api/auth/verify-otp` | — | Verificar e-mail |
| POST | `/api/auth/refresh-otp` | — | Reenviar OTP |
| GET | `/api/auth/me` | ✅ | Dados do médico logado |
| GET | `/api/consultations` | ✅ | Listar consultas (paginado) |
| GET | `/api/consultations/:id` | ✅ | Detalhe da consulta |
| POST | `/api/consultations` | ✅ | Criar consulta |
| PATCH | `/api/consultations/:id/status` | ✅ | Atualizar status |
| PATCH | `/api/consultations/:id/transcribe` | ✅ | Upload áudio + Whisper |
| POST | `/api/consultations/:id/generate-soap` | ✅ | Gerar nota SOAP |
