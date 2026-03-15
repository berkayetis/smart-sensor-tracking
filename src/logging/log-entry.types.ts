export type AppLogLevel = "log" | "warn" | "error";

export type AppLogActor = {
  userId: string | null;
  role?: string | null;
  companyId?: string | null;
};

export type AppLogEntry = {
  timestamp: string;
  level: AppLogLevel;
  context: string;
  event: string;
  actor: AppLogActor | null;
  extra: unknown;
};

function isLogLevel(value: unknown): value is AppLogLevel {
  return value === "log" || value === "warn" || value === "error";
}

function toActor(value: unknown): AppLogActor | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const actor = value as Record<string, unknown>;
  return {
    userId: typeof actor.userId === "string" ? actor.userId : null,
    role: typeof actor.role === "string" ? actor.role : null,
    companyId: typeof actor.companyId === "string" ? actor.companyId : null,
  };
}

export function toAppLogEntry(value: unknown): AppLogEntry | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.timestamp !== "string" || !isLogLevel(candidate.level) || typeof candidate.context !== "string") {
    return null;
  }

  const event =
    typeof candidate.event === "string"
      ? candidate.event
      : typeof candidate.message === "string"
        ? candidate.message.startsWith("event:")
          ? candidate.message.slice(6)
          : candidate.message
        : null;
  if (!event || event.trim().length === 0) {
    return null;
  }

  return {
    timestamp: candidate.timestamp,
    level: candidate.level,
    context: candidate.context,
    event,
    actor: toActor(candidate.actor),
    extra: candidate.extra ?? null,
  };
}
