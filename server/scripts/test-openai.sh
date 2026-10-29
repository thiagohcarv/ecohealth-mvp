#!/usr/bin/env bash
# Teste ponta a ponta da OpenAI: Whisper (transcrição) + GPT-4o (SOAP).
# Uso: bash server/scripts/test-openai.sh   (a partir da raiz do projeto)
set -u

ENV_FILE="$(dirname "$0")/../.env"
KEY=$(grep '^OPENAI_API_KEY=' "$ENV_FILE" | cut -d'=' -f2-)
[ -z "$KEY" ] && { echo "OPENAI_API_KEY nao encontrada em server/.env"; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "1/3 Gerando audio de teste (voz do macOS)..."
say -v Luciana -o "$TMP/consulta.wav" --data-format=LEI16@16000 \
  "Paciente relata dor de cabeça há três dias, sem febre. Pressão arterial cento e vinte por oitenta. Hipótese de cefaleia tensional. Prescrito dipirona seiscentos miligramas se dor, e retorno em sete dias." \
  2>/dev/null || { echo "Falha ao gerar audio (comando 'say')."; exit 1; }

echo "2/3 Whisper (whisper-1)..."
W=$(curl -s -w '\n%{http_code}' https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $KEY" \
  -F model=whisper-1 -F language=pt -F file=@"$TMP/consulta.wav")
CODE=$(echo "$W" | tail -n1); BODY=$(echo "$W" | sed '$d')
echo "   HTTP $CODE"
if [ "$CODE" != "200" ]; then
  echo "$BODY" | python3 -c 'import sys,json; e=json.load(sys.stdin).get("error",{}); print("   ERRO:", e.get("code"), "-", e.get("message"))' 2>/dev/null || echo "$BODY"
  [ "$CODE" = "429" ] && echo "   -> 429 normalmente = sem credito/quota. Confira platform.openai.com/settings/organization/billing"
  exit 1
fi
TEXT=$(echo "$BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["text"])')
echo "   Transcricao: $TEXT"

echo "3/3 GPT-4o gerando SOAP..."
PAYLOAD=$(python3 - "$TEXT" <<'PY'
import sys, json
print(json.dumps({
  "model": "gpt-4o",
  "response_format": {"type": "json_object"},
  "messages": [
    {"role": "system", "content": "Voce e um assistente medico. Gere uma nota SOAP em JSON com as chaves subjective, objective, assessment, plan, icd10Codes (lista)."},
    {"role": "user", "content": sys.argv[1]}
  ]}))
PY
)
G=$(curl -s -w '\n%{http_code}' https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$PAYLOAD")
CODE=$(echo "$G" | tail -n1); BODY=$(echo "$G" | sed '$d')
echo "   HTTP $CODE"
if [ "$CODE" != "200" ]; then
  echo "$BODY" | python3 -c 'import sys,json; e=json.load(sys.stdin).get("error",{}); print("   ERRO:", e.get("code"), "-", e.get("message"))' 2>/dev/null || echo "$BODY"
  exit 1
fi
echo "$BODY" | python3 -c 'import sys,json; print(json.dumps(json.loads(json.load(sys.stdin)["choices"][0]["message"]["content"]), indent=2, ensure_ascii=False))'
echo; echo "OK: Whisper + GPT-4o funcionando com a sua chave."
