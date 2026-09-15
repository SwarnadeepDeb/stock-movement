import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useLocation } from "react-router";
import { getMenuList } from "@/lib/getMenuList";
import { cn } from "@/lib/utils";
import {
  TooltipContent,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import CollapseMenuButton from "./CollapseMenuButton";

const Menu = ({ isOpen }) => {
  const { pathname } = useLocation();
  const menuList = getMenuList({ pathname });

  return (
    <ScrollArea className="flex-1 min-h-0 w-full">
      <nav className="mt-8 w-full">
        <ul className="flex flex-col items-start space-y-1 px-2">
          {menuList.map(({ groupLabel, menus }, index) => (
            <li className={cn("w-full", groupLabel ? "pt-5" : "")} key={index}>
              {isOpen && groupLabel ? (
                <p className="text-sm font-medium text-muted-foreground px-4 pb-2 max-w-62 truncate">
                  {groupLabel}
                </p>
              ) : !isOpen && groupLabel ? (
                <TooltipProvider>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger className="w-full">
                      <div className="w-full flex justify-center items-center">
                        <Ellipsis className="h-5 w-5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{groupLabel}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <p className="pb-2"></p>
              )}

              {menus.map(
                ({ href, label, icon: Icon, active, submenus }, index) =>
                  !submenus || submenus.length === 0 ? (
                    <div className="w-full p-2" key={index}>
                      <TooltipProvider disableHoverableContent>
                        <Tooltip delayDuration={100}>
                          <TooltipTrigger
                            render={
                              <Button
                                variant={ (active === undefined && pathname.startsWith(href)) || active ? "secondary" : "ghost" }
                                className="w-full justify-start h-10 mb-1"
                                render={<Link to={href} />}
                                nativeButton={false}
                              />
                            }
                          >
                            <span className={cn(isOpen === false ? "" : "mr-2")}>
                              <Icon size={18} />
                            </span>
                            <p
                              className={cn("max-w-50 truncate",
                                isOpen === false ? "-translate-x-96 opacity-0" : "translate-x-0 opacity-100",
                              )}
                            >
                              {label + ""}
                            </p>
                          </TooltipTrigger>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ) : (
                    <div className="w-full" key={index}>
                      <CollapseMenuButton
                        icon={Icon}
                        label={label}
                        active={
                          active === undefined
                            ? pathname.startsWith(href)
                            : active
                        }
                        submenus={submenus}
                        isOpen={isOpen}
                      />
                    </div>
                  ),
              )}
            </li>
          ))}
        </ul>
      </nav>
    </ScrollArea>
  );
};

export default Menu;
