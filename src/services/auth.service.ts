import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db, schema } from "../db/index.js";
import { eq, and, gt } from "drizzle-orm";
import { AppError } from "../lib/errors.js";

const { users, refreshTokens } = schema;

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400, "WEAK_PASSWORD");
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError("Password must contain both letters and numbers", 400, "WEAK_PASSWORD");
  }
}

export async function register(username: string, password: string) {
  validatePassword(password);

  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) {
    throw new AppError("Username already exists", 409, "CONFLICT");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({ username, passwordHash }).returning({
    id: users.id,
    username: users.username,
    role: users.role,
  });

  return user;
}

export async function login(username: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    throw new AppError("Invalid credentials", 401, "UNAUTHORIZED");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError("Invalid credentials", 401, "UNAUTHORIZED");
  }

  return { id: user.id, username: user.username, role: user.role as "admin" | "user" };
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(refreshTokens).values({ userId, token, expiresAt });
  return token;
}

export async function refreshAccessToken(refreshToken: string): Promise<{ userId: string; username: string; role: string }> {
  const [record] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.token, refreshToken), gt(refreshTokens.expiresAt, new Date())))
    .limit(1);

  if (!record) {
    throw new AppError("Invalid or expired refresh token", 401, "INVALID_REFRESH");
  }

  // Refresh rotation: delete old token, issue new one
  await db.delete(refreshTokens).where(eq(refreshTokens.id, record.id));

  const [user] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
  if (!user) {
    throw new AppError("User not found", 401, "UNAUTHORIZED");
  }

  return { userId: user.id, username: user.username, role: user.role as "admin" | "user" };
}

export async function revokeRefreshTokens(userId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}

export async function seedAdmin() {
  const [existing] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (existing) return existing;

  const passwordHash = await bcrypt.hash("admin123", 10);
  return db.insert(users).values({
    username: "admin",
    passwordHash,
    role: "admin",
  }).returning();
}
