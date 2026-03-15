import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { OnEvent } from "@nestjs/event-emitter";
import { UnauthorizedException } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { AppLoggerService } from "../logging/app-logger.service";
import { TelemetryService } from "../telemetry/telemetry.service";
import { SensorUpdateEventDto } from "../telemetry/dto/sensor-update-event.dto";
import { TELEMETRY_INGESTED_EVENT } from "../telemetry/telemetry.constants";
import { AuthContextService } from "../auth/auth-context.service";

@WebSocketGateway({
  namespace: "/realtime",
  cors: {
    origin: "*",
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly authContextService: AuthContextService,
    private readonly telemetryService: TelemetryService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const authContext = await this.authenticateClient(client);
      this.setAuthContext(client, authContext);
      this.logger.log(
        `Realtime client connected: ${client.id}, user=${authContext.userId}`,
        "RealtimeGateway",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unauthorized websocket client";
      this.logger.logEvent(
        "ws_connection_rejected",
        {
          socketId: client.id,
          reason: message,
        },
        {
          context: "RealtimeGateway",
          level: "warn",
          actor: { userId: null },
        },
      );
      client.emit("sensor.error", {
        type: "auth_failed",
        message: "Unauthorized",
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Realtime client disconnected: ${client.id}`, "RealtimeGateway");
  }

  @SubscribeMessage("sensor.subscribe")
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sensorId?: string },
  ): Promise<{ success: boolean; sensorId?: string; message?: string }> {
    const authContext = this.getAuthContext(client);
    if (!authContext) {
      return { success: false, message: "Unauthorized" };
    }

    const sensorId = this.resolveSensorId(body);
    if (!sensorId) {
      return { success: false, message: "sensorId is required" };
    }

    try {
      await this.telemetryService.ensureSensorAccess(authContext, sensorId);
      await client.join(this.roomForSensor(sensorId));
      return { success: true, sensorId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Access denied";
      this.logger.logEvent(
        "ws_subscribe_denied",
        {
          sensorId,
          reason: message,
        },
        {
          context: "RealtimeGateway",
          level: "warn",
          actor: {
            userId: authContext.userId,
            role: authContext.role,
            companyId: authContext.companyId ?? null,
          },
        },
      );
      client.emit("sensor.error", {
        type: "subscribe_denied",
        sensorId,
        message,
      });
      return { success: false, sensorId, message };
    }
  }

  @SubscribeMessage("sensor.unsubscribe")
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sensorId?: string },
  ): Promise<{ success: boolean; sensorId?: string; message?: string }> {
    const sensorId = this.resolveSensorId(body);
    if (!sensorId) {
      return { success: false, message: "sensorId is required" };
    }

    await client.leave(this.roomForSensor(sensorId));
    return { success: true, sensorId };
  }

  @OnEvent(TELEMETRY_INGESTED_EVENT)
  handleTelemetryEvent(payload: SensorUpdateEventDto): void {
    this.server.to(this.roomForSensor(payload.sensorId)).emit("sensor.update", payload);
  }

  private roomForSensor(sensorId: string): string {
    return `sensor:${sensorId}`;
  }

  private getAuthContext(client: Socket): AuthContext | null {
    const data = client.data as { authContext?: AuthContext };
    return data.authContext ?? null;
  }

  private setAuthContext(client: Socket, authContext: AuthContext): void {
    const data = client.data as { authContext?: AuthContext };
    data.authContext = authContext;
  }

  private async authenticateClient(client: Socket): Promise<AuthContext> {
    const token = this.extractToken(client);
    if (!token) {
      throw new UnauthorizedException("Missing Bearer token");
    }
    return this.authContextService.resolveFromToken(token);
  }

  private resolveSensorId(body: { sensorId?: string }): string | null {
    const sensorId = body?.sensorId?.trim();
    return sensorId && sensorId.length > 0 ? sensorId : null;
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as { token?: string } | undefined)?.token;
    if (typeof authToken === "string" && authToken.trim().length > 0) {
      return authToken.startsWith("Bearer ") ? authToken.slice(7) : authToken;
    }

    const authorization = client.handshake.headers.authorization;
    const bearer = Array.isArray(authorization) ? authorization[0] : authorization;
    if (typeof bearer === "string" && bearer.startsWith("Bearer ")) {
      return bearer.slice(7);
    }

    return null;
  }
}
