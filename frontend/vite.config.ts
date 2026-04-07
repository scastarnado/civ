import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
	root: '.',
	publicDir: 'public',
	build: {
		outDir: 'dist',
		sourcemap: false,
	},
	server: {
		port: 5173,
		strictPort: false,
		proxy: {
			'/api': {
				target: 'http://localhost:8081',
				changeOrigin: true,
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
