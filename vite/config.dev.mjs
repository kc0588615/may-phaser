import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'; 

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        react(),
        cesium(),
    ],
    server: {
        port: 8080
    }
})
