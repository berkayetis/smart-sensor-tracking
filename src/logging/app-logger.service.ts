import { Injectable, LoggerService } from "@nestjs/common";
import * as fs from "node:fs";
import { AppLogActor, AppLogEntry, AppLogLevel } from "./log-entry.types";
import { getAppLogFilePath, getLogDirPath } from "./log-paths";

type LogEventOptions = {
  level?: AppLogLevel;
  context?: string;
  actor?: AppLogActor | null;
};

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logDir = getLogDirPath();
  private readonly logFile = getAppLogFilePath();

  constructor() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(message: string, context?: string): void {
    this.writeEntry({
      timestamp: new Date().toISOString(),
      level: "log",
      context: context ?? "Application",
      event: "application.log",
      actor: null,
      extra: { message },
    });
  }

  warn(message: string, context?: string): void {
    this.writeEntry({
      timestamp: new Date().toISOString(),
      level: "warn",
      context: context ?? "Application",
      event: "application.warn",
      actor: null,
      extra: { message },
    });
  }

  error(message: string, trace?: string, context?: string): void {
    this.writeEntry({
      timestamp: new Date().toISOString(),
      level: "error",
      context: context ?? "Application",
      event: "application.error",
      actor: null,
      extra: {
        message,
        trace: trace ?? null,
      },
    });
  }

  logEvent(
    event: string,
    payload: Record<string, unknown>,
    options?: LogEventOptions,
  ): void {
    this.writeEntry({
      timestamp: new Date().toISOString(),
      level: options?.level ?? "log",
      context: options?.context ?? "Event",
      event,
      actor: options?.actor ?? null,
      extra: payload,
    });
  }

  private writeEntry(entry: AppLogEntry): void {
    const line = JSON.stringify(entry);
    fs.appendFile(this.logFile, `${line}\n`, () => undefined);

    if (entry.level === "error") {
      console.error(line);
      return;
    }
    if (entry.level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }
}
