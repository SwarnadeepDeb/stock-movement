import { NavLink, Outlet } from "react-router";
import { cn } from "@/lib/utils";

const TABS = [
    { to: "/stock-out", label: "Overview", end: true },
    { to: "/stock-out/orders", label: "Order Forms" },
    { to: "/stock-out/invoices", label: "Invoices" },
    { to: "/stock-out/parties", label: "Party Master" },
];

const StockOutLayout = () => (
    <div className="stock-out flex flex-col font-sans">
        <nav className="toolbar-neu no-scrollbar mb-5 flex w-full max-w-full shrink-0 gap-1 overflow-x-auto overscroll-x-contain rounded-full p-1 sm:w-fit">
            {TABS.map((tab) => (
                <NavLink
                    key={tab.to}
                    to={tab.to}
                    end={tab.end}
                    className={({ isActive }) => cn(
                        "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:py-2 sm:text-sm",
                        isActive ? "bg-[#00694C] text-white" : "text-[#1E1B4B]/70 hover:text-[#1E1B4B]",
                    )}
                >
                    {tab.label}
                </NavLink>
            ))}
        </nav>

        <div>
            <Outlet />
        </div>
    </div>
);

export default StockOutLayout;
