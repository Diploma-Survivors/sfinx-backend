import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtConfig } from '../../config/jwt.config';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: number;
  };
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Track connected sessions mapped by userId -> Set of socketIds
  private userSockets = new Map<number, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const tokenHeader = client.handshake.headers?.authorization;
      const tokenQuery = client.handshake.auth?.token as string | undefined;

      const token: string | null =
        tokenQuery || (tokenHeader ? tokenHeader.split(' ')[1] : null);

      if (!token) {
        throw new Error('No authentication token provided');
      }

      const { publicKey, algorithm } =
        this.configService.getOrThrow<JwtConfig>('jwt');
      const jwtResult: unknown = await this.jwtService.verifyAsync(token, {
        secret: publicKey,
        algorithms: [algorithm],
      });
      const payload = jwtResult as { sub: string };

      const userId = Number(payload.sub);
      client.data.userId = userId;

      // Join user specific room
      void client.join(`user_${userId}`);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      this.logger.log(`Client connected: ${client.id} for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Connection failed for client ${client.id}: ${(error as Error).message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.logger.log(`Client disconnected: ${client.id} for user ${userId}`);
    }
  }

  sendNotification(userId: number, notification: any) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }
}
