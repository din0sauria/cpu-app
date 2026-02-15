import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [
    vue(),
    viteSingleFile({
      useRecommendedBuildConfig: true,
      removeViteModuleLoader: true,
      inlinePattern: ['*.js', '*.css'],
    })
  ],
  base: './', 
  build: {
    assetsDir: '', 
    rollupOptions: {
      output: {
        manualChunks: undefined, 
        entryFileNames: 'index.js',
        assetFileNames: '[name].[ext]'
      }
    },
    polyfillModulePreload: false
  },
})
