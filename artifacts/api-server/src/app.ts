import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// --- Proteção por senha ---------------------------------------------------
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

app.use((req, res, next) => {
  // Liberado para o monitor (UptimeRobot) e health check do Render.
  if (req.path === "/api/healthz") {
    next();
    return;
  }

  // O EA envia os trades com uma chave secreta (cabeçalho ou ?key=...).
  if (req.method === "POST" && req.path === "/api/trades") {
    const eaKey = process.env.EA_API_KEY ?? "";
    const sent =
      req.get("x-api-key") ??
      (typeof req.query.key === "string" ? req.query.key : "");
    if (eaKey && safeEqual(sent, eaKey)) {
      next();
      return;
    }
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  // Todo o resto (site e demais rotas): usuário e senha.
  const user = process.env.DASH_USER ?? "";
  const password = process.env.DASH_PASSWORD ?? "";
  if (!user || !password) {
    res.status(503).send("Autenticação não configurada.");
    return;
  }
  const [scheme, encoded] = (req.get("authorization") ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (
      i >= 0 &&
      safeEqual(decoded.slice(0, i), user) &&
      safeEqual(decoded.slice(i + 1), password)
    ) {
      next();
      return;
    }
  }
  res
    .set("WWW-Authenticate", 'Basic realm="MT5 Dashboard", charset="UTF-8"')
    .status(401)
    .send("Autenticação necessária.");
});
// -------------------------------------------------------------------------

app.use("/api", router);

// Entrega o site (build do Vite) pelo mesmo servidor da API.
const webDir = path.resolve(
  process.cwd(),
  "artifacts/mt5-strategy-dashboard/dist/public",
);
if (fs.existsSync(webDir)) {
  app.use(express.static(webDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(webDir, "index.html"));
  });
}

export default app;
