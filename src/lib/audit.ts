import { db, schema } from "../db/index.js";
import pino from "pino";
const logger = pino({ level: "info" });

export async function logAudit(
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  ip?: string,
): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      userId,
      action,
      resource,
      resourceId: resourceId || null,
      ip: ip || null,
    });
  } catch (err) {
    logger.error({ err, userId, action, resource }, "Audit log insert failed");
  }
}
