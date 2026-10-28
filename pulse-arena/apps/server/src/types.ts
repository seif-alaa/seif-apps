import type { Server, Socket } from 'socket.io';
import type { ClientToServer, ServerToClient } from '@pulse/protocol';

export interface SocketData {
  playerId: string;
  ip: string;
}

export type GameIO = Server<ClientToServer, ServerToClient, Record<string, never>, SocketData>;
export type GameSocket = Socket<ClientToServer, ServerToClient, Record<string, never>, SocketData>;
