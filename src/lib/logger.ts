import fs from "node:fs";
import path from "node:path";

const logDir = path.resolve("./logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `app-${new Date().toISOString().slice(0, 10)}.log`);

export const loggerConfig = {
  level: process.env.LOG_LEVEL || "info",
  redact: ["req.headers.authorization"],
  transport: {
    targets: [
      // 控制台输出（开发友好）
      {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        level: "info",
      },
      // 文件输出（持久化）
      {
        target: "pino/file",
        options: { destination: logFile, mkdir: true },
        level: "info",
      },
    ],
  },
};
