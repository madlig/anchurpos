"use client";

import { useEffect, useState, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children, icon }: BottomSheetProps) {
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setRender(false);
  };

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      {/* Drawer / Modal Content */}
      <div 
        className={cn(
          "relative w-full sm:max-w-md max-h-[90vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen ? "translate-y-0 sm:scale-100 opacity-100" : "translate-y-full sm:translate-y-0 sm:scale-95 opacity-0"
        )}
        onTransitionEnd={handleAnimationEnd}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0 sm:hidden" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            {icon && <span className="text-xl">{icon}</span>}
            <h2 className="font-extrabold text-slate-800">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white text-slate-500 shadow-sm">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-12">
          {children}
        </div>
      </div>
    </div>
  );
}
