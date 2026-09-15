import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const ActionModal = ({
    openActionModal,
    setOpenActionModal,
    children,
    title,
    subtitle,
    locked,
    className,
    showCloseButton,
}) => {
    return (
        <Dialog
            open={openActionModal}
            onOpenChange={(open) => !locked && setOpenActionModal(open)}
        >
            <DialogPortal>
                <DialogOverlay
                    className="
            fixed inset-0 z-50 bg-black/50
            data-[state=open]:animate-in
            data-[state=closed]:animate-out
            data-[state=open]:fade-in-0
            data-[state=closed]:fade-out-0
          "
                />
                <DialogContent
                    aria-describedby={undefined}
                    className={cn(
                        `fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] sm:w-full sm:max-w-lg max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background shadow-lg p-0
                            data-[state=open]:animate-in
                            data-[state=closed]:animate-out
                            data-[state=open]:zoom-in-95
                            data-[state=closed]:zoom-out-95
                            data-[state=open]:fade-in-0
                            data-[state=closed]:fade-out-0`,
                        className,
                    )}
                >
                    {!title && <DialogTitle className="sr-only">Dialog</DialogTitle>}
                    {(title || showCloseButton) && (
                        <div className="relative border-b px-4 py-3 sm:px-6 sm:py-4">
                            {title && (
                                <div>
                                    <DialogTitle className="text-gray-900 tracking-tight text-xl md:text-2xl font-bold leading-tight text-center">
                                        {title}
                                    </DialogTitle>
                                    {subtitle && (
                                        <DialogDescription className="text-muted-foreground text-sm font-medium text-center mt-3.5">
                                            {subtitle}
                                        </DialogDescription>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="overflow-y-auto max-h-[calc(100dvh-140px)]">
                        {children}
                    </div>
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
};

export default ActionModal;
