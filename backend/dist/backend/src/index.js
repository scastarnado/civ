/**
 * Backend Server Main Entry Point
 * Starts WebSocket server and manages rooms
 */
import { GameServer } from '@/server/WebSocketServer';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const server = new GameServer(PORT);
// Start server
server.start();
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.stop();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\nTerminating server...');
    server.stop();
    process.exit(0);
});
console.log('4X Strategy Game Backend Server Started');
console.log(`Listening on ws://localhost:${PORT}`);
//# sourceMappingURL=index.js.map