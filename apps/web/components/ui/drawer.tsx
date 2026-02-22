"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}

export function Drawer({ open, onClose, title, children, width = 480 }: DrawerProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            {/* Panel */}
            <Dialog.Content asChild onInteractOutside={(e) => e.preventDefault()}>
              {isMobile ? (
                <MobileSheet onClose={onClose} title={title}>
                  {children}
                </MobileSheet>
              ) : (
                <DesktopPanel width={width} title={title} onClose={onClose}>
                  {children}
                </DesktopPanel>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function DesktopPanel({
  width,
  title,
  children,
  onClose,
}: {
  width: number;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed top-0 right-0 h-full bg-bg border-l border-border z-50 flex flex-col rounded-l-2xl overflow-hidden shadow-2xl"
      style={{ width }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
    >
      <DrawerHeader title={title} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </motion.div>
  );
}

function MobileSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 bg-bg z-50 flex flex-col rounded-t-2xl overflow-hidden shadow-2xl max-h-[92vh]"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y > window.innerHeight * 0.3) onClose();
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>
      <DrawerHeader title={title} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </motion.div>
  );
}

function DrawerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
      <Dialog.Title className="text-lg font-semibold text-text">{title}</Dialog.Title>
      <button
        onClick={onClose}
        aria-label="Close drawer"
        className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  );
}
