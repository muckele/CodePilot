import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

function applicationRouteFallback(): Plugin {
  const rewriteApplicationRoute: Connect.NextHandleFunction = (request, _response, next) => {
    const acceptsHtml = request.headers.accept?.includes("text/html") ?? false;
    const pathname =
      request.url === undefined ? "" : new URL(request.url, "http://localhost").pathname;

    if (
      request.method === "GET" &&
      acceptsHtml &&
      (pathname.startsWith("/curriculum/") ||
        pathname.startsWith("/app/") ||
        pathname === "/login" ||
        pathname === "/register")
    ) {
      request.url = "/";
    }

    next();
  };

  return {
    name: "codelift-application-route-fallback",
    configureServer(server) {
      server.middlewares.use(rewriteApplicationRoute);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteApplicationRoute);
    }
  };
}

export default defineConfig({
  plugins: [applicationRouteFallback(), react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: false
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  build: {
    target: "es2022",
    sourcemap: true
  }
});
