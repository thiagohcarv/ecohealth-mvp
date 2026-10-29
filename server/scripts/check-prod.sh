#!/usr/bin/env bash
# Confere se o backend de PRODUÇÃO já está na versão com aceite obrigatório (LGPD + Termos).
# Uso: bash server/scripts/check-prod.sh
# Usa a conta de TESTE (teste@ecohealth.com). A senha é digitada aqui e não fica gravada.
set -u
API="https://ecohealth-mvp-production.up.railway.app"
EMAIL="teste@ecohealth.com"

echo "1/4 Backend no ar? (GET /health)"
H=$(curl -s -m 20 -o /dev/null -w '%{http_code}' "$API/health")
[ "$H" = "200" ] && echo "   PASS (HTTP 200)" || { echo "   FAIL (HTTP $H) - backend fora do ar ou ainda subindo"; exit 1; }

read -r -s -p "Senha da conta $EMAIL: " PASS; echo
echo "2/4 Login"
L=$(curl -s -m 20 -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"email":sys.argv[1],"senha":sys.argv[2]}))' "$EMAIL" "$PASS")")
TOKEN=$(echo "$L" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
unset PASS
[ -z "$TOKEN" ] && { echo "   FAIL - login nao retornou token: $L"; exit 1; }
echo "   PASS"

echo "3/4 Aceite incompleto deve ser RECUSADO (prova que a versao nova esta no ar)"
R=$(curl -s -m 20 -w '\n%{http_code}' -X POST "$API/api/auth/lgpd-consent" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')
CODE=$(echo "$R" | tail -n1); BODY=$(echo "$R" | sed '$d')
if [ "$CODE" = "400" ] && echo "$BODY" | grep -q "CONSENT_INCOMPLETE"; then
  echo "   PASS - 400 CONSENT_INCOMPLETE (versao nova no ar)"
else
  echo "   FAIL - HTTP $CODE: $BODY"
  echo "   -> Provavel que o deploy do Railway ainda seja o antigo. Espere ficar 'Active' e rode de novo."
  exit 1
fi

echo "4/4 Estado do aceite desta conta (GET /api/auth/lgpd-consent)"
curl -s -m 20 "$API/api/auth/lgpd-consent" -H "Authorization: Bearer $TOKEN"; echo
echo; echo "OK: backend de producao esta na versao nova."
