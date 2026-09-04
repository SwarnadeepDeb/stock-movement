import { describe, expect, it, vi } from "vitest";
import { attachRole, requireOwner, ROLES } from "../../src/app/middlewares/role.middleware.js";

function runAttach(headers) {
    const req = { get: (name) => headers[name.toLowerCase()] };
    const next = vi.fn();
    attachRole(req, {}, next);
    return { req, next };
}

describe("attachRole", () => {
    it("reads a recognised role from the X-User-Role header", () => {
        const { req, next } = runAttach({ "x-user-role": "owner" });

        expect(req.userRole).toBe(ROLES.OWNER);
        expect(next).toHaveBeenCalledWith();
    });

    it("is case insensitive", () => {
        const { req } = runAttach({ "x-user-role": "OWNER" });

        expect(req.userRole).toBe(ROLES.OWNER);
    });

    it("defaults to staff when the header is absent", () => {
        const { req } = runAttach({});

        expect(req.userRole).toBe(ROLES.STAFF);
    });

    it("defaults to staff when the header is unrecognised, never trusting an unknown value", () => {
        const { req } = runAttach({ "x-user-role": "administrator" });

        expect(req.userRole).toBe(ROLES.STAFF);
    });
});

describe("requireOwner", () => {
    it("passes an owner through", () => {
        const next = vi.fn();

        requireOwner({ userRole: ROLES.OWNER }, {}, next);

        expect(next).toHaveBeenCalledWith();
    });

    it("rejects staff with 403 OWNER_ONLY", () => {
        const next = vi.fn();

        requireOwner({ userRole: ROLES.STAFF }, {}, next);

        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(403);
        expect(error.code).toBe("OWNER_ONLY");
    });
});
