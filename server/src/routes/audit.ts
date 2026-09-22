import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// ─── GET /api/audit ───────────────────────────────────────────────────────────
// Returns the authenticated doctor's own audit trail (paginated, newest first).

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const limitRaw = req.query["limit"];
  const offsetRaw = req.query["offset"];
  const action = typeof req.query["action"] === "string" ? req.query["action"] : undefined;

  const limit = Math.min(typeof limitRaw === "string" ? parseInt(limitRaw, 10) || 50 : 50, 100);
  const skip = typeof offsetRaw === "string" ? parseInt(offsetRaw, 10) || 0 : 0;

  try {
    const where = {
      userId: req.userId!,
      ...(action ? { action } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          success: true,
          metadata: true,
          createdAt: true,
          // ipAddress and userAgent omitted from list — accessible per-entry if needed
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({ success: true, logs, total });
  } catch (err) {
    console.error("audit logs:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

export default router;
