-- Campos cadastrais complementares (todos opcionais; não altera dados existentes)

-- AlterTable
ALTER TABLE "users" ADD COLUMN "birthDate" DATE,
ADD COLUMN "specialty" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "workplaceName" TEXT,
ADD COLUMN "workplaceAddress" TEXT,
ADD COLUMN "workplacePhone" TEXT,
ADD COLUMN "workplaceCity" TEXT,
ADD COLUMN "workplaceUf" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN "sex" TEXT;
