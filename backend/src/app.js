import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import { traceMiddleware } from "./app/middlewares/trace.middleware.js";
import requestTiming from "./app/middlewares/requestTiming.middleware.js";
import notFoundHandler from "./app/middlewares/notFound.middleware.js";
import errorHandler from "./app/middlewares/error.middleware.js";
import { attachRole } from "./app/middlewares/role.middleware.js";
import router from "./app/routes/index.js";

const app = express();

app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());

// cors
// In development, Vite falls back to the next free port (5174, 5175, ...) whenever something
// else on the machine already holds 5173 — a single hardcoded FRONTEND_URL breaks the moment
// that happens. Accept any localhost port in dev; production still pins to the real FRONTEND_URL.
const isLocalhostOrigin = (origin) => /^http:\/\/localhost:\d+$/.test(origin);

app.use(cors({
    origin: process.env.NODE_ENV === "development"
        ? (origin, callback) => callback(null, !origin || isLocalhostOrigin(origin))
        : process.env.FRONTEND_URL,
    credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(traceMiddleware);
app.use(requestTiming);

app.get("/health", (req, res) => { res.json({ status: "User service running" }) });

app.use(attachRole);

// application routes
app.use("/api/v1", router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
