-- AlterTable
ALTER TABLE "users" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "users" ADD COLUMN "trialEndsAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + interval '30 days');
ALTER TABLE "users" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "users" ADD COLUMN "stripeSubscriptionId" TEXT;
