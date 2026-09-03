require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { sequelize } = require("./models");

const authRoutes = require("./routes/auth.routes");
const issuerRoutes = require("./routes/issuer.routes");
const citizenRoutes = require("./routes/citizen.routes");
const verifierRoutes = require("./routes/verifier.routes");
const governanceRoutes = require("./routes/governance.routes");
const credentialTypesRoutes = require("./routes/credential-types.routes");

const app = express();

// Behind Caddy / a load balancer in production so req.ip and rate limiting work.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
}

app.use(helmet());

// CORS_ORIGIN is a comma-separated allowlist of frontend origins in production.
// Empty or "*" reflects the request origin (fine for local dev only).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions =
  allowedOrigins.length === 0 || allowedOrigins.includes("*")
    ? { origin: true }
    : { origin: allowedOrigins };
app.use(cors(corsOptions));

app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use("/auth", authRoutes);
app.use("/issuer", issuerRoutes);
app.use("/citizen", citizenRoutes);
app.use("/verifier", verifierRoutes);
app.use("/governance", governanceRoutes);
app.use("/credential-types", credentialTypesRoutes);

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("Database connection established.");

    const server = app.listen(PORT, "0.0.0.0", () =>
      console.log(`CiviLedger backend listening on port ${PORT}`)
    );

    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down.`);
      server.close(async () => {
        try {
          await sequelize.close();
        } catch (e) {
          console.error("Error closing DB pool:", e.message);
        }
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    ["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, () => shutdown(sig)));
  } catch (err) {
    console.error("Unable to start server:", err.message);
    process.exit(1);
  }
}

start();
