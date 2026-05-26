import { seedAdmin } from "../src/services/auth.service.js";

async function main() {
  console.log("Seeding database...");
  const admin = await seedAdmin();
  console.log("Admin user created:", admin[0]?.username || "already exists");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
