import * as path from "node:path";

export function getLogDirPath(): string {
  return path.resolve(process.cwd(), "logs");
}

export function getAppLogFilePath(): string {
  return path.resolve(getLogDirPath(), "app.jsonl");
}
