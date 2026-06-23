"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import { Loader2, Package, Layers, Beaker, BookOpen, Users } from "lucide-react";
import type { Product, PriceTier, Variant, Ingredient, Recipe, Customer } from "@/types";

type Tab = "produk" | "varian" | "bahan" | "resep" | "pelanggan";

interface ProductWithTiers extends Product {
  priceTiers: PriceTier[];
}

export default function MasterDataPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("produk");
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<ProductWithTiers[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  async function fetchWithAuth(url: string) {
    const token = await getToken();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        if (tab === "produk" && products.length === 0) {
          const data = await fetchWithAuth("/api/products");
          if (!cancelled) setProducts(data);
        } else if (tab === "varian" && variants.length === 0) {
          const data = await fetchWithAuth("/api/variants");
          if (!cancelled) setVariants(data);
        } else if (tab === "bahan" && ingredients.length === 0) {
          const data = await fetchWithAuth("/api/ingredients");
          if (!cancelled) setIngredients(data);
        } else if (tab === "resep" && recipes.length === 0) {
          const data = await fetchWithAuth("/api/recipes");
          if (!cancelled) setRecipes(data);
        } else if (tab === "pelanggan" && customers.length === 0) {
          const data = await fetchWithAuth("/api/customers");
          if (!cancelled) setCustomers(data);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [tab]);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "produk", label: "Produk", icon: Package },
    { key: "varian", label: "Varian", icon: Layers },
    { key: "bahan", label: "Bahan", icon: Beaker },
    { key: "resep", label: "Resep", icon: BookOpen },
    { key: "pelanggan", label: "Pelanggan", icon: Users },
  ];

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-4">Master Data</h1>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-5 px-5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {tab === "produk" && (
            products.length === 0 ? (
              <Empty label="Belum ada produk" />
            ) : (
              products.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="font-mono text-xs">{p.code}</Badge>
                    <span className="font-semibold text-stone-900">{p.name}</span>
                  </div>
                  <p className="text-xs text-stone-500 mb-2">{p.description} · {p.packPerBatch} pack/batch</p>
                  {p.priceTiers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {p.priceTiers.map((t) => (
                        <span key={t.id} className="text-xs bg-stone-50 border border-stone-200 rounded px-2 py-0.5">
                          {t.minQty}–{t.maxQty ?? "∞"} pack: {formatRupiah(t.price)}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              ))
            )
          )}

          {tab === "varian" && (
            variants.length === 0 ? (
              <Empty label="Belum ada varian" />
            ) : (
              variants.map((v) => (
                <Card key={v.id} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-stone-900">{v.name}</span>
                    <span className="text-xs text-stone-500 ml-2">#{v.sortOrder}</span>
                  </div>
                  <Badge variant={v.isProductionVariant ? "default" : "outline"}>
                    {v.isProductionVariant ? "Produksi" : "Assembly"}
                  </Badge>
                </Card>
              ))
            )
          )}

          {tab === "bahan" && (
            ingredients.length === 0 ? (
              <Empty label="Belum ada bahan" />
            ) : (
              ingredients.map((ing) => (
                <Card key={ing.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-stone-900">{ing.name}</span>
                    <Badge variant="outline" className="text-xs">{ing.category}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`font-mono ${ing.currentStock < ing.minStock ? "text-red-600 font-bold" : "text-stone-700"}`}>
                      {ing.currentStock.toLocaleString("id-ID")} {ing.baseUnit}
                    </span>
                    <span className="text-stone-400">min: {ing.minStock.toLocaleString("id-ID")}</span>
                  </div>
                  {ing.unitAlternatives.length > 0 && (
                    <p className="text-xs text-stone-400 mt-1">
                      Konversi: {ing.unitAlternatives.map((u) => `1 ${u.unit} = ${u.conversionToBase} ${ing.baseUnit}`).join(", ")}
                    </p>
                  )}
                </Card>
              ))
            )
          )}

          {tab === "resep" && (
            recipes.length === 0 ? (
              <Empty label="Belum ada resep" />
            ) : (
              recipes.map((r) => (
                <Card key={r.id} className="p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-stone-500">Produk:</span>{" "}
                    <span className="font-medium text-stone-900">{r.productId}</span>
                    <span className="text-stone-400 mx-1">·</span>
                    <span className="text-stone-500">Varian:</span>{" "}
                    <span className="font-medium">{r.variantId}</span>
                  </div>
                  <span className="font-mono text-sm text-stone-700">
                    {r.qtyPerBatch} {r.unit}/batch
                  </span>
                </Card>
              ))
            )
          )}

          {tab === "pelanggan" && (
            customers.length === 0 ? (
              <Empty label="Belum ada pelanggan" />
            ) : (
              customers.map((c) => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-stone-900">{c.name}</span>
                    <Badge variant="outline" className="text-xs">{c.channel}</Badge>
                  </div>
                  {c.phoneNumber && (
                    <p className="text-xs text-stone-500">{c.phoneNumber}</p>
                  )}
                  {c.discountPerUnit > 0 && (
                    <p className="text-xs text-emerald-600">Diskon: {formatRupiah(c.discountPerUnit)}/unit</p>
                  )}
                </Card>
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400">
      {label}
    </div>
  );
}
