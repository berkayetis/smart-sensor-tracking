import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { JwtOnlyGuard } from "../auth/guards/jwt-only.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentAuth } from "../common/decorators/current-auth.decorator";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { mapRecords } from "../common/utils/collection.util";
import { Role } from "../iam/roles.enum";
import { AnalyticsService } from "./analytics.service";
import { LogEventResponseDto } from "./dto/log-event-response.dto";
import { LogEventsQueryDto } from "./dto/log-events-query.dto";

@Controller("logs")
export class LogsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("events")
  @UseGuards(JwtOnlyGuard, RolesGuard)
  @Roles(Role.SYSTEM_ADMIN)
  @ApiOkResponse({ type: LogEventResponseDto, isArray: true })
  async getEvents(
    @CurrentAuth() auth: AuthContext,
    @Query() query: LogEventsQueryDto,
  ): Promise<LogEventResponseDto[]> {
    await this.analyticsService.trackLogView(auth.userId);
    const rows = await this.analyticsService.getLogEvents(query);
    return mapRecords(rows, LogEventResponseDto.fromRecord);
  }
}
