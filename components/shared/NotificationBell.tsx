"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface AlertItem {
  id: string;
  type: string;
  severity: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  sourceId: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts?unread=true");
      if (!res.ok) return;
      const data = await res.json();
      if (data.alerts) {
        setAlerts(data.alerts);
        setUnreadCount(data.alerts.length);
      }
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAlerts();
      }
    }, 30000);

    const handleFCM = () => fetchAlerts();
    window.addEventListener("fcm_message", handleFCM);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchAlerts();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("fcm_message", handleFCM);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/alerts/read-all", { method: "PATCH" });
      setAlerts([]);
      setUnreadCount(0);
      setIsOpen(false);
    } catch (err) {
      console.error("Error marking all read:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (alert: AlertItem) => {
    try {
      // Optimistic update
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      
      // Navigate based on type
      if (alert.type.startsWith("sfm_")) {
        // Based on user role from pathname (manager or owner)
        const isManager = window.location.pathname.startsWith("/manager");
        router.push(isManager ? "/manager/sfm" : "/owner/sfm");
      }
      setIsOpen(false);

      // Call API
      await fetch(`/api/alerts/${alert.id}/read`, { method: "PATCH" });
    } catch (err) {
      console.error("Error marking alert read:", err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return "text-red-500 bg-red-50 border-red-100";
      case "warning": return "text-orange-500 bg-orange-50 border-orange-100";
      case "success": return "text-green-600 bg-green-50 border-green-100";
      default: return "text-blue-500 bg-blue-50 border-blue-100";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded-full"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden z-50 flex flex-col max-h-[85vh]">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <h3 className="font-semibold text-slate-800">Notifikasi</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="overflow-y-auto p-2 space-y-1 flex-1">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-slate-500 flex flex-col items-center">
                <Bell className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm">Belum ada notifikasi baru</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => handleItemClick(alert)}
                  className={`w-full text-left p-3 rounded-md border transition-all hover:shadow-sm ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm">{alert.title}</span>
                    <span className="text-[10px] whitespace-nowrap opacity-70 ml-2">
                      {alert.createdAt
                        ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: localeId })
                        : "Baru saja"}
                    </span>
                  </div>
                  <p className="text-sm opacity-90 line-clamp-2">{alert.message}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
