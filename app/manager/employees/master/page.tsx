"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { Loader2, Plus, Users, UserPlus, Pencil, KeyRound, Trash2, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { Employee, ROLE_LABEL } from "../types";
import { EmployeeForm, ChangePasswordForm } from "../components/SharedForms";

export default function MasterEmployeePage() {
  const { role, getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [pwEmp, setPwEmp] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/employees");
      if (res.ok) {
        setEmployees(await res.json());
      } else {
        setError("Gagal memuat data karyawan");
      }
    } catch (e) {
      setError("Kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDelete = async (emp: Employee) => {
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/employees/${emp.id}`, { method: "DELETE" });
      if (res.ok) {
        showSuccess(`Karyawan ${emp.name} berhasil dinonaktifkan`);
        setDeleteTarget(null);
        setExpandedId(null);
        loadEmployees();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menonaktifkan karyawan");
      }
    } catch (e) {
      alert("Kesalahan jaringan");
    } finally {
      setDeleting(false);
    }
  };

  const activeEmps = employees.filter(e => e.isActive !== false);
  const inactiveEmps = employees.filter(e => e.isActive === false);

  if (role !== "owner" && role !== "manager") {
    return <div className="p-6 text-center text-red-500 font-bold">Akses ditolak. Hanya untuk Manager/Owner.</div>;
  }

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-black text-slate-800">Master Karyawan</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Kelola data dan akses login tim Anda.</p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditEmp(null); }}
          className="tap-target flex items-center gap-2 h-11 px-5 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-sm hover:bg-black active:scale-95 transition-all"
        >
          <UserPlus size={16} /> Tambah Karyawan
        </button>
      </div>

      {successMsg && (
        <div className="animate-in slide-in-from-top-2" style={{ padding: "12px 16px", background: "#D1FAE5", color: "#065F46", borderRadius: "12px", fontSize: "13px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", border: "1px solid #A7F3D0" }}>
          <Check size={16} /> {successMsg}
        </div>
      )}

      {showAddForm && (
        <EmployeeForm
          fetchWithAuth={fetchWithAuth}
          onSuccess={() => { setShowAddForm(false); loadEmployees(); showSuccess("Karyawan baru berhasil ditambahkan!"); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {editEmp && (
        <EmployeeForm
          fetchWithAuth={fetchWithAuth}
          initial={editEmp}
          onSuccess={() => { setEditEmp(null); loadEmployees(); showSuccess("Data karyawan berhasil diperbarui!"); }}
          onCancel={() => setEditEmp(null)}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-500 font-bold">{error}</div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {activeEmps.map(emp => {
              const expanded = expandedId === emp.id;
              const rc = emp.role === "manager" ? { bg: "#FEF3C7", color: "#D97706" } : { bg: "#F1F5F9", color: "#64748B" };

              return (
                <div key={emp.id} className="bg-white rounded-3xl p-4 border border-slate-200/60 shadow-sm transition-all hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div style={{ width: "38px", height: "38px", borderRadius: "12px", background: rc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "15px", fontWeight: "800", color: rc.color }}>{emp.name[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94A3B8" }}>@{emp.username}</span>
                          <span style={{ padding: "1px 7px", borderRadius: "100px", fontSize: "10px", fontWeight: "700", background: rc.bg, color: rc.color }}>
                            {ROLE_LABEL[emp.role]}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setExpandedId(expanded ? null : emp.id)}
                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors">
                        {expanded ? <ChevronUp size={14} style={{ color: "#64748B" }} /> : <ChevronDown size={14} style={{ color: "#64748B" }} />}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
                      {emp.phone && <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>HP: {emp.phone}</p>}
                      
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => { setEditEmp(emp); setExpandedId(null); }}
                          className="flex items-center gap-1.5"
                          style={{ padding: "7px 12px", borderRadius: "10px", background: "#FEF1F5", color: "#E85D8C", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                          <Pencil size={12} /> Edit Data
                        </button>
                        <button onClick={() => { setPwEmp(pwEmp?.id === emp.id ? null : emp); setDeleteTarget(null); }}
                          className="flex items-center gap-1.5"
                          style={{ padding: "7px 12px", borderRadius: "10px", background: "#FEF3C7", color: "#D97706", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                          <KeyRound size={12} /> Ganti Password
                        </button>
                        <button onClick={() => { setDeleteTarget(deleteTarget?.id === emp.id ? null : emp); setPwEmp(null); }}
                          className="flex items-center gap-1.5"
                          style={{ padding: "7px 12px", borderRadius: "10px", background: "#FEE2E2", color: "#DC2626", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                          <Trash2 size={12} /> Nonaktifkan
                        </button>
                      </div>

                      {pwEmp?.id === emp.id && (
                        <ChangePasswordForm emp={emp} fetchWithAuth={fetchWithAuth}
                          onSuccess={() => { setPwEmp(null); showSuccess(`Password ${emp.username} berhasil diubah`); }}
                          onCancel={() => setPwEmp(null)} />
                      )}

                      {deleteTarget?.id === emp.id && (
                        <div style={{ background: "#FEF2F2", borderRadius: "10px", padding: "12px", border: "1px solid #FECACA", marginTop: "8px" }}>
                          <p style={{ fontSize: "12px", fontWeight: "600", color: "#DC2626", marginBottom: "10px" }}>
                            Nonaktifkan akun {emp.name}? Mereka tidak bisa login lagi.
                          </p>
                          <div className="flex gap-2">
                            <button onClick={() => handleDelete(emp)} disabled={deleting}
                              style={{ flex: 1, padding: "9px", borderRadius: "9px", background: "#DC2626", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Nonaktifkan
                            </button>
                            <button onClick={() => setDeleteTarget(null)}
                              style={{ flex: 1, padding: "9px", borderRadius: "9px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "12px" }}>
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {inactiveEmps.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                Tidak Aktif ({inactiveEmps.length})
              </p>
              <div className="flex flex-col gap-2">
                {inactiveEmps.map(emp => (
                  <div key={emp.id} style={{ background: "#fff", borderRadius: "12px", padding: "12px 14px", border: "1px solid #F1F5F9", opacity: 0.6 }}>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#94A3B8" }}>{emp.name}</p>
                    <p style={{ fontSize: "11px", fontFamily: "monospace", color: "#CBD5E1" }}>@{emp.username}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
