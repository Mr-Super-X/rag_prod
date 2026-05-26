import fs from "node:fs/promises";
import path from "node:path";

type SupportedType = "pdf" | "docx" | "md" | "txt";
type SupportedExt = ".pdf" | ".docx" | ".md" | ".txt";

const EXT_MAP: Record<string, SupportedType> = {
  ".pdf": "pdf",
  ".docx": "docx",
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
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
