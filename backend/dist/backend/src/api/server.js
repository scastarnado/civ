import http from 'http';
import app from './app';
import { initializeDatabase } from './db';
const API_PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8081;
export async function startApiServer() {
    await initializeDatabase();
    const server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(API_PORT, () => resolve());
    });
    console.log(`HTTP API listening on http://localhost:${API_PORT}`);
    return server;
}
//# sourceMappingURL=server.js.map