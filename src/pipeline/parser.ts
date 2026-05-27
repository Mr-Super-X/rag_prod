import fs from "node:fs/promises";
import path from "node:path";

type SupportedType = "pdf" | "docx" | "xlsx" | "pptx" | "md" | "txt";
type SupportedExt = ".pdf" | ".docx" | ".xlsx" | ".pptx" | ".md" | ".txt";

const EXT_MAP: Record<string, SupportedType> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".xlsx": "xlsx",
  ".pptx": "pptx",
  ".md": "md",
  ".txt": "txt",
};

function getFileType(ext: string): SupportedType {
  const t = EXT_MAP[ext.toLowerCase()];
  if (!t) throw new Error(`Unsupported file type: ${ext}`);
  return t;
}

async function parsePDF(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const pdfMod = await import("pdf-parse");
  const fn = (pdfMod as { default?: (buf: Buffer) => Promise<{ text: string }> }).default;
  if (!fn) throw new Error("pdf-parse not available");
  const result = await fn(buffer);
  return result.text || "";
}

async function parseDocx(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buffer as unknown as Buffer });
  return result.value;
}

async function parseXlsx(filePath: string): Promise<string> {
  const XLSX = await import("xlsx");
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const texts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_csv(sheet);
    if (data.trim()) texts.push(`## ${sheetName}\n${data}`);
  }
  return texts.join("\n\n") || " ";
}

async function parsePptx(filePath: string): Promise<string> {
  // PPTX 是 ZIP 包，内部 XML 文件包含文本
  const { execSync } = await import("node:child_process");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const os = await import("node:os");
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "pptx-"));
  try {
    execSync(`powershell Expand-Archive -Path "${filePath}" -DestinationPath "${tmpDir}" -Force`, { stdio: "pipe" });
  } catch {
    // 尝试用 unzip
    try { execSync(`unzip -o "${filePath}" -d "${tmpDir}"`, { stdio: "pipe" }); } catch { return ""; }
  }

  // 读取幻灯片文本
  const slidesDir = path.join(tmpDir, "ppt", "slides");
  let text = "";
  try {
    const files = await fs.readdir(slidesDir);
    for (const file of files.sort()) {
      if (!file.startsWith("slide") || !file.endsWith(".xml")) continue;
      const xml = await fs.readFile(path.join(slidesDir, file), "utf-8");
      const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
      if (matches) {
        const slideText = matches.map((m) => m.replace(/<\/?a:t[^>]*>/g, "")).join(" ");
        if (slideText.trim()) text += `\n${slideText}`;
      }
    }
    rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* no slides */ }
  return text.trim() || " ";
}

export async function parseFile(filePath: string): Promise<{ text: string; fileType: SupportedType }> {
  const ext = path.extname(filePath) as SupportedExt;
  const fileType = getFileType(ext);

  switch (fileType) {
    case "txt":
    case "md": {
      const text = await fs.readFile(filePath, "utf-8");
      return { text, fileType };
    }
    case "pdf": {
      const text = await parsePDF(filePath);
      return { text, fileType };
    }
    case "docx": {
      const text = await parseDocx(filePath);
      return { text, fileType };
    }
    case "xlsx": {
      const text = await parseXlsx(filePath);
      return { text, fileType };
    }
    case "pptx": {
      const text = await parsePptx(filePath);
      return { text, fileType };
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
