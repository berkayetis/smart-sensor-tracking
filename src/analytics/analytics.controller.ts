import { Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service";
import { JwtOnlyGuard } from "../auth/guards/jwt-only.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentAuth } from "../common/decorators/current-auth.decorator";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { mapRecords } from "../common/utils/collection.util";
import { Role } from "../iam/roles.enum";
import { LogStatsQueryDto } from "./dto/log-stats-query.dto";
import { HourlyLogStatResponseDto } from "./dto/hourly-log-stat-response.dto";
import { LogViewEventResponseDto } from "./dto/log-view-event-response.dto";
import { LogViewPredictionResponseDto } from "./dto/log-view-prediction-response.dto";

@Controller("logs/views")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post()
  @UseGuards(JwtOnlyGuard)
  @ApiOkResponse({ type: LogViewEventResponseDto })
  async trackView(@CurrentAuth() auth: AuthContext): Promise<LogViewEventResponseDto> {
    const record = await this.analyticsService.trackLogView(auth.userId);
    return LogViewEventResponseDto.fromRecord(record);
  }

  @Get("stats")
  @UseGuards(JwtOnlyGuard, RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiOkResponse({ type: HourlyLogStatResponseDto, isArray: true })
  async stats(
    @CurrentAuth() auth: AuthContext,
    @Query() query: LogStatsQueryDto,
  ): Promise<HourlyLogStatResponseDto[]> {
    await this.analyticsService.trackLogView(auth.userId);
    const rows = await this.analyticsService.getHourlyStats(auth, query.from, query.to);
    return mapRecords(rows, HourlyLogStatResponseDto.fromRecord);
  }

  @Get("prediction")
  @UseGuards(JwtOnlyGuard, RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiOkResponse({ type: LogViewPredictionResponseDto })
  async prediction(@CurrentAuth() auth: AuthContext): Promise<LogViewPredictionResponseDto> {
    await this.analyticsService.trackLogView(auth.userId);
    const record = await this.analyticsService.getNextHourPrediction(auth);
    return LogViewPredictionResponseDto.fromRecord(record);
  }
}
