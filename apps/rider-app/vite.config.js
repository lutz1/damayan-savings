import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/damayan-savings/rider/" : "/",
  plugins: [react()],
  envDir: "../../",
  envPrefix: ["VITE_", "REACT_APP_"],
  resolve: {
    alias: {
      firebase: path.resolve(__dirname, "../../node_modules/firebase"),
    },
    dedupe: ["firebase", "react", "react-dom"],
  },
});
