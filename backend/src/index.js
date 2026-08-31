require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { sequelize } = require("./models");

const authRoutes = require("./routes/auth.routes");
const issuerRoutes = require("./routes/issuer.routes");
const citizenRoutes = require("./routes/citizen.routes");
const verifierRoutes = require("./routes/verifier.routes");
const governanceRoutes = require("./routes/governance.routes");
const credentialTypesRoutes = require("./routes/credential-types.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ status: "ok" }));

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
    app.listen(PORT, () => console.log(`CiviLedger backend listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error("Unable to start server:", err.message);
    process.exit(1);
  }
}

start();
