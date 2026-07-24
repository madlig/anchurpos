"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogOverlay, DialogPortal, DialogClose
} from "@/components/ui/dialog";
import { 
  Plus, Calendar, Search, FileText, CreditCard, HelpCircle, User, Loader2, Check, ExternalLink, X, Building,
  ArrowUpRight, ArrowDownRight, Filter
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// --- Types ---
interface Expense {
  id: string;
  date: string;
  category: string;
  itemName: string;
  totalPrice: number;
  paymentMethod: string;
  supplier: string;
  notes: string;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
}

// --- Utils ---
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function getCategoryIcon(cat: string, size = 16, active = false) {
  const color = active ? "#fff" : "#64748B";
  switch (cat) {
    case "operasional": return <FileText size={size} color={color} />;
    case "lain_lain": return <HelpCircle size={size} color={color} />;
    default: return <HelpCircle size={size} color={color} />;
  }
}

function getCategoryLabel(cat: string) {
  switch (cat) {
    case "operasional": return "Operasional";
    case "lain_lain": return "Lain-lain";
    default: return cat;
  }
}

function getPaymentMethodLabel(method: string, size = 16, active = false) {
  const color = active ? "#fff" : "#64748B";
  switch (method) {
    case "cash": return <span className="flex items-center gap-1"><CreditCard size={size} color={color} /> Tunai</span>;
    case "transfer": return <span className="flex items-center gap-1"><Building size={size} color={color} /> Transfer</span>;
    case "qris": return <span className="flex items-center gap-1"><Search size={size} color={color} /> QRIS</span>;
    default: return method;
  }
}

// --- Form Component ---
function CashbookForm({ 
  onSuccess, onCancel, fetchWithAuth, suppliers, loadSuppliers 
}: { 
  onSuccess: () => void; 
  onCancel: () => void; 
  fetchWithAuth: any;
  suppliers: Supplier[];
  loadSuppliers: () => Promise<void>;
  configs: { paymentMethods: string[], deliveryMethods: string[], shippingBorneBy: string[] } | null;
}) {
  const [category, setCategory] = useState<"operasional" | "lain_lain">("operasional");
  const defaultPaymentMethod = configs?.paymentMethods?.[0] || "cash";
  const [itemName, setItemName] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(defaultPaymentMethod);
  const [notes, setNotes] = useState("");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Supplier logic
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [saveNewSupplier, setSaveNewSupplier] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredSuppliers = suppliers.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));
  const isNewSupplier = supplierSearch.trim().length > 0 && !suppliers.some((s) => s.name.toLowerCase() === supplierSearch.toLowerCase());

  async function handleSubmit() {
    setError("");
    if (!itemName.trim() || !totalCost || parseFloat(totalCost) <= 0) {
      setError("Nama pengeluaran dan total biaya wajib diisi dengan benar");
      return;
    }

    setSaving(true);
    try {
      let finalSupplierName = selectedSupplier ? selectedSupplier.name : supplierSearch.trim();
      if (isNewSupplier && saveNewSupplier && supplierSearch.trim()) {
        const supRes = await fetchWithAuth("/api/suppliers", {
          method: "POST",
          body: JSON.stringify({ name: supplierSearch.trim() }),
        });
        if (supRes.ok) {
          const newSup = await supRes.json();
          finalSupplierName = newSup.name;
          await loadSuppliers();
        }
      }

      const res = await fetchWithAuth("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          itemName: itemName.trim(),
          category,
          totalPrice: parseFloat(totalCost),
          paymentMethod,
          supplier: finalSupplierName || null,
          notes: notes.trim() || null,
          customDate: customDate || null,
        }),
      });

      if (!res.ok) {
        const resData = await res.json();
        setError(resData.error ?? "Gagal menyimpan pengeluaran");
        setSaving(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600">
          ⚠ {error}
        </div>
      )}

      {/* Kategori */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Kategori</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(["operasional", "lain_lain"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`flex items-center justify-center p-2 rounded-xl text-xs font-bold transition-all ${category === cat ? 'bg-primary text-white' : 'bg-white text-slate-500 shadow-sm'}`}
            >
              <span className="mr-1.5">{getCategoryIcon(cat, 14, category === cat)}</span>
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Tanggal</label>
          <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="h-10 rounded-xl text-xs bg-brand-50" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Total Biaya (Rp)</label>
          <Input type="number" placeholder="Contoh: 150000" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} className="h-10 rounded-xl font-bold text-primary" />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Nama Pengeluaran</label>
        <Input type="text" placeholder="Contoh: Bayar Listrik Bulan Ini" value={itemName} onChange={(e) => setItemName(e.target.value)} className="h-10 rounded-xl text-xs bg-brand-50" />
      </div>

      {/* Supplier */}
      <div className="relative">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Penerima Dana (Opsional)</label>
        {selectedSupplier ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50 border border-indigo-100">
            <span className="text-xs font-bold text-indigo-700">{selectedSupplier.name}</span>
            <button type="button" onClick={() => { setSelectedSupplier(null); setSupplierSearch(""); }} className="p-1 rounded bg-indigo-200 text-indigo-700"><X size={12} /></button>
          </div>
        ) : (
          <>
            <Input type="text" placeholder="Ketik nama vendor/penerima..." value={supplierSearch} onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); setSaveNewSupplier(false); }} onFocus={() => setShowSupplierDropdown(true)} className="h-10 rounded-xl text-xs bg-brand-50" />
            {showSupplierDropdown && (supplierSearch.trim() || filteredSuppliers.length > 0) && (
              <div className="absolute left-0 right-0 mt-1 z-40 max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-xl" onMouseLeave={() => setShowSupplierDropdown(false)}>
                {filteredSuppliers.map((sup) => (
                  <div key={sup.id} onClick={() => { setSelectedSupplier(sup); setSupplierSearch(sup.name); setShowSupplierDropdown(false); }} className="px-3 py-2 text-xs font-semibold hover:bg-brand-50 cursor-pointer">{sup.name}</div>
                ))}
                {isNewSupplier && (
                  <div className="p-3 bg-brand-50 border-t">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={saveNewSupplier} onChange={(e) => setSaveNewSupplier(e.target.checked)} className="rounded text-primary" />
                      <span className="text-xs font-bold">Simpan sebagai penerima/vendor baru</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Metode Pembayaran</label>
        <div className="flex flex-wrap gap-1.5">
          {(configs?.paymentMethods || ["cash", "transfer", "qris"]).map((method) => (
            <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`flex-1 p-2 rounded-xl text-xs font-bold flex justify-center items-center ${paymentMethod === method ? 'bg-primary text-white' : 'bg-white text-slate-500 shadow-sm'}`}>
              {getPaymentMethodLabel(method, 14, paymentMethod === method)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Catatan Tambahan</label>
        <Input type="text" placeholder="Catatan tambahan..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10 rounded-xl text-xs bg-brand-50" />
      </div>

      <div className="flex gap-2.5 pt-2">
        <Button onClick={handleSubmit} disabled={saving} className="flex-1 h-11 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary">
          {saving ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Menyimpan...</> : "Simpan Pengeluaran"}
        </Button>
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function ExpensesPage() {
  const { getToken } = useAuth();
  const { alert, confirm } = useAlertConfirm();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal / Drawer state
  const [isDesktopDialog, setIsDesktopDialog] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [configs, setConfigs] = useState<{ paymentMethods: string[], deliveryMethods: string[], shippingBorneBy: string[] } | null>(null);
  const [prevMonthTotal, setPrevMonthTotal] = useState(0);

  // Filters
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Check screen size
  useEffect(() => {
    const checkSize = () => setIsDesktopDialog(window.innerWidth >= 768);
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      // Load current period
      const [res, resConfigs] = await Promise.all([
        fetchWithAuth(`/api/expenses?startDate=${startDate}&endDate=${endDate}`),
        fetchWithAuth(`/api/system-configs`),
      ]);
      if (res.ok) setExpenses(await res.json());
      if (resConfigs.ok) setConfigs(await resConfigs.json());

      // Load previous month for trend
      const date = new Date(startDate);
      date.setMonth(date.getMonth() - 1);
      const prevStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0];
      const prevEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0];
      const resPrev = await fetchWithAuth(`/api/expenses?startDate=${prevStart}&endDate=${prevEnd}`);
      if (resPrev.ok) {
        const prevData: Expense[] = await resPrev.json();
        const prevTot = prevData.filter(e => e.category === "operasional" || e.category === "lain_lain").reduce((acc, curr) => acc + curr.totalPrice, 0);
        setPrevMonthTotal(prevTot);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [fetchWithAuth, startDate, endDate]);

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/suppliers");
      if (res.ok) setSuppliers(await res.json());
    } catch (err) { console.error(err); }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadExpenses();
    loadSuppliers();
  }, [loadExpenses, loadSuppliers]);

  const handleDelete = async (id: string) => {
    if (await confirm("Apakah Anda yakin ingin menghapus pengeluaran ini?", "Tindakan ini tidak bisa dibatalkan.")) {
      try {
        const res = await fetchWithAuth(`/api/expenses/${id}`, { method: "DELETE" });
        if (res.ok) { alert("Berhasil", "Data dihapus", "success"); loadExpenses(); } 
        else alert("Gagal", "Terjadi kesalahan", "danger");
      } catch (e) { alert("Error", "Gagal menghubungi server", "danger"); }
    }
  };

  const filtered = expenses.filter(e => {
    if (e.category !== "operasional" && e.category !== "lain_lain") return false;
    if (searchQuery && !e.itemName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterMethod !== "all" && e.paymentMethod !== filterMethod) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterSupplier !== "all" && e.supplier !== filterSupplier) return false;
    return true;
  });
  
  const totalExpense = filtered.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const trendPercent = prevMonthTotal > 0 ? ((totalExpense - prevMonthTotal) / prevMonthTotal) * 100 : 0;
  const isTrendUp = trendPercent > 0;

  if (loading && expenses.length === 0) {
    return <div className="flex h-screen items-center justify-center bg-brand-50"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }

  const renderForm = () => (
    <CashbookForm 
      onSuccess={() => { setShowForm(false); loadExpenses(); }} 
      onCancel={() => setShowForm(false)} 
      fetchWithAuth={fetchWithAuth} 
      suppliers={suppliers} 
      loadSuppliers={loadSuppliers} 
      configs={configs}
    />
  );

  return (
    <div className="min-h-screen bg-brand-50 pb-20">
      <div className="bg-white px-5 pt-12 pb-6 rounded-b-[2rem] shadow-sm relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Buku Kas & OpEx</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Catat biaya operasional dan arus kas keluar.</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-2xl">
            <CreditCard className="text-primary" size={24} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Biaya (Periode Ini)</p>
            <p className="text-xl font-extrabold text-primary truncate">{fmt(totalExpense)}</p>
            <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
              {prevMonthTotal > 0 ? (
                <>
                  <span className={`flex items-center ${isTrendUp ? 'text-red-500' : 'text-emerald-500'}`}>
                    {isTrendUp ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
                    {Math.abs(trendPercent).toFixed(1)}%
                  </span>
                  <span className="text-slate-400">vs bln lalu</span>
                </>
              ) : (
                <span className="text-slate-400">Bulan lalu: {fmt(prevMonthTotal)}</span>
              )}
            </div>
          </Card>
          <div className="flex flex-col space-y-2 justify-center">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs rounded-xl border-slate-200" />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs rounded-xl border-slate-200" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setShowForm(true)} className="flex-1 h-11 rounded-2xl bg-primary hover:bg-primary text-white font-bold shadow-sm transition-all flex items-center justify-center gap-2">
            <Plus size={16} /> Catat Pengeluaran
          </Button>
        </div>
      </div>

      <div className="px-4 -mt-2 relative z-20">
        <div className="max-w-5xl mx-auto space-y-4">
          
          {/* Filters */}
          <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input type="text" placeholder="Cari nama pengeluaran..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 h-10 bg-white border-slate-200 rounded-xl text-sm" />
            </div>
            <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 shrink-0 no-scrollbar">
              <div className="flex items-center gap-1.5 px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600">
                <Filter size={14} className="text-slate-400" />
                <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="bg-transparent focus:outline-none">
                  <option value="all">Semua Bayar</option>
                  {(configs?.paymentMethods || ["cash", "transfer", "qris"]).map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600">
                <Filter size={14} className="text-slate-400" />
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-transparent focus:outline-none">
                  <option value="all">Semua Kategori</option>
                  <option value="operasional">Operasional</option>
                  <option value="lain_lain">Lain-lain</option>
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block mt-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-brand-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Tanggal</th>
                    <th className="px-4 py-3 min-w-[200px]">Nama Pengeluaran</th>
                    <th className="px-4 py-3 whitespace-nowrap">Kategori</th>
                    <th className="px-4 py-3 whitespace-nowrap">Metode</th>
                    <th className="px-4 py-3 whitespace-nowrap">Penerima</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Total Harga</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 font-semibold text-slate-400">Tidak ada data</td></tr>
                  ) : (
                    filtered.map(exp => (
                      <tr key={exp.id} className="hover:bg-brand-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(exp.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {exp.itemName}
                          {exp.notes && <div className="text-xs text-slate-400 font-normal italic mt-0.5">{exp.notes}</div>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold ${exp.category === 'operasional' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                            {getCategoryIcon(exp.category, 12, false)} {getCategoryLabel(exp.category)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap capitalize">{exp.paymentMethod}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{exp.supplier || "-"}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-700 whitespace-nowrap">{fmt(exp.totalPrice)}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button onClick={() => handleDelete(exp.id)} className="text-xs text-red-500 font-bold hover:underline px-2 py-1 rounded bg-red-50">Hapus</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden space-y-3 pb-8 mt-4">
            {filtered.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-100 border-dashed">
                <FileText className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-sm font-semibold text-slate-600">Tidak ada pengeluaran</p>
                <p className="text-xs text-slate-400">Periode atau filter tersebut kosong.</p>
              </div>
            ) : (
              filtered.map((exp) => (
                <Card key={exp.id} className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${exp.category === "operasional" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`}>
                        {getCategoryIcon(exp.category, 16, false)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{exp.itemName}</h3>
                        <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-400">
                          <span className="flex items-center gap-1"><Calendar size={10}/> {new Date(exp.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })}</span>
                          {exp.supplier && <span className="flex items-center gap-1 line-clamp-1 break-all">• <User size={10}/> {exp.supplier}</span>}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-extrabold text-primary shrink-0 ml-2">{fmt(exp.totalPrice)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-white text-slate-500 shadow-sm font-bold uppercase tracking-wider">{exp.paymentMethod}</span>
                      {exp.notes && <span className="text-xs text-slate-400 italic line-clamp-1 max-w-[120px]">"{exp.notes}"</span>}
                    </div>
                    <button onClick={() => handleDelete(exp.id)} className="text-xs text-red-500 font-bold hover:underline">Hapus</button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Responsive Form Modal/Drawer */}
      {isDesktopDialog ? (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-[450px] p-6 rounded-3xl border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <span className="text-2xl">📝</span> Catat Pengeluaran Baru
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {renderForm()}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <BottomSheet isOpen={showForm} onClose={() => setShowForm(false)} title="Catat Pengeluaran" icon="📝">
          {renderForm()}
        </BottomSheet>
      )}
    </div>
  );
}
