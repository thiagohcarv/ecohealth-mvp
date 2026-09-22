import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env["SEED_USER_EMAIL"] ?? "medico.teste@ecohealth.com.br";
  const senha = process.env["SEED_USER_PASSWORD"] ?? "TesteEco123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Usuário de teste já existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(senha, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Dr. Teste EcoHealth",
      crm: "SP-000000",
      password: passwordHash,
      isVerified: true,
    },
  });

  console.log(`[seed] Usuário de teste criado: ${user.email} (id: ${user.id})`);
  console.log(`[seed] Senha: ${senha}`);
  console.log("[seed] Troque a senha ou remova este usuário antes de abrir para produção real.");
}

main()
  .catch((err) => {
    console.error("[seed] Erro:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
