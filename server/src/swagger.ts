import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "EcoHealth API",
      version: "0.1.0-alpha",
      description:
        "API do EcoHealth MVP — plataforma de documentação médica assistida por IA. " +
        "Grava consultas, transcreve com Whisper e gera notas SOAP com GPT-4o.",
      contact: { name: "EcoHealth Dev", email: "dev@ecohealth.com.br" },
    },
    servers: [
      ...(process.env["RENDER_EXTERNAL_URL"]
        ? [{ url: process.env["RENDER_EXTERNAL_URL"], description: "Produção (Render)" }]
        : []),
      { url: `http://localhost:${process.env["PORT"] ?? 3001}`, description: "Desenvolvimento local" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "JWT obtido em POST /api/auth/login ou POST /api/auth/verify-otp. " +
            'Enviar no header: `Authorization: Bearer <token>`',
        },
      },
      schemas: {
        // ── Shared ──────────────────────────────────────────────────────────
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Mensagem de erro" },
            code: { type: "string", example: "ERROR_CODE" },
          },
          required: ["error", "code"],
        },
        // ── Auth ────────────────────────────────────────────────────────────
        RegisterRequest: {
          type: "object",
          required: ["email", "senha", "nome", "crm", "uf"],
          properties: {
            email: { type: "string", format: "email", example: "dr.joao@hospital.com.br" },
            senha: { type: "string", minLength: 6, example: "minhaSenha123" },
            nome: { type: "string", example: "Dr. João Silva" },
            crm: { type: "string", example: "123456" },
            uf: { type: "string", minLength: 2, maxLength: 2, example: "SP" },
            cpf: { type: "string", example: "123.456.789-00" },
            telefone: { type: "string", example: "(11) 99999-9999" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "senha"],
          properties: {
            email: { type: "string", format: "email", example: "dr.joao@hospital.com.br" },
            senha: { type: "string", example: "minhaSenha123" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            token: { type: "string", example: "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjbHh..." },
            userId: { type: "string", example: "clx1234abcdef" },
            nome: { type: "string", example: "Dr. João Silva" },
            crm: { type: "string", example: "SP-123456" },
          },
        },
        OtpRequest: {
          type: "object",
          required: ["email", "otp"],
          properties: {
            email: { type: "string", format: "email", example: "dr.joao@hospital.com.br" },
            otp: { type: "string", minLength: 6, maxLength: 6, example: "123456" },
          },
        },
        LgpdConsentResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            hasConsent: { type: "boolean", example: true },
            consent: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string", example: "clx5678ghijkl" },
                acceptedAt: { type: "string", format: "date-time" },
                version: { type: "string", example: "1.0" },
              },
            },
          },
        },
        // ── Patient ─────────────────────────────────────────────────────────
        Patient: {
          type: "object",
          properties: {
            id: { type: "string", example: "clx9999mnop" },
            name: { type: "string", example: "Maria Oliveira" },
            dateOfBirth: { type: "string", format: "date", nullable: true, example: "1985-03-20" },
            cpf: { type: "string", nullable: true, example: "987.654.321-00" },
            phone: { type: "string", nullable: true, example: "(21) 98888-7777" },
            consultations: {
              type: "array",
              items: { type: "object", properties: { date: { type: "string", format: "date-time" } } },
            },
          },
        },
        CreatePatientRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 2, example: "Maria Oliveira" },
            dateOfBirth: { type: "string", format: "date", example: "1985-03-20" },
            cpf: { type: "string", example: "987.654.321-00" },
            phone: { type: "string", example: "(21) 98888-7777" },
          },
        },
        // ── Consultation ─────────────────────────────────────────────────────
        SoapNote: {
          type: "object",
          properties: {
            id: { type: "string" },
            subjective: { type: "string", example: "Paciente refere cefaleia há 3 dias..." },
            objective: { type: "string", example: "PA 130/85 mmHg, FC 80 bpm..." },
            assessment: { type: "string", example: "Cefaleia tensional episódica (G44.2)" },
            plan: { type: "string", example: "Dipirona 500mg 6/6h por 3 dias. Retorno em 7 dias." },
            icd10Codes: { type: "array", items: { type: "string" }, example: ["G44.2"] },
            confidence: { type: "number", example: 0.92 },
            model: { type: "string", example: "gpt-4o" },
            editedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        Consultation: {
          type: "object",
          properties: {
            id: { type: "string", example: "clxaabbccdd" },
            date: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: ["PENDING", "RECORDING", "PROCESSING", "COMPLETED", "FAILED", "SIGNED"],
              example: "COMPLETED",
            },
            chiefComplaint: { type: "string", nullable: true, example: "Dor de cabeça" },
            signedAt: { type: "string", format: "date-time", nullable: true },
            pdfPath: { type: "string", nullable: true },
            patient: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string", example: "Maria Oliveira" },
                cpf: { type: "string", nullable: true },
              },
            },
            soapNote: { $ref: "#/components/schemas/SoapNote", nullable: true },
            audioRecording: {
              type: "object",
              nullable: true,
              properties: {
                durationSec: { type: "number", nullable: true, example: 420 },
                transcription: { type: "string", nullable: true },
              },
            },
          },
        },
        CreateConsultationRequest: {
          type: "object",
          required: ["patientName"],
          properties: {
            patientName: { type: "string", minLength: 2, example: "Maria Oliveira" },
            patientId: {
              type: "string",
              description: "Se informado, usa paciente existente; ignora patientName para lookup.",
              example: "clx9999mnop",
            },
            chiefComplaint: { type: "string", example: "Dor de cabeça há 3 dias" },
          },
        },
        SoapEditRequest: {
          type: "object",
          properties: {
            subjective: { type: "string" },
            objective: { type: "string" },
            assessment: { type: "string" },
            plan: { type: "string" },
            icd10Codes: { type: "array", items: { type: "string" } },
          },
        },
        // ── Billing ──────────────────────────────────────────────────────────
        BillingStatus: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            plan: { type: "string", enum: ["trial", "pro"], example: "trial" },
            trialEndsAt: { type: "string", format: "date-time" },
            daysRemaining: { type: "number", example: 22 },
            isExpired: { type: "boolean", example: false },
          },
        },
      },
    },

    paths: {
      // ────────────────────────────────────────────────────────────────────────
      // HEALTH
      // ────────────────────────────────────────────────────────────────────────
      "/health": {
        get: {
          tags: ["Infraestrutura"],
          summary: "Health check",
          description: "Retorna status do servidor. Não exige autenticação.",
          responses: {
            200: {
              description: "Servidor OK",
              content: {
                "application/json": {
                  example: { status: "ok", timestamp: "2026-06-22T10:00:00.000Z", env: "development" },
                },
              },
            },
          },
        },
      },

      // ────────────────────────────────────────────────────────────────────────
      // AUTH
      // ────────────────────────────────────────────────────────────────────────
      "/api/auth/register": {
        post: {
          tags: ["Autenticação"],
          summary: "Cadastrar médico",
          description:
            "Cria uma nova conta de médico. Envia OTP de 6 dígitos para o email. " +
            "Em ambiente alpha o OTP é sempre **123456**.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } },
            },
          },
          responses: {
            201: {
              description: "Conta criada. OTP enviado.",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    userId: "clx1234abcdef",
                    message: "Código de verificação enviado para o email.",
                  },
                },
              },
            },
            400: { description: "Dados inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            409: {
              description: "Email, CRM ou CPF já cadastrado",
              content: {
                "application/json": {
                  examples: {
                    email: { value: { error: "Email já cadastrado", code: "EMAIL_EXISTS" } },
                    crm: { value: { error: "CRM já cadastrado", code: "CRM_EXISTS" } },
                  },
                },
              },
            },
          },
        },
      },

      "/api/auth/login": {
        post: {
          tags: ["Autenticação"],
          summary: "Login",
          description: "Autentica com email e senha. Retorna JWT.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } },
            },
          },
          responses: {
            200: {
              description: "Login bem-sucedido",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } },
              },
            },
            401: { description: "Credenciais inválidas", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/auth/verify-otp": {
        post: {
          tags: ["Autenticação"],
          summary: "Verificar OTP",
          description:
            "Valida o código de 6 dígitos enviado por email. Em alpha, `123456` funciona para qualquer conta. " +
            "Retorna JWT ao validar com sucesso.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/OtpRequest" } },
            },
          },
          responses: {
            200: {
              description: "OTP válido. JWT emitido.",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } },
              },
            },
            400: { description: "Código inválido ou expirado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/auth/refresh-otp": {
        post: {
          tags: ["Autenticação"],
          summary: "Reenviar OTP",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: { email: { type: "string", format: "email" } },
                },
              },
            },
          },
          responses: {
            200: { description: "Novo OTP enviado", content: { "application/json": { example: { success: true, message: "Novo código enviado." } } } },
            404: { description: "Usuário não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/auth/lgpd-consent": {
        post: {
          tags: ["Autenticação", "LGPD"],
          summary: "Registrar aceite LGPD",
          description:
            "Salva o consentimento LGPD do médico (imutável). Captura IP real e User-Agent. " +
            "Se já houver registro, retorna o existente sem criar duplicata.",
          security: [{ BearerAuth: [] }],
          responses: {
            201: {
              description: "Consentimento registrado",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    consent: { id: "clx5678", acceptedAt: "2026-06-22T12:00:00Z", version: "1.0", ipAddress: "177.10.0.1" },
                  },
                },
              },
            },
            200: { description: "Já havia consentimento (idempotente)", content: { "application/json": { example: { success: true, alreadyConsented: true } } } },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        get: {
          tags: ["Autenticação", "LGPD"],
          summary: "Verificar aceite LGPD",
          description: "Retorna se o médico já aceitou os termos LGPD e qual versão.",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Status do consentimento",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/LgpdConsentResponse" } },
              },
            },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/auth/me": {
        get: {
          tags: ["Autenticação"],
          summary: "Dados do usuário logado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Dados do médico",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    user: { id: "clx1234", email: "dr.joao@hospital.com.br", name: "Dr. João Silva", crm: "SP-123456", isVerified: true },
                  },
                },
              },
            },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ────────────────────────────────────────────────────────────────────────
      // PATIENTS
      // ────────────────────────────────────────────────────────────────────────
      "/api/patients": {
        get: {
          tags: ["Pacientes"],
          summary: "Listar pacientes",
          description: "Retorna pacientes do médico logado, ordenados por última atualização. Máximo 50 por chamada.",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "q",
              in: "query",
              description: "Filtro por nome (case-insensitive, partial match)",
              schema: { type: "string", example: "maria" },
            },
            {
              name: "limit",
              in: "query",
              description: "Número máximo de resultados (padrão: 30, máx: 50)",
              schema: { type: "integer", default: 30, maximum: 50 },
            },
          ],
          responses: {
            200: {
              description: "Lista de pacientes",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    patients: [
                      { id: "clx9999", name: "Maria Oliveira", dateOfBirth: "1985-03-20", consultations: [{ date: "2026-06-20T09:00:00Z" }] },
                    ],
                  },
                },
              },
            },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          tags: ["Pacientes"],
          summary: "Criar paciente",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/CreatePatientRequest" } },
            },
          },
          responses: {
            201: {
              description: "Paciente criado",
              content: {
                "application/json": {
                  example: { success: true, patient: { id: "clx9999", name: "Maria Oliveira", dateOfBirth: "1985-03-20T00:00:00Z" } },
                },
              },
            },
            400: { description: "Dados inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ────────────────────────────────────────────────────────────────────────
      // CONSULTATIONS
      // ────────────────────────────────────────────────────────────────────────
      "/api/consultations": {
        get: {
          tags: ["Consultas"],
          summary: "Listar consultas",
          description: "Retorna consultas do médico logado, ordenadas por data decrescente. Máximo 50 por chamada.",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              description: "Filtrar por status",
              schema: { type: "string", enum: ["PENDING", "RECORDING", "PROCESSING", "COMPLETED", "FAILED", "SIGNED"] },
            },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 50 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            200: {
              description: "Lista de consultas",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    total: 42,
                    consultations: [
                      {
                        id: "clxaabb",
                        date: "2026-06-22T09:00:00Z",
                        status: "COMPLETED",
                        chiefComplaint: "Cefaleia",
                        patient: { id: "clx9999", name: "Maria Oliveira", cpf: null },
                        soapNote: { id: "soap1", assessment: "G44.2", icd10Codes: ["G44.2"] },
                        audioRecording: { durationSec: 420 },
                      },
                    ],
                  },
                },
              },
            },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          tags: ["Consultas"],
          summary: "Criar consulta",
          description:
            "Cria uma nova consulta com status `RECORDING`. " +
            "Se `patientId` não for informado, busca paciente por nome (case-insensitive) ou cria um novo. " +
            "**Requer aceite LGPD** — retorna 403 `LGPD_CONSENT_REQUIRED` se não houver.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/CreateConsultationRequest" } },
            },
          },
          responses: {
            201: {
              description: "Consulta criada",
              content: {
                "application/json": {
                  example: { success: true, consultation: { id: "clxaabb", status: "RECORDING", patient: { id: "clx9999", name: "Maria Oliveira" } } },
                },
              },
            },
            400: { description: "Dados inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            403: {
              description: "LGPD não aceita",
              content: {
                "application/json": {
                  example: { error: "Consentimento LGPD necessário para continuar.", code: "LGPD_CONSENT_REQUIRED", consentUrl: "/lgpd" },
                },
              },
            },
          },
        },
      },

      "/api/consultations/{id}": {
        get: {
          tags: ["Consultas"],
          summary: "Detalhes de uma consulta",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Consulta completa com SOAP e áudio",
              content: {
                "application/json": {
                  example: { success: true, consultation: { id: "clxaabb", status: "COMPLETED", soapNote: {}, patient: {} } },
                },
              },
            },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/consultations/{id}/status": {
        patch: {
          tags: ["Consultas"],
          summary: "Atualizar status da consulta",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: {
                      type: "string",
                      enum: ["PENDING", "RECORDING", "PROCESSING", "COMPLETED", "FAILED", "SIGNED"],
                    },
                  },
                },
                example: { status: "COMPLETED" },
              },
            },
          },
          responses: {
            200: { description: "Status atualizado", content: { "application/json": { example: { success: true, consultation: { id: "clxaabb", status: "COMPLETED" } } } } },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/consultations/{id}/soap": {
        patch: {
          tags: ["Consultas"],
          summary: "Editar nota SOAP",
          description: "Atualiza um ou mais campos da nota SOAP. Campos omitidos não são alterados. Salva `editedAt`.",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SoapEditRequest" },
                example: { plan: "Dipirona 500mg 6/6h. Retorno em 7 dias se não melhorar." },
              },
            },
          },
          responses: {
            200: { description: "SOAP atualizado", content: { "application/json": { example: { success: true, soapNote: { id: "soap1", editedAt: "2026-06-22T15:00:00Z" } } } } },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Consulta ou SOAP não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/consultations/{id}/transcribe": {
        patch: {
          tags: ["Consultas", "IA"],
          summary: "Enviar áudio e transcrever",
          description:
            "Recebe arquivo de áudio (`multipart/form-data`), transcreve com Whisper e salva o resultado. " +
            "Atualiza status para `PROCESSING` durante a transcrição e `COMPLETED` ao terminar. " +
            "Limite: 50 MB. Formatos: webm, wav, mp3, ogg, mp4.",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["audioFile"],
                  properties: {
                    audioFile: { type: "string", format: "binary", description: "Arquivo de áudio da consulta" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Transcrição concluída",
              content: {
                "application/json": {
                  example: { success: true, transcription: "Paciente refere cefaleia há três dias...", duration: 420.5 },
                },
              },
            },
            400: { description: "Arquivo ausente ou inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            402: {
              description: "Cota OpenAI esgotada",
              content: {
                "application/json": {
                  example: { error: "Cota OpenAI esgotada. Adicione créditos em platform.openai.com/account/billing.", code: "QUOTA_EXCEEDED" },
                },
              },
            },
            404: { description: "Consulta não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/consultations/{id}/generate-soap": {
        post: {
          tags: ["Consultas", "IA"],
          summary: "Gerar nota SOAP com IA",
          description:
            "Usa GPT-4o para gerar nota SOAP estruturada a partir da transcrição. " +
            "Requer que a transcrição já exista (`PATCH /transcribe`). " +
            "Modelo preferido pode ser sobrescrito via header `X-AI-Model`.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            {
              name: "X-AI-Model",
              in: "header",
              required: false,
              description: "Modelo de IA a usar (padrão: gpt-4o)",
              schema: { type: "string", enum: ["gpt-4o", "claude-3-5-sonnet"] },
            },
          ],
          responses: {
            200: {
              description: "SOAP gerado",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    soapNote: {
                      id: "soap1",
                      subjective: "Paciente refere cefaleia há 3 dias, piora com luz...",
                      objective: "PA 120/80. Sem rigidez de nuca.",
                      assessment: "Cefaleia tensional (G44.2)",
                      plan: "Dipirona 500mg 6/6h. Retorno em 7 dias.",
                      icd10Codes: ["G44.2"],
                      confidence: 0.93,
                      model: "gpt-4o",
                    },
                  },
                },
              },
            },
            400: {
              description: "Transcrição indisponível",
              content: { "application/json": { example: { error: "Transcrição não disponível", code: "NO_TRANSCRIPTION" } } },
            },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            404: { description: "Consulta não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/consultations/{id}/sign": {
        post: {
          tags: ["Consultas"],
          summary: "Assinar consulta e gerar PDF",
          description:
            "Gera PDF assinado digitalmente (mock ICP-Brasil nesta versão) e atualiza status para `SIGNED`. " +
            "Retorna o arquivo PDF diretamente como `application/pdf`. " +
            "**Requer Plano Pro** — retorna 402 em trial expirado.",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "PDF assinado (download direto)",
              content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
            },
            400: {
              description: "SOAP não gerado ainda",
              content: { "application/json": { example: { error: "Nota SOAP não gerada ainda", code: "NO_SOAP_NOTE" } } },
            },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            402: {
              description: "Trial expirado / Plano Pro necessário",
              content: { "application/json": { example: { error: "Trial expirado. Assine o Plano Pro.", code: "PLAN_REQUIRED" } } },
            },
            404: { description: "Consulta não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ────────────────────────────────────────────────────────────────────────
      // BILLING
      // ────────────────────────────────────────────────────────────────────────
      "/api/billing/status": {
        get: {
          tags: ["Billing"],
          summary: "Status do plano",
          description: "Retorna o plano atual do médico (trial ou pro), dias restantes e se expirou.",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Status do plano",
              content: { "application/json": { schema: { $ref: "#/components/schemas/BillingStatus" } } },
            },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/billing/checkout": {
        post: {
          tags: ["Billing"],
          summary: "Criar sessão de checkout Stripe",
          description:
            "Gera uma URL de checkout do Stripe para assinar o Plano Pro (R$197/mês). " +
            "Retorna 400 se o médico já for Pro.",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "URL de checkout criada",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_...",
                    sessionId: "cs_test_a1b2c3",
                  },
                },
              },
            },
            400: {
              description: "Já é Pro",
              content: { "application/json": { example: { error: "Usuário já possui plano Pro", code: "ALREADY_PRO" } } },
            },
            401: { description: "Token inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/billing/webhook": {
        post: {
          tags: ["Billing"],
          summary: "Webhook Stripe",
          description:
            "Endpoint chamado pelo Stripe após eventos de pagamento. " +
            "Não requer autenticação Bearer — validação via payload Stripe. " +
            "Eventos suportados: `checkout.session.completed` (ativa Pro) e `customer.subscription.deleted` (reverte para trial).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: { type: "string", example: "checkout.session.completed" },
                    data: { type: "object", example: { userId: "clx1234" } },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Evento processado", content: { "application/json": { example: { success: true, handled: true } } } },
            400: { description: "Evento inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
