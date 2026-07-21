import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLatestIngredientCosts, calculateProductHPP } from '@/lib/business-logic';
import { adminDb } from '@/lib/firebase-admin';

// Mock the adminDb
vi.mock('@/lib/firebase-admin', () => {
  const getMock = vi.fn();
  const limitMock = vi.fn(() => ({ get: getMock }));
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const whereMock = vi.fn(() => ({ orderBy: orderByMock, get: getMock, where: vi.fn(() => ({ get: getMock })) }));
  
  return {
    adminDb: {
      collection: vi.fn(() => ({
        where: whereMock,
      })),
    },
  };
});

describe('business-logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLatestIngredientCosts', () => {
    it('returns empty object if ingredientIds is empty', async () => {
      const result = await getLatestIngredientCosts([]);
      expect(result).toEqual({});
    });

    it('returns 0 cost if no expense history is found', async () => {
      const mockGet = vi.fn().mockResolvedValue({ empty: true, docs: [] });
      const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      
      (adminDb.collection as any).mockReturnValue({ where: mockWhere });

      const result = await getLatestIngredientCosts(['ing-1']);
      expect(result).toEqual({ 'ing-1': 0 });
    });

    it('returns the latest cost if expense history is found', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({ pricePerBaseUnit: 1500 }) }
        ]
      });
      const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      
      (adminDb.collection as any).mockReturnValue({ where: mockWhere });

      const result = await getLatestIngredientCosts(['ing-1']);
      expect(result).toEqual({ 'ing-1': 1500 });
    });
  });

  describe('calculateProductHPP', () => {
    it('calculates HPP correctly with provided ingredient costs', async () => {
      const mockRecipesGet = vi.fn().mockResolvedValue({
        docs: [
          { data: () => ({ ingredientId: 'ing-1', qtyPerBatch: 2 }) },
          { data: () => ({ ingredientId: 'ing-2', qtyPerBatch: 3 }) }
        ]
      });
      
      const mockWhere2 = vi.fn().mockReturnValue({ get: mockRecipesGet });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
      
      (adminDb.collection as any).mockReturnValue({ where: mockWhere1 });

      const costs = { 'ing-1': 1000, 'ing-2': 500 };
      const hpp = await calculateProductHPP('prod-1', 'var-1', 10, costs);

      // (2 * 1000) + (3 * 500) = 3500
      // 3500 / 10 = 350
      expect(hpp).toBe(350);
    });

    it('handles packPerBatch <= 0 by defaulting to 1', async () => {
      const mockRecipesGet = vi.fn().mockResolvedValue({
        docs: [
          { data: () => ({ ingredientId: 'ing-1', qtyPerBatch: 2 }) }
        ]
      });
      
      const mockWhere2 = vi.fn().mockReturnValue({ get: mockRecipesGet });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
      
      (adminDb.collection as any).mockReturnValue({ where: mockWhere1 });

      const costs = { 'ing-1': 1000 };
      const hpp = await calculateProductHPP('prod-1', 'var-1', 0, costs);

      // (2 * 1000) = 2000
      // 2000 / 1 = 2000
      expect(hpp).toBe(2000);
    });
  });
});
