require("dotenv").config();
const app = require("./app");
const http = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const connectDB = require("./config/db");

// ── Process-level Error Handlers ──────────────────────────────────────────────
// Catch synchronous errors that weren't caught by Express
process.on("uncaughtException", (err) => {
    console.error("[FATAL] Uncaught Exception:", err);
    // Give time to flush logs, then exit so the process manager (PM2/Heroku/etc.) restarts
    setTimeout(() => process.exit(1), 1000);
});

// Catch async errors (unhandled promise rejections)
process.on("unhandledRejection", (reason, promise) => {
    console.error("[FATAL] Unhandled Rejection at:", promise, "reason:", reason);
    // Do NOT exit here — most unhandled rejections are recoverable in production
    // but log loudly so they get fixed
});

// Connect to database
connectDB();

const server = http.createServer(app);

const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:5173';

const io = new Server(server, {
    cors: {
        origin: [
            frontendUrl,
            'http://localhost:5173',
            'https://facely-three.vercel.app'
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisOptions = { enableOfflineQueue: false, maxRetriesPerRequest: 0, retryStrategy: () => null };
const pubClient = new Redis(redisUrl, redisOptions);
const subClient = pubClient.duplicate();

pubClient.on("error", () => {});
subClient.on("error", () => {});

Promise.all([pubClient.ping(), subClient.ping()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.io Redis adapter successfully connected.");
}).catch((err) => {
    console.warn("Could not connect to Redis. Socket.io will fall back to in-memory adapter.", err.message);
});

io.on("connection", (socket) => {
    socket.on("disconnect", () => {});
});

// Attach socket.io to req to use in controllers
app.use((req, res, next) => {
    req.io = io;
    next();
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`[Server] Facely API running on port ${PORT}`);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
    console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        console.log("[Server] HTTP server closed.");
        pubClient.quit();
        subClient.quit();
        process.exit(0);
    });
    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error("[Server] Forced shutdown after timeout.");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));