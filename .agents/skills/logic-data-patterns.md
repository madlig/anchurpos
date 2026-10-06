# Skill: Logic & Data Patterns — AnchorPOS

## Ikhtisar

Pola data, validasi, dan auth yang berlaku di proyek ini. Rujuk sebelum menulis kode yang menyentuh API route, Firestore, zod, atau auth.

---

## Auth: Selalu `fetchWithAuth`, Bukan Bare `fetch`

**Ini adalah bug kelas #1 di codebase ini.**

```typescript
// ✅ BENAR — setiap fetch ke /api/* dari client component
import { fetchWithAuth } from '@/lib/fetch-with-auth'; // atau path yang ada
const res = await fetchWithAuth('/api/orders', {
  method: 'POST',
  body: JSON.stringify(data)
});

// ❌ DILARANG — 401 error, request tanpa token
const res = await fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

Setiap kali menemukan bare `fetch('/api/...')` di client component → itu bug, sweep seluruh codebase.

---

## Validasi: Selalu dari `parseResult.data`

```typescript
// ✅ BENAR — di API route handler
export async function POST(req: Request) {
  const body = await req.json();
  const parseResult = createOrderSchema.safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Data tidak valid', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  
  const { productId, quantity, price } = parseResult.data; // ← DARI SINI
  // bukan dari body langsung
}

// ❌ SALAH — validasi bypass
const body = await req.json();
const { productId } = body; // tidak tervalidasi
```

---

## Zod Schema: Contract Lockstep

Saat mengubah `lib/validations.ts`:

```
Wajib update bersamaan:
1. lib/validations.ts          ← schema
2. app/api/**/route.ts         ← API handler yang pakai schema ini
3. types/index.ts              ← TypeScript type yang matching
4. UI form component           ← form yang mengirim data ini
```

Jika hanya update satu, TypeScript mungkin tidak catch error tapi runtime akan gagal.

---

## Firestore: Soft vs Hard Delete

```typescript
// Products, variants, customers → SOFT DELETE
await updateDoc(ref, { isActive: false, updatedAt: serverTimestamp() });

// Suppliers, ingredients → HARD DELETE
await deleteDoc(ref);
```

**Selalu cek entity type sebelum menulis kode delete.**

---

## Error Response Format

```typescript
// ✅ Format konsisten untuk semua API route
// Error
return NextResponse.json(
  { error: 'Pesan error Bahasa Indonesia yang actionable' },
  { status: 400 }
);

// Success
return NextResponse.json({ success: true, data: result });

// Auth error
return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
```

---

## Currency Format

```typescript
// ✅ Gunakan helper yang sudah ada: fmt() atau formatIDR()
// Cari di codebase dulu sebelum membuat helper baru

// Atau jika tidak ada helper:
const formatted = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0
}).format(amount);
```

---

## TypeScript: Patuhi Strictness

```bash
# Setelah setiap perubahan yang menyentuh types/api/zod:
npx tsc --noEmit
# Harus 0 error sebelum dianggap selesai
```

---

## Sweeping Bug Kelas (Lakukan Setiap Review/Fix)

Ketika menemukan satu instance, cari seluruh codebase untuk kelas yang sama:

1. `fetch('/api/`)` tanpa `Authorization` → sweep semua client components
2. `const { field } = body` di API route tanpa safeParse → sweep semua route handlers
3. `customerType` enum di string literal → cek semua yang pakai enum ini
4. `if (!field.trim()) return;` tanpa toast/error → sweep form handlers
5. PATCH yang di-spread `...body` → cek field mana yang bisa silently drop

---

## Checklist Logic Code

- [ ] Fetch dari client sudah pakai `fetchWithAuth`?
- [ ] API route baca field dari `parseResult.data` (bukan body)?
- [ ] Zod schema change sudah update API + types + UI bersamaan?
- [ ] Delete entity sudah pakai cara yang benar (soft/hard per tipe)?
- [ ] `tsc --noEmit` pass setelah perubahan?
- [ ] Format currency pakai helper yang sudah ada atau `Intl.NumberFormat`?
- [ ] Error response format konsisten `{ error: '...' }`?
