import { buildApp } from "./app.js";
import { seedAdmin } from "./services/auth.service.js";

const app = await buildApp();

try {
  await seedAdmin();
  app.log.info("Admin user seeded");
} catch (err) {
  app.log.warn("Admin seeding skipped — may already exist");
}

try {
  await app.listen({ port: 3000, host: "0.0.0.0" });
  app.log.info("RAG Enterprise API running at http://localhost:3000");
  app.log.info("Swagger docs at http://localhost:3000/docs");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
