import type { UnitAlternative } from "@/types";

export function getConversionToBase(
  purchaseUnit: string,
  baseUnit: string,
  unitAlternatives: UnitAlternative[]
): number | null {
  if (purchaseUnit === baseUnit) return 1;

  const alt = unitAlternatives.find((a) => a.unit === purchaseUnit);
  return alt?.conversionToBase ?? null;
}

export function convertToBaseUnit(
  qty: number,
  purchaseUnit: string,
  baseUnit: string,
  unitAlternatives: UnitAlternative[]
): { qtyInBaseUnit: number; conversionToBase: number } | null {
  const conversion = getConversionToBase(purchaseUnit, baseUnit, unitAlternatives);
  if (conversion === null) return null;

  return {
    qtyInBaseUnit: qty * conversion,
    conversionToBase: conversion,
  };
}
