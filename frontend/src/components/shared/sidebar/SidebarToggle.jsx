import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

const SidebarToggle = ({ isOpen, setIsOpen }) => {
    return (
        <div className="invisible lg:visible absolute top-[12px] -right-[16px] z-20">
            <Button
                onClick={setIsOpen}
                className="rounded-md w-8 h-8"
                variant="outline"
                size="icon"
            >
                <ChevronRight
                    className={cn(
                        "h-4 w-4 transition-transform ease-in-out duration-700",
                        isOpen ? "rotate-180" : "rotate-0"
                    )}
                />
            </Button>
        </div>
    )
}

export default SidebarToggle