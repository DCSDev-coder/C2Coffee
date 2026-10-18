import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Catalog media is served by the API. Only copy the files required by the
  // Admin shell so a production build does not duplicate the full menu library.
  publicDir: 'public-runtime',
})
