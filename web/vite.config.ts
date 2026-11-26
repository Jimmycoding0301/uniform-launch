import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: process.env.VITE_PUBLIC_SITE === "1" ? false : "public",
  server: { host: "0.0.0.0", port: 4317, strictPort: true },
});
