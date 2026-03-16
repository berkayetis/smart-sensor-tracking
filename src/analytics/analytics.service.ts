import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "node:fs";
import { PrismaService } from "../database/prisma.service";
import { AppLoggerService } from "../logging/app-logger.service";
import { AppLogEntry, toAppLogEntry } from "../logging/log-entry.types";
import { getAppLogFilePath } from "../logging/log-paths";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { resolveDateRange } from "../common/utils/date-range.util";
import { Role } from "../iam/roles.enum";
import { LogEventsQueryDto } from "./dto/log-events-query.dto";

export type LogViewPrediction = {
  windowHours: number;
  last24hTotalViews: number;
  last24hHourlyAverage: number;
  predictedNextHourViews: number;
  generatedAt: string;
};

export type UserLogViewStat = {
  userId: string;
  email: string;
  count: number;
};

@Injectable()
export class AnalyticsService {
  private readonly logFilePath = getAppLogFilePath();

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  async trackLogView(userId: string): Promise<{
    userId: string;
    timestamp: number;
    action: "viewed_logs";
  }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const persistedAt = new Date(timestamp * 1000);
    const action = "viewed_logs" as const;
    await this.prisma.logViewEvent.create({
      data: {
        userId,
        action,
        timestamp: persistedAt,
      },
    });

    this.logger.logEvent("viewed_logs", {
      user_id: userId,
      timestamp,
      action,
    }, {
      actor: {
        userId,
      },
    });

    const record = { userId, timestamp, action };
    return record;
  }

  async getHourlyStats(
    auth: AuthContext,
    from?: string,
    to?: string,
  ): Promise<Array<{ hourStart: string; count: number }>> {
    if (auth.role === Role.USER) {
      throw new ForbiddenException("Insufficient role permissions");
    }
    if (auth.role === Role.COMPANY_ADMIN && !auth.companyId) {
      return [];
    }

    const { fromDate, toDate } = resolveDateRange(from, to, 7 * 86400000);
    const where = {
      action: "viewed_logs",
      timestamp: {
        gte: fromDate,
        lte: toDate,
      },
      ...(auth.role === Role.COMPANY_ADMIN
        ? {
            user: {
              companyId: auth.companyId,
            },
          }
        : {}),
    };

    const rows = await this.prisma.logViewEvent.findMany({
      where: {
        ...where,
      },
      orderBy: { timestamp: "asc" },
      select: {
        timestamp: true,
      },
    });

    const byHour = new Map<string, number>();
    for (const row of rows) {
      const hour = new Date(row.timestamp);
      hour.setUTCMinutes(0, 0, 0);
      const key = hour.toISOString();
      byHour.set(key, (byHour.get(key) ?? 0) + 1);
    }

    return Array.from(byHour.entries()).map(([hourStart, count]) => ({
      hourStart,
      count,
    }));
  }

  async getUserStats(
    auth: AuthContext,
    from?: string,
    to?: string,
    limit?: number,
  ): Promise<UserLogViewStat[]> {
    if (auth.role === Role.USER) {
      throw new ForbiddenException("Insufficient role permissions");
    }
    if (auth.role === Role.COMPANY_ADMIN && !auth.companyId) {
      return [];
    }

    const normalizedLimit = Math.min(Math.max(limit ?? 100, 1), 500);
    const { fromDate, toDate } = resolveDateRange(from, to, 7 * 86400000);
    const where = {
      action: "viewed_logs",
      timestamp: {
        gte: fromDate,
        lte: toDate,
      },
      ...(auth.role === Role.COMPANY_ADMIN
        ? {
            user: {
              companyId: auth.companyId,
            },
          }
        : {}),
    };

    const groupedRows = await this.prisma.logViewEvent.groupBy({
      by: ["userId"],
      where: {
        ...where,
      },
      _count: {
        _all: true,
      },
    });

    const sortedRows = groupedRows
      .sort((left, right) => right._count._all - left._count._all)
      .slice(0, normalizedLimit);
    const userIds = sortedRows.map((row) => row.userId);
    if (userIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user.email]));
    return sortedRows.map((row) => ({
      userId: row.userId,
      email: userMap.get(row.userId) ?? "unknown",
      count: row._count._all,
    }));
  }

  async getUserStatById(
    auth: AuthContext,
    userId: string,
    from?: string,
    to?: string,
  ): Promise<UserLogViewStat> {
    if (auth.role === Role.USER) {
      throw new ForbiddenException("Insufficient role permissions");
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        companyId: true,
      },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (auth.role === Role.COMPANY_ADMIN && user.companyId !== auth.companyId) {
      throw new ForbiddenException("Insufficient permission for this user");
    }

    const { fromDate, toDate } = resolveDateRange(from, to, 7 * 86400000);
    const count = await this.prisma.logViewEvent.count({
      where: {
        userId,
        action: "viewed_logs",
        timestamp: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    return {
      userId: user.id,
      email: user.email,
      count,
    };
  }

  async getNextHourPrediction(auth: AuthContext): Promise<LogViewPrediction> {
    if (auth.role === Role.USER) {
      throw new ForbiddenException("Insufficient role permissions");
    }

    const windowHours = 24;
    const generatedAt = new Date();
    const fromDate = new Date(generatedAt.getTime() - windowHours * 60 * 60 * 1000);
    const toDate = generatedAt;

    if (auth.role === Role.COMPANY_ADMIN && !auth.companyId) {
      return {
        windowHours,
        last24hTotalViews: 0,
        last24hHourlyAverage: 0,
        predictedNextHourViews: 0,
        generatedAt: generatedAt.toISOString(),
      };
    }

    const where = {
      action: "viewed_logs",
      timestamp: {
        gte: fromDate,
        lte: toDate,
      },
      ...(auth.role === Role.COMPANY_ADMIN
        ? {
            user: {
              companyId: auth.companyId,
            },
          }
        : {}),
    };

    const last24hTotalViews = await this.prisma.logViewEvent.count({
      where: {
        ...where,
      },
    });
    const last24hHourlyAverage = last24hTotalViews / windowHours;
    const predictedNextHourViews = Math.max(0, Math.round(last24hHourlyAverage));

    return {
      windowHours,
      last24hTotalViews,
      last24hHourlyAverage,
      predictedNextHourViews,
      generatedAt: generatedAt.toISOString(),
    };
  }

  async getLogEvents(query: LogEventsQueryDto): Promise<AppLogEntry[]> {
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const fromDate = query.from ? new Date(query.from) : null;
    const toDate = query.to ? new Date(query.to) : null;
    const eventFilter = query.event?.trim();

    if (!fs.existsSync(this.logFilePath)) {
      return [];
    }

    const content = await fs.promises.readFile(this.logFilePath, "utf-8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const events: AppLogEntry[] = [];

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        this.logger.warn(`Skipping malformed log line at index ${index + 1}`, "AnalyticsService");
        continue;
      }

      const entry = toAppLogEntry(parsed);
      if (!entry) {
        continue;
      }

      const timestamp = new Date(entry.timestamp);
      if (Number.isNaN(timestamp.getTime())) {
        continue;
      }

      if (fromDate && timestamp < fromDate) {
        continue;
      }
      if (toDate && timestamp > toDate) {
        continue;
      }
      if (query.level && entry.level !== query.level) {
        continue;
      }
      if (eventFilter && entry.event !== eventFilter) {
        continue;
      }

      events.push(entry);
      if (events.length >= limit) {
        break;
      }
    }

    return events;
  }
}
