"use client";

import React, { createContext, useContext, useState, useRef, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, HelpCircle, CheckCircle, Info } from "lucide-react";

interface AlertConfirmOptions {
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: "info" | "warning" | "success" | "danger";
}

interface AlertConfirmContextType {
  alert: (message: string, title?: string, type?: "info" | "warning" | "success" | "danger") => Promise<void>;
  confirm: (message: string, title?: string, options?: AlertConfirmOptions) => Promise<boolean>;
}

const AlertConfirmContext = createContext<AlertConfirmContextType | undefined>(undefined);

export function useAlertConfirm() {
  const context = useContext(AlertConfirmContext);
  if (!context) {
    throw new Error("useAlertConfirm must be used within an AlertConfirmProvider");
  }
  return context;
}

export function AlertConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isConfirm, setIsConfirm] = useState(false);
  const [options, setOptions] = useState<AlertConfirmOptions>({});
  
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const showAlert = (
    msg: string, 
    ttl = "Informasi", 
    type: "info" | "warning" | "success" | "danger" = "info"
  ): Promise<void> => {
    setTitle(ttl);
    setMessage(msg);
    setIsConfirm(false);
    setOptions({ type });
    setIsOpen(true);
    
    return new Promise<void>((resolve) => {
      resolverRef.current = () => {
        resolve();
      };
    });
  };

  const showConfirm = (
    msg: string, 
    ttl = "Konfirmasi", 
    opts: AlertConfirmOptions = {}
  ): Promise<boolean> => {
    setTitle(ttl);
    setMessage(msg);
    setIsConfirm(true);
    setOptions(opts);
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = (value: boolean) => {
        resolve(value);
      };
    });
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel();
    }
  };

  const activeType = options.type || (isConfirm ? "warning" : "info");

  const IconComponent = (() => {
    switch (activeType) {
      case "success":
        return <CheckCircle className="h-6 w-6 text-emerald-600" />;
      case "warning":
        return <HelpCircle className="h-6 w-6 text-amber-500" />;
      case "danger":
        return <AlertCircle className="h-6 w-6 text-rose-600" />;
      case "info":
      default:
        return <Info className="h-6 w-6 text-sky-500" />;
    }
  })();

  const typeHeaderBg = (() => {
    switch (activeType) {
      case "success":
        return "bg-emerald-50";
      case "warning":
        return "bg-amber-50";
      case "danger":
        return "bg-rose-50";
      case "info":
      default:
        return "bg-sky-50";
    }
  })();

  return (
    <AlertConfirmContext.Provider value={{ alert: showAlert, confirm: showConfirm }}>
      {children}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[320px] sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <div className={`p-4 flex items-center gap-3 border-b border-slate-100 ${typeHeaderBg}`}>
            <div className="flex-shrink-0">{IconComponent}</div>
            <DialogTitle className="text-[15px] font-bold text-stone-900 leading-tight">
              {title}
            </DialogTitle>
          </div>
          
          <div className="p-5">
            <DialogDescription className="text-sm text-stone-600 leading-relaxed font-medium">
              {message}
            </DialogDescription>

            <div className="mt-6 flex gap-2.5">
              {isConfirm ? (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1 rounded-xl h-11 text-xs font-bold text-stone-600 hover:bg-stone-50 border-stone-200 tap-target"
                    onClick={handleCancel}
                  >
                    {options.cancelLabel || "Batal"}
                  </Button>
                  <Button
                    variant={options.destructive ? "destructive" : "default"}
                    className="flex-1 rounded-xl h-11 text-xs font-bold tap-target"
                    style={
                      !options.destructive
                        ? { background: "linear-gradient(135deg,#E85D8C,#C94A73)", color: "#fff", boxShadow: "0 4px 12px rgba(232,93,140,0.25)" }
                        : undefined
                    }
                    onClick={handleConfirm}
                  >
                    {options.confirmLabel || "Konfirmasi"}
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full rounded-xl h-11 text-xs font-bold tap-target"
                  style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)", color: "#fff", boxShadow: "0 4px 12px rgba(232,93,140,0.25)" }}
                  onClick={handleConfirm}
                >
                  {options.confirmLabel || "Tutup"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AlertConfirmContext.Provider>
  );
}
