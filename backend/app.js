const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const userRoutes = require("./routes/userRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const configRoutes = require("./routes/configRoutes");
const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();

// ── Security Headers ──────────────────────────────────────────────────────────
// Remove "X-Powered-By: Express" header to reduce fingerprinting
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173'
];
app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server requests (no origin) and whitelisted origins
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: Origin ${origin} not allowed.`));
        }
    },
    credentials: true
}));

// ── Body Parsing ──────────────────────────────────────────────────────────────
// Limit for most routes: 1MB
app.use((req, res, next) => {
    if (req.path.includes('/students') && req.method === 'POST') {
        express.json({ limit: '10mb' })(req, res, next); // only student registration needs more
    } else {
        express.json({ limit: '1mb' })(req, res, next);
    }
});

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again later." }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // Stricter: only 20 login attempts per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts, please try again later." }
});

app.use(globalLimiter);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({ message: "Facely API is running.", timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/users", userRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/config", authMiddleware, configRoutes);
app.use("/api/auth", authLimiter, authRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
// This catches any unhandled errors thrown in route handlers
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(`[Global Error Handler] ${req.method} ${req.path}:`, err);

    // CORS error
    if (err.message && err.message.startsWith('CORS:')) {
        return res.status(403).json({ error: err.message });
    }
    // JSON parse error
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: "Invalid JSON in request body." });
    }
    // Payload too large
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: "Request body too large." });
    }
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ error: messages.join(', ') });
    }
    // Mongoose cast error (invalid ObjectId, etc.)
    if (err.name === 'CastError') {
        return res.status(400).json({ error: `Invalid value for field: ${err.path}` });
    }
    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(400).json({ error: `A record with this ${field} already exists.` });
    }

    // Default: don't leak internals to client
    res.status(500).json({ error: "An unexpected server error occurred. Please try again." });
});

module.exports = app;