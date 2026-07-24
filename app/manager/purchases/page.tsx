"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { 
  Plus, Calendar, Search, CreditCard, Package, Loader2, X, ArrowUpRight, ArrowDownRight, Filter, User
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// --- Types ---
interface Purchase {
  id: string;
  date: string;
  category: string;
  ingredientId: string;
  itemName: string;
  qtyPurchased: number;
  purchaseUnit: string;
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

interface UnitAlternative {
  unit: string;
  conversionToBase: number;
}

interface Ingredient {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  unitAlternatives: UnitAlternative[];
  currentStock: number;
}

// --- Utils ---
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

// --- Form Component ---
// --- Form Component ---
interface CartItem {
  id: string; // temp id for UI
  category: "bahan_baku" | "packaging";
  ingredientId: string;
  ingredientName: string;
  qtyPurchased: number;
  purchaseUnit: string;
  totalPrice: number;
}

function RestockForm({ 
  onSuccess, onCancel, fetchWithAuth, suppliers, ingredients, configs
}: { 
  onSuccess: () => void; 
  onCancel: () => void; 
  fetchWithAuth: any;
  suppliers: Supplier[];
  ingredients: Ingredient[];
  configs: { paymentMethods: string[], deliveryMethods: string[], shippingBorneBy: string[] } | null;
}) {
  // Global Note Data
  const defaultPaymentMethod = configs?.paymentMethods?.[0] || "cash";
  const [paymentMethod, setPaymentMethod] = useState<string>(defaultPaymentMethod);
  const [notes, setNotes] = useState("");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);
  
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));

  // Cart Data
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Current Form Item
  const [category, setCategory] = useState<"bahan_baku" | "packaging">("bahan_baku");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [qtyPurchased, setQtyPurchased] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [totalCost, setTotalCost] = useState("");

  const [ingSearch, setIngSearch] = useState("");
  const [showIngDropdown, setShowIngDropdown] = useState(false);
  const filteredIng = ingredients.filter(i => i.category === category && i.name.toLowerCase().includes(ingSearch.toLowerCase()));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableUnits = selectedIngredient 
    ? [selectedIngredient.baseUnit, ...selectedIngredient.unitAlternatives.map(u => u.unit)]
    : [];

  useEffect(() => {
    if (selectedIngredient && availableUnits.length > 0 && !availableUnits.includes(purchaseUnit)) {
      setPurchaseUnit(availableUnits[0]);
    }
  }, [selectedIngredient, availableUnits, purchaseUnit]);

  function handleAddToCart() {
    setError("");
    if (!selectedIngredient) { setError("Pilih barang terlebih dahulu"); return; }
    if (!qtyPurchased || parseFloat(qtyPurchased) <= 0) { setError("Kuantitas wajib diisi"); return; }
    if (!purchaseUnit) { setError("Satuan wajib dipilih"); return; }
    if (!totalCost || parseFloat(totalCost) <= 0) { setError("Total harga wajib diisi"); return; }

    // Prevent duplicate ingredient
    if (cartItems.some(i => i.ingredientId === selectedIngredient.id)) {
      setError("Barang ini sudah ada di dalam keranjang nota. Silakan gabungkan jumlah/harganya terlebih dahulu jika ingin menambahkannya lagi.");
      return;
    }

    const newItem: CartItem = {
      id: Math.random().toString(36).substring(7),
      category,
      ingredientId: selectedIngredient.id,
      ingredientName: selectedIngredient.name,
      qtyPurchased: parseFloat(qtyPurchased),
      purchaseUnit,
      totalPrice: parseFloat(totalCost)
    };

    setCartItems([...cartItems, newItem]);
    
    // Reset Form Item
    setSelectedIngredient(null);
    setIngSearch("");
    setQtyPurchased("");
    setTotalCost("");
  }

  function handleRemoveFromCart(id: string) {
    setCartItems(cartItems.filter(i => i.id !== id));
  }

  const grandTotal = cartItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

  async function handleSubmit() {
    setError("");
    if (cartItems.length === 0) {
      setError("Keranjang belanja masih kosong");
      return;
    }

    setSaving(true);
    try {
      const finalSupplierName = selectedSupplier ? selectedSupplier.name : supplierSearch.trim();
      
      const payload = {
        items: cartItems.map(({ id, ingredientName, ...rest }) => rest), // Remove UI-only fields
        paymentMethod,
        supplier: finalSupplierName || null,
        notes: notes.trim() || undefined,
        customDate: customDate || undefined, // Zod optional requires undefined, not null
      };

      const res = await fetchWithAuth("/api/purchases", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const resData = await res.json();
        console.error("API Error Details:", resData.details); // Log validation details
        setError(resData.error ?? "Gagal menyimpan pembelian");
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
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs font-bold text-red-600 shadow-sm animate-in fade-in">
          ⚠ {error}
        </div>
      )}

      {/* -- NOTA HEADER -- */}
      <div className="p-4 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
        <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-2 mb-2"><CreditCard size={16} className="text-slate-400" /> Informasi Nota</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Tanggal Nota</label>
            <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="h-10 rounded-xl text-xs bg-white border-slate-200" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Toko / Supplier</label>
            <div className="relative z-40">
              {selectedSupplier ? (
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 truncate">{selectedSupplier.name}</span>
                  <button type="button" onClick={() => { setSelectedSupplier(null); setSupplierSearch(""); }} className="p-1 rounded bg-slate-100 text-slate-600"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <Input type="text" placeholder="Nama toko..." value={supplierSearch} onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }} onFocus={() => setShowSupplierDropdown(true)} className="h-10 rounded-xl text-xs bg-white border-slate-200" />
                  {showSupplierDropdown && filteredSuppliers.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-xl" onMouseLeave={() => setShowSupplierDropdown(false)}>
                      {filteredSuppliers.map((sup) => (
                        <div key={sup.id} onClick={() => { setSelectedSupplier(sup); setSupplierSearch(sup.name); setShowSupplierDropdown(false); }} className="px-3 py-2 text-xs font-semibold hover:bg-brand-50 cursor-pointer">{sup.name}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -- CART ITEMS -- */}
      {cartItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-extrabold text-slate-700">Keranjang Belanja ({cartItems.length})</h3>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
            {cartItems.map((item, idx) => (
              <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm group">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 leading-tight">{item.ingredientName}</p>
                    <p className="text-xs font-medium text-slate-500">{item.qtyPurchased} {item.purchaseUnit}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-extrabold text-slate-700">{fmt(item.totalPrice)}</p>
                  <button onClick={() => handleRemoveFromCart(item.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between mt-2">
              <span className="text-sm font-bold text-primary uppercase tracking-wide">Total Nota</span>
              <span className="text-lg font-black text-primary">{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* -- INPUT BARU -- */}
      <div className="p-4 border-2 border-dashed border-slate-200 rounded-3xl bg-white space-y-4">
        <h3 className="text-sm font-extrabold text-slate-700">Tambah Barang ke Keranjang</h3>
        
        <div>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {(["bahan_baku", "packaging"] as const).map((cat) => (
              <button
                key={cat} type="button" onClick={() => { setCategory(cat); setSelectedIngredient(null); setIngSearch(""); }}
                className={`flex items-center justify-center p-2 rounded-xl text-xs font-bold transition-all ${category === cat ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 shadow-sm'}`}
              >
                <Package size={14} className="mr-1.5" />
                {cat === "bahan_baku" ? "Bahan Baku" : "Packaging"}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-50">
          {selectedIngredient ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-primary/10 border border-primary/20">
              <div>
                <span className="text-xs font-bold text-primary block">{selectedIngredient.name}</span>
                <span className="text-[10px] font-medium text-primary/70">Stok saat ini: {selectedIngredient.currentStock} {selectedIngredient.baseUnit}</span>
              </div>
              <button type="button" onClick={() => setSelectedIngredient(null)} className="p-1.5 rounded-lg bg-primary/20 text-primary"><X size={12} /></button>
            </div>
          ) : (
            <>
              <Input type="text" placeholder={`Cari nama ${category === 'bahan_baku' ? 'bahan' : 'packaging'}...`} value={ingSearch} onChange={(e) => { setIngSearch(e.target.value); setShowIngDropdown(true); }} onFocus={() => setShowIngDropdown(true)} className="h-10 rounded-xl text-xs bg-slate-50 border-slate-200" />
              {showIngDropdown && (
                <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-xl" onMouseLeave={() => setShowIngDropdown(false)}>
                  {filteredIng.length > 0 ? filteredIng.map((ing) => (
                    <div key={ing.id} onClick={() => { setSelectedIngredient(ing); setShowIngDropdown(false); }} className="px-3 py-2 text-xs font-semibold hover:bg-brand-50 cursor-pointer flex justify-between">
                      <span>{ing.name}</span>
                      <span className="text-slate-400">{ing.baseUnit}</span>
                    </div>
                  )) : (
                    <div className="p-3 text-xs text-slate-500 text-center bg-brand-50">
                      Bahan tidak ditemukan. Daftarkan di Master Data.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {selectedIngredient && (
          <div className="grid grid-cols-2 gap-3 animate-in fade-in">
            <div>
              <Input type="number" placeholder="Kuantitas" value={qtyPurchased} onChange={(e) => setQtyPurchased(e.target.value)} className="h-10 rounded-xl font-bold bg-slate-50 text-xs" />
            </div>
            <div>
              <select value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 text-xs px-3 font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/100">
                {availableUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <Input type="number" placeholder="Total Harga (Rp)" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} className="h-10 rounded-xl font-bold text-primary bg-primary/5 border-primary/20 text-xs" />
            </div>
            <div className="col-span-2 mt-1">
              <Button onClick={handleAddToCart} variant="outline" className="w-full h-10 rounded-xl text-xs font-bold border-slate-200 shadow-sm flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-50">
                <Plus size={14} /> Masukkan ke Keranjang
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Metode Pembayaran</label>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(configs?.paymentMethods || ["cash", "transfer", "qris"]).map(m => (
              <button
                key={m} type="button" onClick={() => setPaymentMethod(m)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${paymentMethod === m ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 shadow-sm'}`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Catatan Opsional</label>
          <Input type="text" placeholder="Catatan pembelian..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10 rounded-xl text-xs" />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex gap-3">
        <Button onClick={onCancel} variant="ghost" className="h-12 px-6 rounded-2xl font-bold text-slate-500 hover:bg-slate-100">Batal</Button>
        <Button onClick={handleSubmit} disabled={saving || cartItems.length === 0} className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <>Simpan {cartItems.length} Barang Nota</>}
        </Button>
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function PurchasesPage() {
  const { getToken } = useAuth();
  const { alert } = useAlertConfirm();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // UX State
  const [isDesktopDialog, setIsDesktopDialog] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Data
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [configs, setConfigs] = useState<{ paymentMethods: string[], deliveryMethods: string[], shippingBorneBy: string[] } | null>(null);
  const [prevMonthTotal, setPrevMonthTotal] = useState(0);

  // Filters
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [purRes, supRes, ingRes, confRes] = await Promise.all([
        fetchWithAuth(`/api/purchases?startDate=${startDate}&endDate=${endDate}`),
        fetchWithAuth("/api/suppliers"),
        fetchWithAuth("/api/ingredients"),
        fetchWithAuth("/api/configs/system")
      ]);
      
      if (purRes.ok) setPurchases(await purRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (ingRes.ok) setIngredients(await ingRes.json());
      if (confRes.ok) {
        const cData = await confRes.json();
        setConfigs(cData);
      }

      // Prev Month Trend
      const date = new Date(startDate);
      date.setMonth(date.getMonth() - 1);
      const prevStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0];
      const prevEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0];
      const resPrev = await fetchWithAuth(`/api/purchases?startDate=${prevStart}&endDate=${prevEnd}`);
      if (resPrev.ok) {
        const prevData: Purchase[] = await resPrev.json();
        const prevTot = prevData.reduce((acc, curr) => acc + curr.totalPrice, 0);
        setPrevMonthTotal(prevTot);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [fetchWithAuth, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = purchases.filter(p => {
    if (searchQuery && !p.itemName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterMethod !== "all" && p.paymentMethod !== filterMethod) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    return true;
  });

  const totalPurchase = filtered.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const trendPercent = prevMonthTotal > 0 ? ((totalPurchase - prevMonthTotal) / prevMonthTotal) * 100 : 0;
  const isTrendUp = trendPercent > 0;

  if (loading && purchases.length === 0) {
    return <div className="flex h-screen items-center justify-center bg-brand-50"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }

  const renderForm = () => (
    <RestockForm 
      onSuccess={() => { setShowForm(false); loadData(); alert("Berhasil", "Stok ditambahkan", "success"); }} 
      onCancel={() => setShowForm(false)} 
      fetchWithAuth={fetchWithAuth} 
      suppliers={suppliers} 
      ingredients={ingredients} 
      configs={configs}
    />
  );

  return (
    <div className="min-h-screen bg-brand-50 pb-20">
      <div className="bg-white px-5 pt-12 pb-6 rounded-b-[2rem] shadow-sm relative z-10 border-b-4 border-primary/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Pembelian & Restock</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Catat belanja bahan baku dan tambah stok otomatis.</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Package className="text-primary" size={24} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Belanja HPP</p>
            <p className="text-xl font-extrabold text-primary truncate">{fmt(totalPurchase)}</p>
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
          <Button onClick={() => setShowForm(true)} className="flex-1 h-11 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold shadow-sm transition-all flex items-center justify-center gap-2">
            <Plus size={16} /> Belanja Baru
          </Button>
        </div>
      </div>

      <div className="px-4 -mt-2 relative z-20">
        <div className="max-w-5xl mx-auto space-y-4">
          
          {/* Filters */}
          <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input type="text" placeholder="Cari nama barang..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 h-10 bg-white border-slate-200 rounded-xl text-sm" />
            </div>
            <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 shrink-0 no-scrollbar">
              <div className="flex items-center gap-1.5 px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600">
                <Filter size={14} className="text-slate-400" />
                <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="bg-transparent focus:outline-none">
                  <option value="all">Semua Bayar</option>
                  <option value="cash">Tunai</option>
                  <option value="transfer">Transfer</option>
                  <option value="qris">QRIS</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600">
                <Filter size={14} className="text-slate-400" />
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-transparent focus:outline-none">
                  <option value="all">Semua Kategori</option>
                  <option value="bahan_baku">Bahan Baku</option>
                  <option value="packaging">Packaging</option>
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
                    <th className="px-4 py-3 min-w-[200px]">Nama Barang</th>
                    <th className="px-4 py-3 whitespace-nowrap">Kategori</th>
                    <th className="px-4 py-3 whitespace-nowrap text-right">Kuantitas</th>
                    <th className="px-4 py-3 whitespace-nowrap text-right">Total Harga</th>
                    <th className="px-4 py-3 whitespace-nowrap">Metode</th>
                    <th className="px-4 py-3 whitespace-nowrap">Toko/Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 font-semibold text-slate-400">Tidak ada riwayat belanja</td></tr>
                  ) : (
                    filtered.map(pur => (
                      <tr key={pur.id} className="hover:bg-brand-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(pur.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{pur.itemName}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold ${pur.category === 'bahan_baku' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            <Package size={12} /> {pur.category === 'bahan_baku' ? 'Bahan Baku' : 'Packaging'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{pur.qtyPurchased} {pur.purchaseUnit}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-700 whitespace-nowrap">{fmt(pur.totalPrice)}</td>
                        <td className="px-4 py-3 whitespace-nowrap capitalize">{pur.paymentMethod}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{pur.supplier || "-"}</td>
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
                <Package className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-sm font-semibold text-slate-600">Tidak ada riwayat belanja</p>
                <p className="text-xs text-slate-400">Pilih rentang tanggal lain atau catat belanja baru.</p>
              </div>
            ) : (
              filtered.map((pur) => (
                <Card key={pur.id} className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${pur.category === "bahan_baku" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                        <Package size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{pur.itemName}</h3>
                        <p className="text-xs font-semibold text-slate-600 mt-0.5">{pur.qtyPurchased} {pur.purchaseUnit}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-400">
                          <span className="flex items-center gap-1"><Calendar size={10}/> {new Date(pur.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-extrabold text-primary shrink-0 ml-2">{fmt(pur.totalPrice)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-white text-slate-500 shadow-sm font-bold uppercase tracking-wider">{pur.paymentMethod}</span>
                      {pur.supplier && <span className="flex items-center gap-1 text-xs text-slate-400 line-clamp-1 break-all max-w-[120px]"><User size={10}/> {pur.supplier}</span>}
                    </div>
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
                <span className="text-2xl">📦</span> Catat Belanja
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {renderForm()}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <BottomSheet isOpen={showForm} onClose={() => setShowForm(false)} title="Catat Belanja" icon="📦">
          {renderForm()}
        </BottomSheet>
      )}
    </div>
  );
}
