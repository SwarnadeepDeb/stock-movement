const baseURL = import.meta.env.VITE_API_BASE_URL;

// Every Stock Out call goes through here, so the server's machine-readable error code is
// unwrapped in exactly one place. When RBAC lands, the auth header belongs here too.
export async function request(path, options = {}) {
    const response = await fetch(`${baseURL}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers,
        },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        // The code travels with the error so a caller can tell a duplicate number (shown inline
        // on the field) from anything else (shown as a toast).
        const error = new Error(data?.message ?? data?.error?.message ?? "Request failed.");
        error.code = data?.code ?? data?.error?.code;
        error.status = response.status;
        throw error;
    }

    return data;
}

export function query(params) {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue;
        search.set(key, value);
    }

    return search.toString();
}
