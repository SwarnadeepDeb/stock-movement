import ApiError from "../../core/apiError.js";

export const ROLES = { STAFF: "staff", OWNER: "owner" };

const KNOWN_ROLES = new Set(Object.values(ROLES));

// Stand-in for real authentication: the client states its own role in a header, and this is the
// single place that reads it. There is no users table and no session yet — when one arrives, only
// this function changes, and every guard built on req.userRole keeps working.
//
// Unrecognised values fall back to staff rather than erroring: the safe default is the role with
// fewer powers, and a typo'd header should not take the application down.
export const attachRole = (req, res, next) => {
    const header = req.get("X-User-Role");
    const candidate = String(header ?? "").trim().toLowerCase();

    req.userRole = KNOWN_ROLES.has(candidate) ? candidate : ROLES.STAFF;
    next();
};

export const requireOwner = (req, res, next) => {
    if (req.userRole === ROLES.OWNER) return next();

    next(new ApiError("Only the owner can perform this action.", 403, "OWNER_ONLY"));
};
