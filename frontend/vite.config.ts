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
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
