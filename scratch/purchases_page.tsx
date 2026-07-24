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
        items: cartItems,
        paymentMethod,
        supplier: finalSupplierName || null,
        notes: notes.trim() || null,
        customDate: customDate || null,
      };

      const res = await fetchWithAuth("/api/purchases", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const resData = await res.json();
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
          <div className="space-y-2">
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
