import { useCallback, useEffect, useState } from "react";

// Kept in sync with the pre-paint script in index.html, which applies the saved theme
// before React mounts so a dark-mode reload never flashes white.
const STORAGE_KEY = "theme";
const systemQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readStoredTheme() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === "dark" || stored === "light" ? stored : null;
    } catch {
        return null;
    }
}

export function useTheme() {
    // null = no explicit choice yet, so follow the OS setting.
    const [storedTheme, setStoredTheme] = useState(readStoredTheme);
    const [systemTheme, setSystemTheme] = useState(() => (systemQuery().matches ? "dark" : "light"));
    const theme = storedTheme ?? systemTheme;

    useEffect(() => {
        const query = systemQuery();
        const onChange = (event) => setSystemTheme(event.matches ? "dark" : "light");
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
    }, [theme]);

    const toggleTheme = useCallback(() => {
        const next = theme === "dark" ? "light" : "dark";
        setStoredTheme(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Storage blocked (private mode etc.) — the toggle still works for this session.
        }
    }, [theme]);

    return { theme, toggleTheme };
}
