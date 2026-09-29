export type Role = "owner" | "manager" | "crew";

export interface Employee {
  id: string;
  name: string;
  username: string;
  role: Role;
  phone: string | null;
  joinDate: string | null;
  isActive: boolean;
  dailyWage?: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: { time: string; ipAddress?: string; ipValid?: boolean; photoUrl?: string; locationValid?: boolean; distance?: number | null; latitude?: number | null; longitude?: number | null } | null;
  checkOut: { time: string | null; ipAddress?: string; ipValid?: boolean; photoUrl?: string; locationValid?: boolean; distance?: number | null; latitude?: number | null; longitude?: number | null } | null;
  totalHours: number | null;
  status: string;
  overtimeHours?: number | null;
  overtimeBonus?: number | null;
  flaggedReason?: string | null;
}

export interface PayrollRecord {
  id: string;
  month: string;
  employeeId: string;
  employeeName: string;
  workDays: number;
  dailyWage: number;
  totalRegularPay: number;
  totalOvertimeBonus: number;
  performanceBonus: number;
  performanceBonusNote?: string;
  deductions?: number;
  deductionNote?: string;
  totalPaid: number;
  isLocked: boolean;
  lockedAt?: string;
  workPeriod?: string;
  productionSummary?: {
    totalBatches: number;
    totalPcs: number;
    totalThinwalls: number;
    overtimeClaimsCount: number;
    avgSpeedScore: number;
    reportsCount: number;
  } | null;
}

export const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", crew: "Crew" };
export const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  owner: { bg: "#FEF3C7", color: "#D97706" },
  manager: { bg: "#EFF6FF", color: "#2563EB" },
  crew: { bg: "#F0FDF4", color: "#16A34A" },
};