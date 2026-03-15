import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { JwtOnlyGuard } from "../auth/guards/jwt-only.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../iam/roles.enum";
import { CurrentAuth } from "../common/decorators/current-auth.decorator";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { mapRecords } from "../common/utils/collection.util";
import { TelemetryService } from "./telemetry.service";
import { HistoryQueryDto } from "./dto/history-query.dto";
import { CreateSensorDto } from "./dto/create-sensor.dto";
import { SensorIdParamDto } from "./dto/sensor-id-param.dto";
import { SensorMetricResponseDto } from "./dto/sensor-metric-response.dto";
import { SensorResponseDto } from "./dto/sensor-response.dto";

@Controller("sensors")
@UseGuards(JwtOnlyGuard, RolesGuard)
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post()
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiOkResponse({ type: SensorResponseDto })
  async createSensor(@CurrentAuth() auth: AuthContext, @Body() dto: CreateSensorDto): Promise<SensorResponseDto> {
    const companyId = auth.role === Role.COMPANY_ADMIN ? auth.companyId ?? undefined : dto.companyId;
    const record = await this.telemetryService.registerSensor({
      id: dto.id,
      name: dto.name,
      companyId,
    });
    return SensorResponseDto.fromRecord(record);
  }

  @Get(":id/latest")
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN, Role.USER)
  @ApiOkResponse({ type: SensorMetricResponseDto })
  async latest(
    @CurrentAuth() auth: AuthContext,
    @Param() params: SensorIdParamDto,
  ): Promise<SensorMetricResponseDto | null> {
    const record = await this.telemetryService.getLatest(auth, params.id);
    return record ? SensorMetricResponseDto.fromRecord(record) : null;
  }

  @Get(":id/history")
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN, Role.USER)
  @ApiOkResponse({ type: SensorMetricResponseDto, isArray: true })
  async history(
    @CurrentAuth() auth: AuthContext,
    @Param() params: SensorIdParamDto,
    @Query() query: HistoryQueryDto,
  ): Promise<SensorMetricResponseDto[]> {
    const rows = await this.telemetryService.getHistory(auth, params.id, query.from, query.to);
    return mapRecords(rows, SensorMetricResponseDto.fromRecord);
  }
}
