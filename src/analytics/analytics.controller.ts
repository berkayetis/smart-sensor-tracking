import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiParam } from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service";
import { JwtOnlyGuard } from "../auth/guards/jwt-only.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentAuth } from "../common/decorators/current-auth.decorator";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { mapRecords } from "../common/utils/collection.util";
import { ApiSuccessResponse } from "../common/decorators/api-success-response.decorator";
import { Role } from "../iam/roles.enum";
import { LogStatsQueryDto } from "./dto/log-stats-query.dto";
import { HourlyLogStatResponseDto } from "./dto/hourly-log-stat-response.dto";
import { LogViewEventResponseDto } from "./dto/log-view-event-response.dto";
import { LogViewPredictionResponseDto } from "./dto/log-view-prediction-response.dto";
import { LogUserStatsQueryDto } from "./dto/log-user-stats-query.dto";
import { UserLogViewStatResponseDto } from "./dto/user-log-view-stat-response.dto";
import { UserStatParamDto } from "./dto/user-stat-param.dto";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";

@Controller("logs/views")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post()
  @UseGuards(JwtOnlyGuard)
  @ApiSuccessResponse({ type: LogViewEventResponseDto })
  async trackView(@CurrentAuth() auth: AuthContext): Promise<LogViewEventResponseDto> {
    const record = await this.analyticsService.trackLogView(auth.userId);
    return LogViewEventResponseDto.fromRecord(record);
  }

  @Get("stats")
  @UseGuards(JwtOnlyGuard, RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiSuccessResponse({ type: HourlyLogStatResponseDto, isArray: true })
  async stats(
    @CurrentAuth() auth: AuthContext,
    @Query() query: LogStatsQueryDto,
  ): Promise<HourlyLogStatResponseDto[]> {
    const rows = await this.analyticsService.getHourlyStats(auth, query.from, query.to);
    return mapRecords(rows, HourlyLogStatResponseDto.fromRecord);
  }

  @Get("stats/users")
  @UseGuards(JwtOnlyGuard, RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiSuccessResponse({ type: UserLogViewStatResponseDto, isArray: true })
  async userStats(
    @CurrentAuth() auth: AuthContext,
    @Query() query: LogUserStatsQueryDto,
  ): Promise<UserLogViewStatResponseDto[]> {
    const rows = await this.analyticsService.getUserStats(auth, query.from, query.to, query.limit);
    return mapRecords(rows, UserLogViewStatResponseDto.fromRecord);
  }

  @Get("stats/users/:userId")
  @UseGuards(JwtOnlyGuard, RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiParam({ name: "userId", type: String, required: true })
  @ApiSuccessResponse({ type: UserLogViewStatResponseDto })
  async userStatById(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UserStatParamDto,
    @Query() query: DateRangeQueryDto,
  ): Promise<UserLogViewStatResponseDto> {
    const record = await this.analyticsService.getUserStatById(auth, params.userId, query.from, query.to);
    return UserLogViewStatResponseDto.fromRecord(record);
  }

  @Get("prediction")
  @UseGuards(JwtOnlyGuard, RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiSuccessResponse({ type: LogViewPredictionResponseDto })
  async prediction(@CurrentAuth() auth: AuthContext): Promise<LogViewPredictionResponseDto> {
    const record = await this.analyticsService.getNextHourPrediction(auth);
    return LogViewPredictionResponseDto.fromRecord(record);
  }
}
