# Load Tests (ECO-31)

Testes de carga com [k6](https://k6.io) para validar se o backend do EcoHealth
aguenta ~50 médicos usando a plataforma ao mesmo tempo. Cobrem os endpoints
mais pesados: login, consultas/pacientes e geração de nota SOAP (IA).

## ⚠️ Antes de rodar: rate limiting

O backend tem rate limits **por IP** para proteção contra abuso:

| Limiter | Limite padrão | Onde |
|---|---|---|
| Geral | 100 req / 15 min | todas as rotas (exceto `/health`) |
| Auth (falhas) | 5 falhas / 15 min | `/api/auth/*` (sucessos não contam) |
| IA | 10 chamadas / min | transcrição + geração de SOAP |
| Áudio | 3 acessos / min | download/streaming de áudio |

Como o k6 roda de **uma única máquina**, todo o tráfego do teste sai de **um
único IP** — na visão do backend, isso parece um único cliente fazendo
centenas de requests, não 50 médicos diferentes. Sem ajuste, o limite geral
(100 req/15min) é estourado nos primeiros segundos da rampa, e o resultado do
teste vira "quanto tempo até o rate limiter bloquear", não "o backend aguenta
50 usuários?".

**Solução:** o servidor tem um modo `LOAD_TEST_MODE` que eleva todos esses
limites (para ~100.000/janela) só quando explicitamente ativado. **Nunca
ative isso em produção.**

```bash
# server/.env (ou export na sessão do terminal)
LOAD_TEST_MODE=true
```

Reinicie o backend com essa variável antes de rodar qualquer teste desta
pasta. Sem ela, espere ver bastante `429` nos resultados — isso não significa
que o backend "caiu", significa que o rate limiter está fazendo o trabalho
dele.

## Instalação do k6

```bash
brew install k6
k6 version
```

## Rodando os testes

O backend precisa estar rodando (`npm run dev` dentro de `server/`) e
acessível em `http://localhost:3001` (ou defina `BASE_URL`).

```bash
npm run test:load:auth   # login — 50 VUs
npm run test:load:api    # consultas + pacientes — 50 VUs
npm run test:load:soap   # geração de SOAP — 10 VUs
npm run test:load        # fluxo completo (login→consulta→SOAP→PDF) — 20 VUs
```

Ou diretamente com o k6:

```bash
k6 run load-tests/auth.test.js
BASE_URL=http://staging.exemplo.com k6 run load-tests/full-flow.test.js
```

### Variáveis de ambiente úteis

| Variável | Padrão | Descrição |
|---|---|---|
| `BASE_URL` | `http://localhost:3001` | URL da API alvo |
| `TEST_PASSWORD` | `LoadTest123!` | Senha usada nas contas de teste |
| `LOAD_TEST_POOL_SIZE` | `5` | Quantas contas de teste usar (ver abaixo) |

## Como as contas de teste funcionam

Os testes não criam um usuário novo por VU — isso é inviável com o rate
limit de auth e desnecessário para medir a capacidade dos endpoints. Em vez
disso, cada script provisiona (registra se necessário + loga) um **pool de 5
contas fixas e determinísticas** (`loadtest0@ecohealth.dev` ...
`loadtest4@ecohealth.dev`) uma única vez em `setup()`, e os VUs
compartilham/reciclam essas contas via `__VU % POOL_SIZE`.

Isso é seguro para rodar repetidamente: como o limiter de auth só conta
tentativas com **falha** (`skipSuccessfulRequests: true`), logins bem-sucedidos
repetidos não consomem o limite. O pool foi calibrado em 5 justamente para
bater exatamente no teto de 5 falhas/15min mesmo no pior caso (reruns onde o
registro retorna `409 já existe` para as 5 contas).

As contas persistem no banco entre execuções — os dados criados (consultas,
notas SOAP, PDFs) também. Se quiser limpar, apague manualmente os pacientes
com nome contendo "Load Test" / "Fluxo Completo" no banco de desenvolvimento.

## Transcrição em modo mock (importante para soap.test.js e full-flow.test.js)

`generate-soap` exige uma transcrição existente, então esses dois testes
chamam `PATCH /:id/transcribe` primeiro com um arquivo de áudio fake. Se
`OPENAI_API_KEY` estiver configurada e válida no backend, isso dispara uma
chamada **real** à API do Whisper com um áudio inválido — o que falha e
derruba o setup do teste (além de gastar cota da OpenAI à toa).

Para load test, rode o backend **sem** `OPENAI_API_KEY` (ou com o valor
placeholder `your-openai-api-key-here`) — o `whisperService` cai
automaticamente em transcrição mock (instantânea, sem custo, sempre
bem-sucedida), que é exatamente o que se quer para medir a performance do
endpoint, não a latência da OpenAI.

## Arquivos

- `config.js` — configuração compartilhada (`BASE_URL`, stages, thresholds, pool de usuários, helpers de auth/multipart).
- `auth.test.js` — `POST /api/auth/login`, 50 VUs.
- `consultations.test.js` — `GET/POST /api/consultations`, `GET /api/consultations/:id`, `GET /api/patients`, 50 VUs.
- `soap.test.js` — `POST /api/consultations/:id/generate-soap`, 10 VUs simultâneos, threshold relaxado (IA é lenta).
- `full-flow.test.js` — login → criar consulta → transcrever → gerar SOAP → assinar PDF, 20 VUs.

## Interpretando os resultados

Ao final, o k6 imprime um resumo tipo:

```
✓ status é 200
✓ possui token no response

http_req_duration..............: avg=120ms p(95)=310ms p(99)=480ms
http_req_failed.................: 0.42% ✓ 21 ✗ 4998
```

- **Checks (✓/✗)** — as verificações de negócio (status esperado, campo
  presente etc). Muitos `✗` indicam respostas incorretas, não só lentidão.
- **`http_req_duration`** — tempo de resposta. `p(95)` e `p(99)` são os
  thresholds definidos em `config.js`.
- **`http_req_failed`** — taxa de requests com status de erro (4xx/5xx) ou
  falha de rede.

No final da execução, o k6 marca cada `threshold` com ✓ (passou) ou ✗
(falhou) e sai com código de saída não-zero se algum threshold falhar —
então esses scripts também servem como gate de CI, se desejado.

### Thresholds definidos

| Teste | p(95) | p(99) | Taxa de erro |
|---|---|---|---|
| auth, consultations, full-flow | < 500ms | < 1000ms | < 1% |
| soap (IA) | < 3000ms | — | < 5% |

**Passou** = a API respondeu dentro desses limites para a maioria das
requisições sob a carga simulada. **Falhou** = ou a API está lenta demais sob
carga, ou está devolvendo erros demais — olhe os checks e os logs do backend
para diferenciar as duas causas (e lembre-se do aviso sobre rate limiting no
topo deste arquivo antes de concluir que é falta de capacidade).
