import bcrypt from "bcryptjs";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { AppError } from "../lib/errors.js";

const { users } = schema;

export async function register(username: string, password: string) {
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
