"use client";

import { useEffect, useState, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdaptivePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}

export function AdaptivePanel({ isOpen, onClose, title, children, icon }: AdaptivePanelProps) {
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      // Prevent body scroll when open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setRender(false);
  };

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-start justify-end">
      {/* Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      
      {/* Panel Content (Mobile: Bottom Sheet, Desktop: Right Drawer) */}
      <div 
        className={cn(
          "relative flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          // Mobile classes (Bottom Sheet)
          "w-full rounded-t-3xl max-h-[90vh] md:max-h-none",
          // Desktop classes (Right Drawer)
          "md:w-[450px] md:h-screen md:rounded-none md:rounded-l-3xl",
          // Animation States
          isOpen 
            ? "translate-y-0 md:translate-x-0 opacity-100" 
            : "translate-y-full md:translate-y-0 md:translate-x-full opacity-0 md:opacity-100"
        )}
        onTransitionEnd={handleAnimationEnd}
      >
        {/* Mobile Drag Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 pt-2 md:pt-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {icon && <span className="text-xl text-primary">{icon}</span>}
            <h2 className="font-extrabold text-slate-800 text-lg md:text-xl tracking-tight">{title}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors tap-target"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 pb-24 md:pb-6 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
