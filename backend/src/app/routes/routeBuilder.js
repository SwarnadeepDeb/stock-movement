// builds routes dynamically
import { Router } from "express";

export const buildRouter = (routes) => {
    const router = Router();
    for (const route of routes) {
        const { path, controller, validators, middlewares } = route;
        for (const method of Object.keys(controller)) {
            const handler = controller[method];

            if (!handler) continue;

            const methodMiddlewares = [];
            const mws = middlewares?.[method];
            if (Array.isArray(mws)) methodMiddlewares.push(...mws);
            else if (mws) methodMiddlewares.push(mws);

            if (validators?.[method]) {
                methodMiddlewares.push(validators[method]);
            }
            router[method](path, ...methodMiddlewares, handler);
        }
    }
    return router;
};
