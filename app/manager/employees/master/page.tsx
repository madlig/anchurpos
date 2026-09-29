"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Search,
  Plus,
  UserPlus,
  Pencil,
  KeyRound,
  Trash2,
  Check,
  X,
  Phone,
  Calendar,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Loader2,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Employee, Role, ROLE_LABEL } from "../types";
import { EmployeeModal } from "@/components/shared/EmployeeModal";
import { ChangePasswordModal } from "@/components/shared/ChangePasswordModal";

function fmtDate(d?: string | null) {
  if (!d) return null;
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function fmtCurrency(val: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);
}

type TabType = "all" | "crew" | "manager" | "inactive";

export default function MasterEmployeePage() {
  const { user, role: currentUserRole, fetchWithAuth } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");

  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState<Employee | null>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState<Employee | null>(null);

  // Deactivate confirmation state
  const [deactivatingEmp, setDeactivatingEmp] = useState<Employee | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Reactivate confirmation / loading state
  const [reactivatingEmpId, setReactivatingEmpId] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/employees");
      if (res.ok) {
        setEmployees(await res.json());
      } else {
        setError("Gagal memuat data karyawan");
      }
    } catch {
      setError("Kesalahan koneksi jaringan");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Actions
  const handleDeactivate = async (emp: Employee) => {
    setDeactivating(true);
    try {
      const res = await fetchWithAuth(`/api/employees/${emp.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Akun ${emp.name} berhasil dinonaktifkan`);
        setDeactivatingEmp(null);
        await loadEmployees();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Gagal menonaktifkan karyawan");
      }
    } catch {
      alert("Terjadi kesalahan jaringan saat menonaktifkan karyawan");
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async (emp: Employee) => {
    setReactivatingEmpId(emp.id);
    try {
      const res = await fetchWithAuth(`/api/employees/${emp.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        showToast(`Akun ${emp.name} berhasil diaktifkan kembali!`);
        await loadEmployees();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Gagal mengaktifkan kembali akun");
      }
    } catch {
      alert("Terjadi kesalahan jaringan saat mengaktifkan akun");
    } finally {
      setReactivatingEmpId(null);
    }
  };

  // Filtered lists & counts
  const counts = useMemo(() => {
    const total = employees.length;
    const crew = employees.filter((e) => e.isActive !== false && e.role === "crew").length;
    const manager = employees.filter((e) => e.isActive !== false && (e.role === "manager" || e.role === "owner")).length;
    const inactive = employees.filter((e) => e.isActive === false).length;
    return { total, crew, manager, inactive };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Role & status filter
      if (activeTab === "crew" && (emp.isActive === false || emp.role !== "crew")) return false;
      if (activeTab === "manager" && (emp.isActive === false || (emp.role !== "manager" && emp.role !== "owner"))) return false;
      if (activeTab === "inactive" && emp.isActive !== false) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = emp.name?.toLowerCase().includes(q);
        const matchUser = emp.username?.toLowerCase().includes(q);
        const matchPhone = emp.phone?.toLowerCase().includes(q);
        return matchName || matchUser || matchPhone;
      }

      return true;
    });
  }, [employees, activeTab, searchQuery]);

  if (currentUserRole !== "owner" && currentUserRole !== "manager") {
    return (
      <div className="p-8 text-center text-rose-500 font-bold bg-white rounded-3xl border border-rose-100 shadow-xs">
        <ShieldAlert size={32} className="mx-auto mb-2 text-rose-500" />
        Akses ditolak. Halaman ini hanya untuk Manager dan Owner.
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Master Karyawan</h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Kelola data profil, hak akses akun, dan status kerja tim.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedEmployeeForEdit(null);
            setIsEmployeeModalOpen(true);
          }}
          className="tap-target inline-flex items-center justify-center gap-2 h-11 px-5 rounded-2xl bg-slate-900 text-white font-bold text-xs shadow-md hover:bg-black active:scale-95 transition-all"
        >
          <UserPlus size={16} />
          <span>Tambah Karyawan</span>
        </button>
      </div>

      {/* Success Notification Toast */}
      {toastMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs animate-in slide-in-from-top-2 duration-200">
          <Check size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Search & Filter Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/70 shadow-xs space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, @username, atau no. HP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 bg-slate-50/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Tab Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`tap-target px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            Semua
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "all" ? "bg-white/20 text-white" : "bg-white text-slate-700"}`}>
              {counts.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("crew")}
            className={`tap-target px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "crew"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            Crew
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "crew" ? "bg-white/20 text-white" : "bg-white text-slate-700"}`}>
              {counts.crew}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("manager")}
            className={`tap-target px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "manager"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            Manager & Owner
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "manager" ? "bg-white/20 text-white" : "bg-white text-slate-700"}`}>
              {counts.manager}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("inactive")}
            className={`tap-target px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "inactive"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-600 hover:bg-rose-100"
            }`}
          >
            Nonaktif
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "inactive" ? "bg-white/20 text-white" : "bg-white text-rose-700"}`}>
              {counts.inactive}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content List */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white rounded-3xl border border-rose-100 text-rose-500 font-bold shadow-xs">
          {error}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200/60 shadow-xs space-y-2">
          <Users size={36} className="mx-auto text-slate-300" />
          <p className="text-sm font-extrabold text-slate-700">Tidak ada karyawan yang ditemukan</p>
          <p className="text-xs text-slate-400">
            {searchQuery
              ? `Tidak ada hasil untuk kata kunci "${searchQuery}"`
              : "Belum ada data pada kategori ini."}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs font-bold text-primary underline mt-2 inline-block cursor-pointer"
            >
              Reset pencarian
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredEmployees.map((emp) => {
            const isInactive = emp.isActive === false;
            const isSelf = user?.uid === emp.id;
            const isOwnerAccount = emp.role === "owner";
            const isManagerAccount = emp.role === "manager";

            // Permission hierarchy checks:
            // Manager cannot edit/change pw for Owner
            const canEdit = currentUserRole === "owner" || !isOwnerAccount;
            const canChangePw =
              currentUserRole === "owner" ||
              (!isOwnerAccount && (!isManagerAccount || isSelf));

            // Deactivate hierarchy:
            // Cannot deactivate self
            // Manager cannot deactivate Owner or other Manager
            const canDeactivate =
              !isSelf &&
              (currentUserRole === "owner" || (!isOwnerAccount && !isManagerAccount));

            // Reactivate hierarchy:
            // Manager can reactivate crew/manager, owner can reactivate all
            const canReactivate = currentUserRole === "owner" || !isOwnerAccount;

            // Role Badge styling
            const roleBadgeStyle =
              emp.role === "owner"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : emp.role === "manager"
                ? "bg-blue-100 text-blue-800 border-blue-200"
                : "bg-slate-100 text-slate-700 border-slate-200";

            // Avatar styling
            const avatarBg =
              emp.role === "owner"
                ? "bg-amber-500 text-white"
                : emp.role === "manager"
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-white";

            const isDeactivatingThis = deactivatingEmp?.id === emp.id;
            const isReactivatingThis = reactivatingEmpId === emp.id;

            return (
              <div
                key={emp.id}
                className={`bg-white rounded-3xl p-4 sm:p-5 border transition-all duration-200 ${
                  isInactive
                    ? "border-slate-200/50 bg-slate-50/40 opacity-80"
                    : "border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {/* Header: Avatar, Name, Role, Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-base flex-shrink-0 shadow-xs ${avatarBg}`}
                    >
                      {emp.name ? emp.name[0].toUpperCase() : "?"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                          {emp.name}
                        </h3>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900 text-white">
                            Anda
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-[11px] font-mono font-bold text-slate-500">
                          @{emp.username}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${roleBadgeStyle}`}
                        >
                          {ROLE_LABEL[emp.role] || emp.role}
                        </span>

                        {isInactive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Nonaktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Aktif
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Details Row */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* Gaji Shift */}
                  <div className="flex items-center gap-2 text-slate-600">
                    <Wallet size={14} className="text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block leading-tight">
                        Gaji Shift
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {fmtCurrency(emp.dailyWage ?? 60000)}
                      </span>
                    </div>
                  </div>

                  {/* Tanggal Bergabung */}
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block leading-tight">
                        Bergabung
                      </span>
                      <span className="font-bold text-slate-700">
                        {fmtDate(emp.joinDate) || "Belum dicatat"}
                      </span>
                    </div>
                  </div>

                  {/* No. HP */}
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={14} className="text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block leading-tight">
                        No. HP
                      </span>
                      {emp.phone ? (
                        <a
                          href={`tel:${emp.phone}`}
                          className="font-bold text-primary hover:underline"
                          title="Klik untuk menelepon"
                        >
                          {emp.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 font-medium">Tidak ada nomor</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hierarchy Security Notice for Managers */}
                {currentUserRole === "manager" && isOwnerAccount && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-amber-800 text-[11px] font-bold flex items-center gap-2">
                    <ShieldCheck size={14} className="text-amber-600 flex-shrink-0" />
                    <span>Akun Owner terproteksi (hanya dapat dikelola oleh Owner).</span>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Edit Button */}
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => {
                        setSelectedEmployeeForEdit(emp);
                        setIsEmployeeModalOpen(true);
                      }}
                      className="tap-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Pencil size={13} className="text-slate-500" />
                      <span>Edit Data</span>
                    </button>

                    {/* Change Password Button */}
                    <button
                      type="button"
                      disabled={!canChangePw}
                      onClick={() => {
                        setSelectedEmployeeForPassword(emp);
                        setIsPasswordModalOpen(true);
                      }}
                      className="tap-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <KeyRound size={13} className="text-amber-600" />
                      <span>Ganti Password</span>
                    </button>
                  </div>

                  {/* Status Toggle Actions: Deactivate OR Reactivate */}
                  <div>
                    {isInactive ? (
                      /* Reactivate Button (Point 1 requirement) */
                      <button
                        type="button"
                        disabled={!canReactivate || isReactivatingThis}
                        onClick={() => handleReactivate(emp)}
                        className="tap-target inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 shadow-xs"
                      >
                        {isReactivatingThis ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <RotateCcw size={13} />
                        )}
                        <span>{isReactivatingThis ? "Mengaktifkan..." : "Aktifkan Kembali"}</span>
                      </button>
                    ) : (
                      /* Deactivate Button */
                      canDeactivate && (
                        <button
                          type="button"
                          onClick={() => setDeactivatingEmp(emp)}
                          className="tap-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all"
                        >
                          <Trash2 size={13} className="text-rose-500" />
                          <span>Nonaktifkan</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Inline Deactivate Confirmation */}
                {isDeactivatingThis && (
                  <div className="mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl animate-in fade-in duration-150 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-rose-800">
                          Nonaktifkan akun {emp.name}?
                        </p>
                        <p className="text-[11px] font-medium text-rose-700 mt-0.5">
                          Karyawan ini tidak akan bisa login ke aplikasi absensi maupun POS kasir.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDeactivatingEmp(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={deactivating}
                        onClick={() => handleDeactivate(emp)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs"
                      >
                        {deactivating ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        <span>{deactivating ? "Memproses..." : "Ya, Nonaktifkan"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Employee Modal (Create / Edit) */}
      <EmployeeModal
        isOpen={isEmployeeModalOpen}
        initial={selectedEmployeeForEdit}
        onClose={() => setIsEmployeeModalOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          loadEmployees();
        }}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        emp={selectedEmployeeForPassword}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
        }}
      />
    </div>
  );
}
