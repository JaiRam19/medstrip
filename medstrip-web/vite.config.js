import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// When your Spring Boot API runs on 8080, calls to /api go there during development.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8080" } },
});
