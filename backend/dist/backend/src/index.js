/**
 * Backend Server Main Entry Point
 * Starts WebSocket server and manages rooms
 */
import { GameServer } from '@/server/WebSocketServer';
import { startApiServer } from '@/api/server';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const server = new GameServer(PORT);
let apiServer = null;
async function boot() {
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
//# sourceMappingURL=index.js.map