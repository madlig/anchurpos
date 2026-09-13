import { describe, it, expect } from 'vitest';
import {
  orderSchema,
  orderItemSchema,
  customerSchema,
  supplierSchema,
  ingredientSchema,
  productSchema,
  variantSchema,
  stockOpnameSchema,
  stockOpnameReviewSchema
} from '@/lib/validations';

describe('Zod Validation Contracts (lib/validations.ts)', () => {
  describe('orderItemSchema', () => {
    it('validates a complete cart item', () => {
      const item = {
        productId: 'prod-1',
        productName: 'Churros Original',
        variantId: 'var-1',
        variantName: 'Original',
        qty: 2,
        basePrice: 25000,
        appliedTier: 't1',
        discountPerUnit: 0,
        totalPrice: 50000,
        sauceId: 'saus-coklat',
        sauceName: 'Saus Coklat'
      };
      const result = orderItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('fails when qty is negative or zero', () => {
      const item = {
        productId: 'prod-1',
        productName: 'Churros',
        qty: 0,
        basePrice: 25000,
        appliedTier: 't1',
        discountPerUnit: 0,
        totalPrice: 0
      };
      const result = orderItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });
  });

  describe('orderSchema', () => {
    it('validates a standard walk-in order', () => {
      const order = {
        orderChannel: 'walkin',
        customerName: 'Budi Santoso',
        items: [
          {
            productId: 'prod-1',
            productName: 'Churros',
            qty: 1,
            basePrice: 25000,
            appliedTier: 't1',
            discountPerUnit: 0,
            totalPrice: 25000
          }
        ],
        paymentStatus: 'sudah_bayar',
        paymentMethod: 'cash',
        cashReceived: 50000,
        changeAmount: 25000
      };
      const result = orderSchema.safeParse(order);
      expect(result.success).toBe(true);
    });

    it('fails when items array is empty', () => {
      const order = {
        orderChannel: 'walkin',
        customerName: 'Budi',
        items: []
      };
      const result = orderSchema.safeParse(order);
      expect(result.success).toBe(false);
    });
  });

  describe('customerSchema', () => {
    it('validates a valid customer', () => {
      const customer = {
        name: 'PT Mitra Sukses',
        customerType: 'b2b',
        phoneNumber: '08123456789',
        email: 'mitra@example.com',
        creditLimit: 10000000,
        createdVia: 'pos'
      };
      const result = customerSchema.safeParse(customer);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerType).toBe('b2b');
        expect(result.data.createdVia).toBe('pos');
      }
    });

    it('fails on empty name', () => {
      const result = customerSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('supplierSchema', () => {
    it('validates a supplier', () => {
      const supplier = {
        name: 'CV Tepung Prima',
        category: 'Bahan Baku',
        phoneNumber: '081298765432',
        paymentTerms: 'Tempo 30 Hari'
      };
      const result = supplierSchema.safeParse(supplier);
      expect(result.success).toBe(true);
    });

    it('fails on empty name', () => {
      const result = supplierSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('ingredientSchema', () => {
    it('validates an ingredient with selling price for add-ons', () => {
      const ingredient = {
        name: 'Saus Keju Kemasan',
        baseUnit: 'pcs',
        category: 'add_on',
        price: 3500,
        defaultCostPerBaseUnit: 1800,
        minStock: 20
      };
      const result = ingredientSchema.safeParse(ingredient);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(3500);
        expect(result.data.opnameMethod).toBe('direct');
      }
    });
  });

  describe('variantSchema', () => {
    it('validates a variant', () => {
      const variant = {
        productId: 'prod-churros',
        name: 'Matcha Green Tea',
        minStock: 15,
        freeSauceAllowance: 1
      };
      const result = variantSchema.safeParse(variant);
      expect(result.success).toBe(true);
    });
  });

  describe('stockOpnameSchema & stockOpnameReviewSchema', () => {
    it('validates stock opname submission', () => {
      const opname = {
        items: [
          {
            ingredientId: 'ing-tepung',
            itemType: 'ingredient',
            physicalStock: 25.5,
            unit: 'kg'
          },
          {
            ingredientId: 'churros-frozen-regular_original',
            itemType: 'variant',
            physicalStock: 10,
            unit: 'pack'
          }
        ]
      };
      const result = stockOpnameSchema.safeParse(opname);
      expect(result.success).toBe(true);
    });

    it('validates stock opname review adjustments', () => {
      const review = {
        reviewNote: 'Disetujui oleh manager',
        adjustments: [
          { ingredientId: 'ing-tepung', applyAdjustment: true },
          { ingredientId: 'churros-frozen-regular_original', applyAdjustment: false }
        ]
      };
      const result = stockOpnameReviewSchema.safeParse(review);
      expect(result.success).toBe(true);
    });
  });
});
