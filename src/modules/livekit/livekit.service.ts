import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { livekitConfig } from 'src/config/livekit.config';

export interface TokenOptions {
  roomName: string;
  participantIdentity: string;
  participantName?: string;
  metadata?: Record<string, unknown>;
}

export interface RoomTokenResponse {
  token: string;
  roomName: string;
  url: string;
}

@Injectable()
export class LiveKitService {
  private roomService: RoomServiceClient;

  constructor(
    @Inject(livekitConfig.KEY)
    private readonly config: ConfigType<typeof livekitConfig>,
  ) {
    this.roomService = new RoomServiceClient(
      this.config.url,
      this.config.apiKey,
      this.config.apiSecret,
    );
  }

  async generateToken(options: TokenOptions): Promise<RoomTokenResponse> {
    const { roomName, participantIdentity, participantName, metadata } =
      options;

    const at = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: participantIdentity,
      name: participantName || participantIdentity,
      ttl: '10m',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    if (metadata) {
      at.metadata = JSON.stringify(metadata);
    }

    const token = await at.toJwt();

    return {
      token,
      roomName,
      url: this.config.url,
    };
  }

  async createRoom(
    roomName: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.roomService.createRoom({
      name: roomName,
      emptyTimeout: 300,
      maxParticipants: 2,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
  }

  async deleteRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
    } catch (error) {
      throw new Error(
        `Failed to delete room ${roomName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async listParticipants(roomName: string) {
    return this.roomService.listParticipants(roomName);
  }
}
