import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtOnlyGuard } from "../auth/guards/jwt-only.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { ApiSuccessResponse } from "../common/decorators/api-success-response.decorator";
import { Role } from "./roles.enum";
import { CurrentAuth } from "../common/decorators/current-auth.decorator";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { mapRecords } from "../common/utils/collection.util";
import { IamService } from "./iam.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { CompanyResponseDto } from "./dto/company-response.dto";

@Controller("companies")
@UseGuards(JwtOnlyGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly iamService: IamService) {}

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiSuccessResponse({ type: CompanyResponseDto, isArray: true })
  async listCompanies(@CurrentAuth() auth: AuthContext): Promise<CompanyResponseDto[]> {
    const records = await this.iamService.listCompanies(auth);
    return mapRecords(records, CompanyResponseDto.fromRecord);
  }

  @Post()
  @Roles(Role.SYSTEM_ADMIN)
  @ApiSuccessResponse({ type: CompanyResponseDto })
  async createCompany(@Body() dto: CreateCompanyDto): Promise<CompanyResponseDto> {
    const record = await this.iamService.createCompany(dto.name);
    return CompanyResponseDto.fromRecord(record);
  }
}
