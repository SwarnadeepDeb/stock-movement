import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
            title={isDark ? "Day mode" : "Night mode"}
            className="rounded-full"
        >
            {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </Button>
    );
};

export default ThemeToggle;
