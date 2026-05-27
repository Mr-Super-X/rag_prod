import { execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";

const BACKUP_DIR = resolve("./backups");
const DATA_DIR = resolve("./data");
const RETENTION_DAYS = 7;
const PG_CONTAINER = "rag_prod-postgres-1";
const PG_USER = "raguser";
const PG_DB = "ragdb";

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function cleanOldBackups() {
  if (!existsSync(BACKUP_DIR)) return;
  const files = readdirSync(BACKUP_DIR);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const path = join(BACKUP_DIR, file);
    if (statSync(path).mtimeMs < cutoff) {
      unlinkSync(path);
      log(`Cleaned old backup: ${file}`);
    }
  }
}

async function gzipFile(src: string, dest: string): Promise<void> {
  const srcStream = createReadStream(src);
  const destStream = createWriteStream(dest);
  const gzip = createGzip();
  await pipeline(srcStream, gzip, destStream);
}

async function main() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  mkdirSync(BACKUP_DIR, { recursive: true });

  // 1. PostgreSQL dump
  log("Starting PostgreSQL backup...");
  const pgFile = join(BACKUP_DIR, `pg_${date}.sql`);
  execSync(`docker exec ${PG_CONTAINER} pg_dump -U ${PG_USER} ${PG_DB} > "${pgFile}"`, {
    stdio: "pipe",
  });
  log(`PG backup: ${pgFile}`);

  // 2. LanceDB backup
  log("Starting LanceDB backup...");
  const lancedbDir = join(DATA_DIR, "lancedb");
  if (existsSync(lancedbDir)) {
    const lancedbFile = join(BACKUP_DIR, `lancedb_${date}.tar.gz`);
    execSync(`tar -czf "${lancedbFile}" -C "${DATA_DIR}" lancedb`, { stdio: "pipe" });
    log(`LanceDB backup: ${lancedbFile}`);
  } else {
    log("LanceDB not found, skipping");
  }

  // 3. Uploads backup
  const uploadsDir = join(DATA_DIR, "uploads");
  if (existsSync(uploadsDir)) {
    const uploadsFile = join(BACKUP_DIR, `uploads_${date}.tar.gz`);
    execSync(`tar -czf "${uploadsFile}" -C "${DATA_DIR}" uploads`, { stdio: "pipe" });
    log(`Uploads backup: ${uploadsFile}`);
  }

  // 4. Clean old backups
  cleanOldBackups();

  log("Backup complete.");
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
