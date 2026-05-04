require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { initializeDatabase } = require("./db/schema");
const { seedDatabase } = require("./db/seed");
const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const taskRoutes = require("./routes/tasks");
const dashboardRoutes = require("./routes/dashboard");

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const PORT = parseInt(process.env.PORT, 10) || 4000;
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const FRONTEND_URLS = (process.env.FRONTEND_URL || "http://localhost:5173").split(",").map((url) => url.trim());
const DATABASE_URL = process.env.DATABASE_URL;

const app = express();
if (TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(compression());
app.use(morgan(IS_PRODUCTION ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests from this IP. Please try again later." },
  })
);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || FRONTEND_URLS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy blocked origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (req, res) => {
  res.json({ status: "ok", env: NODE_ENV });
});

(async () => {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const db = await initializeDatabase(DATABASE_URL);
  await seedDatabase(db);

  app.use("/api/auth", authRoutes(db));
  app.use("/api/projects", projectRoutes(db));
  app.use("/api/tasks", taskRoutes(db));
  app.use("/api/dashboard", dashboardRoutes(db));

  app.use((req, res) => {
    res.status(404).json({ message: "Endpoint not found" });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    if (err instanceof Error && err.message.startsWith("CORS policy blocked origin")) {
      return res.status(403).json({ message: err.message });
    }
    res.status(500).json({ message: "Internal server error" });
  });

  app.listen(PORT, () => {
    console.log(`TaskFlow backend running in ${NODE_ENV} mode on http://localhost:${PORT}`);
  });
})().catch((err) => {
  console.error("Failed to start backend:", err);
  process.exit(1);
});
