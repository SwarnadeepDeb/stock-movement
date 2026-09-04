import express from "express";
import routes from "../../src/app/routes/index.js";
import errorHandler from "../../src/app/middlewares/error.middleware.js";
import { attachRole } from "../../src/app/middlewares/role.middleware.js";

// The same routing and error handling as src/app.js, minus helmet/cors/logging — so a route test
// exercises the real middleware chain without the noise.
export function buildTestApp() {
    const app = express();
    app.use(express.json());
    app.use(attachRole);
    app.use("/api/v1", routes);
    app.use(errorHandler);
    return app;
}
