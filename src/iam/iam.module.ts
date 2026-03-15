import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { IamService } from "./iam.service";
import { UsersController } from "./users.controller";
import { CompaniesController } from "./companies.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [IamService],
  controllers: [UsersController, CompaniesController],
  exports: [IamService],
})
export class IamModule {}
