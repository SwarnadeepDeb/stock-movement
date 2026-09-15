import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { MenuIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import Menu from "./Menu";

// Below lg the fixed sidebar is off-canvas, so this hamburger + slide-in drawer is the mobile
// navigation. It renders the same <Menu> as the desktop sidebar, always expanded.
const DESKTOP_QUERY = "(min-width: 1024px)";

const SheetMenu = () => {
    const [open, setOpen] = useState(false);

    // Growing past lg while open would leave the page scroll-locked behind a hidden drawer.
    useEffect(() => {
        if (!open) return undefined;
        const media = window.matchMedia(DESKTOP_QUERY);
        const onChange = (e) => { if (e.matches) setOpen(false); };
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, [open]);

    // Close once a menu link is followed; submenu toggles are buttons, so they keep it open.
    const closeOnNavigate = (e) => {
        if (e.target.closest("a")) setOpen(false);
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger
                render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}
            >
                <MenuIcon className="size-5" />
            </DialogPrimitive.Trigger>

            <DialogPrimitive.Portal>
                <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 lg:hidden" />
                <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white text-sidebar-foreground shadow-xl outline-none duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left lg:hidden">
                    <div className="flex h-16 flex-none items-center justify-between border-b border-slate-200 px-4">
                        <DialogPrimitive.Title
                            render={<Link to="/" onClick={() => setOpen(false)} />}
                            className="text-[15px] font-semibold tracking-tight text-[#1E1B4B]"
                        >
                            Stock Mgmt
                        </DialogPrimitive.Title>
                        <DialogPrimitive.Close render={<Button variant="ghost" size="icon" aria-label="Close menu" />}>
                            <XIcon className="size-5" />
                        </DialogPrimitive.Close>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col px-3 pb-4" onClick={closeOnNavigate}>
                        <Menu isOpen />
                    </div>
                </DialogPrimitive.Popup>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

export default SheetMenu;
