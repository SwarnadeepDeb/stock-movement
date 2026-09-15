import { useState } from "react";
import { ChevronDown, Dot } from "lucide-react";
import { Link, useLocation } from "react-router";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Button } from "@/components/ui/button";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    //   DropdownMenuArrow
} from "@/components/ui/dropdown-menu";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";


// ================= COMPONENT =================

const CollapseMenuButton = ({
    icon: Icon,
    label,
    active,
    submenus,
    isOpen,
}) => {

    const pathname = useLocation().pathname;

    // check if any submenu is active
    const isSubmenuActive = submenus.some((submenu) =>
        submenu.active === undefined
            ? submenu.href === pathname
            : submenu.active
    );

    // local collapse state
    const [isCollapsed, setIsCollapsed] =
        useState(isSubmenuActive);

    // ================= EXPANDED SIDEBAR =================

    if (isOpen) {
        return (
            <Collapsible
                open={isCollapsed}
                onOpenChange={setIsCollapsed}
                className="w-full"
            >
                <CollapsibleTrigger
                    render={
                        <Button
                            variant={isSubmenuActive ? "secondary" : "ghost"}
                            className="w-full justify-start h-10 mb-1"
                        />
                    }
                >
                    <div className="w-full flex items-center justify-between">

                        {/* LEFT SIDE */}
                        <div className="flex items-center">
                            <span className="mr-4">
                                <Icon size={18} />
                            </span>

                            <p className="max-w-[150px] truncate">
                                {label}
                            </p>
                        </div>

                        {/* RIGHT SIDE */}
                        <ChevronDown
                            size={18}
                            className={cn(
                                "transition-transform duration-200",
                                isCollapsed && "rotate-180"
                            )}
                        />
                    </div>
                </CollapsibleTrigger>

                {/* SUBMENUS */}
                <CollapsibleContent>

                    {submenus.map((submenu, index) => {

                        const isActive =
                            submenu.active === undefined
                                ? pathname === submenu.href
                                : submenu.active;

                        return (
                            <Button
                                key={index}
                                variant={isActive ? "secondary" : "ghost"}
                                className="w-full justify-start h-10 mb-1"
                                render={<Link to={submenu.href} />}
                                nativeButton={false}
                            >
                                <span className="mr-4 ml-2">
                                    <Dot size={18} />
                                </span>

                                <p className="truncate">
                                    {submenu.label}
                                </p>
                            </Button>
                        );
                    })}

                </CollapsibleContent>
            </Collapsible>
        );
    }

    // ================= COLLAPSED SIDEBAR =================

    return (
        <DropdownMenu>

            <TooltipProvider>

                <Tooltip>

                    <TooltipTrigger
                        render={
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        variant={isSubmenuActive ? "secondary" : "ghost"}
                                        className="w-full justify-start h-10"
                                    />
                                }
                            />
                        }
                    >
                        <Icon size={18} />
                    </TooltipTrigger>

                    <TooltipContent side="right">
                        {label}
                    </TooltipContent>

                </Tooltip>

            </TooltipProvider>

            <DropdownMenuContent side="right">

                <DropdownMenuLabel>
                    {label}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {submenus.map((submenu, index) => {

                    const isActive =
                        submenu.active === undefined
                            ? pathname === submenu.href
                            : submenu.active;

                    return (
                        <DropdownMenuItem
                            key={index}
                            className={cn(isActive && "bg-secondary")}
                            render={<Link to={submenu.href} />}
                        >
                            {submenu.label}
                        </DropdownMenuItem>
                    );
                })}

                {/* <DropdownMenuArrow className="fill-border" /> */}

            </DropdownMenuContent>

        </DropdownMenu>
    );
};

export default CollapseMenuButton;
