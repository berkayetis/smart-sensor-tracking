import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { IamService } from "./iam.service";
import { JwtOnlyGuard } from "../auth/guards/jwt-only.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "./roles.enum";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { CurrentAuth } from "../common/decorators/current-auth.decorator";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { mapRecords } from "../common/utils/collection.util";
import { SetDevicePermissionsDto } from "./dto/set-device-permissions.dto";
import { DevicePermissionResponseDto } from "./dto/device-permission-response.dto";
import { UserIdParamDto } from "./dto/user-id-param.dto";
import { UserResponseDto } from "./dto/user-response.dto";

@Controller("users")
@UseGuards(JwtOnlyGuard, RolesGuard)
export class UsersController {
  constructor(private readonly iamService: IamService) {}

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  async listUsers(@CurrentAuth() auth: AuthContext): Promise<UserResponseDto[]> {
    const records = await this.iamService.listUsers(auth);
    return mapRecords(records, UserResponseDto.fromRecord);
  }

  @Post()
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiOkResponse({ type: UserResponseDto })
  async createUser(@CurrentAuth() auth: AuthContext, @Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const record = await this.iamService.createUser(auth, dto);
    return UserResponseDto.fromRecord(record);
  }

  @Patch(":id/role")
  @Roles(Role.SYSTEM_ADMIN)
  @ApiOkResponse({ type: UserResponseDto })
  async updateRole(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    const record = await this.iamService.updateUserRole(auth, params.id, dto.role);
    return UserResponseDto.fromRecord(record);
  }

  @Post(":id/device-permissions")
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN)
  @ApiOkResponse({ type: DevicePermissionResponseDto, isArray: true })
  async setDevicePermissions(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UserIdParamDto,
    @Body() dto: SetDevicePermissionsDto,
  ): Promise<DevicePermissionResponseDto[]> {
    const records = await this.iamService.setDevicePermissions(auth, params.id, dto.sensorIds);
    return mapRecords(records, DevicePermissionResponseDto.fromRecord);
  }

  @Get(":id/device-permissions")
  @Roles(Role.SYSTEM_ADMIN, Role.COMPANY_ADMIN, Role.USER)
  @ApiOkResponse({ type: DevicePermissionResponseDto, isArray: true })
  async getDevicePermissions(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UserIdParamDto,
  ): Promise<DevicePermissionResponseDto[]> {
    const records = await this.iamService.getDevicePermissions(auth, params.id);
    return mapRecords(records, DevicePermissionResponseDto.fromRecord);
  }
}
