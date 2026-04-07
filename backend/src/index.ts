/**
 * Backend Server Main Entry Point
 * Starts WebSocket server and manages rooms
 */

import { startApiServer } from '@/api/server';
import { GameServer } from '@/server/WebSocketServer';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

const server = new GameServer(PORT);
let apiServer: Awaited<ReturnType<typeof startApiServer>> | null = null;

async function boot(): Promise<void> {
	apiServer = await startApiServer();
	server.start();
}

boot().catch((error) => {
	console.error('Failed to boot backend services', error);
	process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\nShutting down server...');
	server.stop();
	apiServer?.close();
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.log('\nTerminating server...');
	server.stop();
	apiServer?.close();
	process.exit(0);
});

console.log('4X Strategy Game Backend Server Started');
console.log(`Listening on ws://localhost:${PORT}`);
