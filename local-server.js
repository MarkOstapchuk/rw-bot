import http from "node:http";

import checkHandler from "./api/check.js";
import healthHandler from "./api/health.js";
process.loadEnvFile();
const PORT = Number(process.env.PORT || 3000);

function createResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.headersSent) {
        res.setHeader("content-type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(payload));
    },
    send(payload) {
      if (typeof payload === "object") {
        return this.json(payload);
      }
      res.end(String(payload));
    },
    setHeader(name, value) {
      res.setHeader(name, value);
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );
  const apiRes = createResponse(res);

  try {
    if (url.pathname === "/api/check") {
      await checkHandler(req, apiRes);
      return;
    }

    if (url.pathname === "/api/health") {
      await healthHandler(req, apiRes);
      return;
    }

    apiRes.status(404).json({ ok: false, error: "Not Found" });
  } catch (error) {
    apiRes.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

server.listen(PORT, () => {
  console.log(`Local server is running on http://localhost:${PORT}`);
});
