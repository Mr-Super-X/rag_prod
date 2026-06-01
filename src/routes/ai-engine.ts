import type { FastifyInstance } from "fastify";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { config } from "../config.js";
import {
  startMigration,
  runMigration,
  finalizeMigration,
  rollbackMigration,
  getMigrationProgress,
} from "../lib/vector-migration.js";
import { embedSingle } from "../pipeline/embedder.js";
import { retrieve } from "../services/retrieval.service.js";
import { generate } from "../pipeline/generator.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");

export async function aiEngineRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireAdmin);

  // 获取可用的 Ollama 模型列表
  app.get("/api/admin/ai-engine/models", async () => {
    try {
      const res = await fetch(`${config.OLLAMA_URL}/api/tags`);
      if (!res.ok) throw new Error(`Ollama tags failed: ${res.status}`);
      const data = (await res.json()) as { models?: { name: string }[] };
      const models = (data.models ?? []).map((m: { name: string }) => m.name);
      return { success: true, data: models };
    } catch {
      return { success: true, data: [] };
    }
  });

  // 获取当前 AI 引擎配置
  app.get("/api/admin/ai-engine/config", async () => {
    const deepseekKeyMasked = config.DEEPSEEK_API_KEY
      ? config.DEEPSEEK_API_KEY.slice(0, 4) + "****" + config.DEEPSEEK_API_KEY.slice(-4)
      : "";
    return {
      success: true,
      data: {
        embeddingModel: config.EMBEDDING_MODEL,
        llmProvider: config.LLM_PROVIDER,
        llmModel: config.LLM_MODEL,
        deepseekModel: config.DEEPSEEK_MODEL,
        deepseekKeyMasked,
        ollamaUrl: config.OLLAMA_URL,
      },
    };
  });

  // 更新 AI 引擎配置（写 .env + process.env）
  app.post("/api/admin/ai-engine/config", async (request) => {
    const body = request.body as {
      embeddingModel?: string;
      llmProvider?: string;
      llmModel?: string;
      deepseekModel?: string;
      apiKey?: string;
    };

    const lines: string[] = [];
    if (existsSync(envPath)) {
      const raw = readFileSync(envPath, "utf-8");
      const envMap = new Map<string, string>();
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          lines.push(line);
          continue;
        }
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) {
          lines.push(line);
          continue;
        }
        const key = trimmed.slice(0, eqIdx).trim();
        envMap.set(key, line);
      }

      const updates: Record<string, string> = {};
      if (body.embeddingModel) updates["EMBEDDING_MODEL"] = body.embeddingModel;
      if (body.llmProvider) updates["LLM_PROVIDER"] = body.llmProvider;
      if (body.llmModel) updates["LLM_MODEL"] = body.llmModel;
      if (body.deepseekModel) updates["DEEPSEEK_MODEL"] = body.deepseekModel;
      if (body.apiKey) updates["DEEPSEEK_API_KEY"] = body.apiKey;

      const newLines: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          newLines.push(line);
          continue;
        }
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) {
          newLines.push(line);
          continue;
        }
        const key = trimmed.slice(0, eqIdx).trim();
        if (key in updates) {
          newLines.push(`${key}=${updates[key]}`);
          delete updates[key];
        } else {
          newLines.push(line);
        }
      }
      // 追加新增的 key
      for (const [key, val] of Object.entries(updates)) {
        newLines.push(`${key}=${val}`);
      }

      writeFileSync(envPath, newLines.join("\n") + "\n");
    }

    // 同步到 process.env
    if (body.embeddingModel) process.env.EMBEDDING_MODEL = body.embeddingModel;
    if (body.llmProvider) process.env.LLM_PROVIDER = body.llmProvider;
    if (body.llmModel) process.env.LLM_MODEL = body.llmModel;
    if (body.deepseekModel) process.env.DEEPSEEK_MODEL = body.deepseekModel;
    if (body.apiKey) process.env.DEEPSEEK_API_KEY = body.apiKey;

    // 模型变更需要重启 Ollama 加载，其余热生效
    const needRestart = Boolean(body.llmModel || body.embeddingModel);

    return {
      success: true,
      data: { message: "配置已保存", needRestart },
    };
  });

  // 触发向量迁移（fire-and-forget）
  app.post("/api/admin/ai-engine/migrate/:kbId", async (request, reply) => {
    const { kbId } = request.params as { kbId: string };
    const body = request.body as { modelName?: string };
    const modelName = body.modelName ?? config.EMBEDDING_MODEL;

    await startMigration(kbId);

    // fire-and-forget，不 await
    runMigration(kbId, modelName)
      .then(() => finalizeMigration(kbId, "_v2"))
      .catch(async (err) => {
        try { await rollbackMigration(kbId); } catch { /* 回滚失败不掩盖 */ }
        throw err;
      })
      .catch(() => { /* fire-and-forget 静默处理 */ });

    return reply.status(202).send({ success: true, data: { status: "started" } });
  });

  // SSE 进度端点
  app.get("/api/admin/ai-engine/migrate/:kbId/progress", async (request, reply) => {
    const { kbId } = request.params as { kbId: string };

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let done = false;
    const interval = setInterval(() => {
      const progress = getMigrationProgress(kbId);
      if (!progress) return;

      send({
        completed: progress.completed,
        total: progress.total,
        percent: progress.percent,
        eta: progress.eta,
      });

      if (progress.status !== "migrating") {
        done = true;
        send({ done: true, status: progress.status });
        clearInterval(interval);
        reply.raw.end();
      }
    }, 1000);

    reply.raw.on("close", () => {
      clearInterval(interval);
      if (!done) reply.raw.end();
    });
  });

  // 基准测试
  app.post("/api/admin/ai-engine/benchmark", async (request) => {
    const body = request.body as { kbId: string; questions: string[] };
    const results: { question: string; answer: string; latencyMs: number }[] = [];

    for (const question of body.questions) {
      const start = Date.now();
      try {
        const sources = await retrieve(body.kbId, question);
        const context = sources
          .map((s, i) => `[${i + 1}] ${s.docFilename}\n${s.content}`)
          .join("\n\n");
        const answer = sources.length > 0
          ? await generate(context, question, [])
          : "当前知识库中未找到相关内容";
        results.push({
          question,
          answer,
          latencyMs: Date.now() - start,
        });
      } catch (err) {
        results.push({
          question,
          answer: `Error: ${err instanceof Error ? err.message : String(err)}`,
          latencyMs: Date.now() - start,
        });
      }
    }

    return { success: true, data: results };
  });
}
