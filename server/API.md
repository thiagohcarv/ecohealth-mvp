# EcoHealth API — Exemplos de uso

Base URL: `http://localhost:3001`

## Auth

### POST /api/auth/register
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dr.silva@hospital.com",
    "senha": "senha123",
    "nome": "João Silva",
    "crm": "123456",
    "uf": "SP",
    "cpf": "123.456.789-00",
    "telefone": "(11) 99999-9999"
  }'

# Resposta 201:
# { "success": true, "userId": "cuid...", "message": "Código enviado para o email." }
# DEV: código OTP logado no terminal do servidor
```

### POST /api/auth/login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "dr.silva@hospital.com", "senha": "senha123" }'

# Resposta 200:
# { "success": true, "token": "eyJ...", "userId": "...", "nome": "João Silva", "crm": "SP-123456" }
```

### POST /api/auth/verify-otp
```bash
curl -X POST http://localhost:3001/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{ "email": "dr.silva@hospital.com", "otp": "123456" }'

# Código mock alpha: sempre 123456
# Resposta 200:
# { "success": true, "token": "eyJ...", "userId": "...", "nome": "João Silva" }
```

### POST /api/auth/refresh-otp
```bash
curl -X POST http://localhost:3001/api/auth/refresh-otp \
  -H "Content-Type: application/json" \
  -d '{ "email": "dr.silva@hospital.com" }'
```

### GET /api/auth/me (protegida)
```bash
TOKEN="eyJ..."
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# { "success": true, "user": { "id": "...", "email": "...", "name": "...", "crm": "SP-123456" } }
```

## Consultas (todas protegidas)

### GET /api/consultations
```bash
curl http://localhost:3001/api/consultations \
  -H "Authorization: Bearer $TOKEN"

# Com filtros:
curl "http://localhost:3001/api/consultations?status=COMPLETED&limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/consultations
```bash
curl -X POST http://localhost:3001/api/consultations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "patientName": "Ana Souza", "chiefComplaint": "Cefaleia há 3 dias" }'

# Resposta 201:
# { "success": true, "consultation": { "id": "...", "status": "RECORDING", ... } }
```

### PATCH /api/consultations/:id/status
```bash
curl -X PATCH http://localhost:3001/api/consultations/CONSULTATION_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "COMPLETED" }'
```

### GET /api/consultations/:id
```bash
curl http://localhost:3001/api/consultations/CONSULTATION_ID \
  -H "Authorization: Bearer $TOKEN"
```

## Erros

Todos os erros retornam `{ "error": "mensagem", "code": "CODIGO_ERRO" }`:

| Code | Significado |
|------|-------------|
| `VALIDATION_ERROR` | Dados inválidos no body |
| `EMAIL_EXISTS` | Email já cadastrado |
| `CRM_EXISTS` | CRM já cadastrado |
| `INVALID_CREDENTIALS` | Email ou senha inválidos |
| `INVALID_OTP` | Código OTP inválido ou expirado |
| `TOKEN_MISSING` | Header Authorization ausente |
| `TOKEN_INVALID` | JWT inválido ou expirado |
| `NOT_FOUND` | Recurso não encontrado |
| `INTERNAL_ERROR` | Erro interno do servidor |

## Setup rápido para testar

```bash
# 1. Subir PostgreSQL (Docker)
docker run -d --name ecohealth-db \
  -e POSTGRES_DB=ecohealth_dev \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:15

# 2. Rodar migrations
cd server && npm run db:push

# 3. Iniciar servidor
npm run dev

# 4. Health check
curl http://localhost:3001/health
```
