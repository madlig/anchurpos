// AnchurPOS — Domain Types
// Maps to Firestore collections defined in Firestore_Data_Model.md
// Timestamps stored as Firestore Timestamps in DB, serialized to ISO strings in API responses.

export type Role = "owner" | "manager" | "crew";

// --- 1. users/{uid} ---
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

// --- 2. products/{productId} ---
export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  packPerBatch: number;
  isActive: boolean;
  channels?: OrderChannel[];
  freeSauceAllowance?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceTier {
  id: string;
  minQty: number;
  maxQty: number | null;
  price: number;
}

// --- 3. variants/{variantId} ---
export interface Variant {
  id: string;
  productId: string;
  name: string;
  minStock: number;
  sortOrder: number;
  freeSauceAllowance?: number;
  isProductionVariant?: boolean;
  currentStock?: number;
}

export interface ProductStock {
  id: string; // e.g. "churros-frozen-regular_original"
  productId: string;
  variantId: string;
  currentStock: number;
  minStock: number;
}

// --- 4. ingredients/{ingredientId} ---
export type IngredientCategory = "bahan_baku" | "packaging" | "operasional" | "add_on";
export type OpnameMethod = "direct" | "packaged";

export interface UnitAlternative {
  unit: string;
  conversionToBase: number;
}

export interface FullnessOption {
  label: string;
  ratio: number;
}

export interface PackagedConfig {
  unitPerPackage: number;
  packageLabel: string;
  fullnessOptions: FullnessOption[];
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  baseUnit: string;
  currentStock: number;
  minStock: number;
  unitAlternatives: UnitAlternative[];
  opnameMethod: OpnameMethod;
  packagedConfig: PackagedConfig | null;
  channels?: OrderChannel[];
  defaultCostPerBaseUnit: number;
  lastHppUpdateDate?: string;
  netWeightGrams?: number;
  price?: number;
}

// --- 4b. stockMovements/{movementId} ---
export type StockMovementSource =
  | "expense"
  | "production"
  | "manual_edit"
  | "stock_opname_adjustment";

export interface StockMovement {
  id: string;
  ingredientId: string;
  changeAmount: number;
  newStockAfter: number;
  sourceType: StockMovementSource;
  sourceId: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

// --- 5. recipes/{recipeId} ---
export interface Recipe {
  id: string;
  productId: string;
  variantId: string;
  ingredientId: string;
  qtyPerBatch: number;
  unit: string;
}

// --- 6. customers/{customerId} ---
export type CustomerChannel =
  | "b2b"
  | "shopee"
  | "whatsapp"
  | "reseller"
  | "tiktok"
  | "walk_in";

export interface Customer {
  id: string;
  name: string;
  code: string | null;
  channel: CustomerChannel;
  customerType: "reguler" | "b2b" | "reseller" | "grosir" | "mitra";
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  discountPerUnit: number;
  creditLimit: number | null;
  poNumber: string | null;
  notes: string;
  isActive: boolean;
  createdVia: "manual" | "wa_form";
}

// --- 6b. suppliers/{supplierId} ---
export interface Supplier {
  id: string;
  name: string;
  code?: string;
  category?: string;
  contactPerson?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- 7. expenses/{expenseId} ---
export type PaymentMethod = "cash" | "transfer" | "qris";
export type ExpenseCategory =
  | "bahan_baku"
  | "packaging"
  | "operasional"
  | "lain_lain";

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  ingredientId: string | null;
  itemName: string;
  qtyPurchased: number;
  purchaseUnit: string;
  qtyInBaseUnit: number;
  totalPrice: number;
  pricePerBaseUnit: number;
  paymentMethod: PaymentMethod;
  supplier: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

// --- 8. productions/{productionId} ---
export interface Production {
  id: string;
  date: string;
  type?: "standard" | "tiktok";
  variantId: string;
  batches: number;
  loyangCount: number;
  pcsCount: number;
  loyangRemaining: number;
  notes: string;
  shiftCrewId: string;
  createdAt: string;
}

// --- 8b. prePacking/{prePackingId} ---
export interface SourceProduction {
  productionId: string;
  productionDate: string;
  loyangUsed: number;
}

export interface PrePacking {
  id: string;
  date: string;
  variantId: string;
  sourceProductions: SourceProduction[];
  totalLoyangUsed: number;
  resultRegularPacks: number;
  resultFullPacks: number;
  usedBufferPcs?: number;
  leftoverPcs?: number;
  crewId: string;
  createdAt: string;
}

// --- 8c. openPacks/{openPackId} ---
export interface OpenPack {
  id: string;
  productId: string;
  variantId: string;
  originalPackSize: number;
  remainingPcs: number;
  sourceOrderId: string;
  status: "open" | "resolved";
  resolvedAction: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// --- 9. stockOpname/{opnameId} ---
export interface StockOpnameItem {
  ingredientId: string;
  inputMethod: OpnameMethod;
  physicalStock: number | null;
  fullPackages: number | null;
  openPackageFullness: string | null;
  physicalStockConverted: number | null;
  systemStock: number;
  difference: number;
}

export interface StockOpname {
  id: string;
  date: string;
  shiftType: "pagi" | "siang" | "malam";
  crewId: string;
  items: StockOpnameItem[];
  totalIngredientsChecked: number;
  totalIngredientsAll: number;
  hasDiscrepancy: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewAction: "acknowledge" | "adjusted" | null;
  createdAt: string;
}

// --- 9b. attendance/{attendanceId} ---
export interface CheckInData {
  time: string;
  ipAddress: string;
  ipValid: boolean;
  photoUrl?: string;
  locationValid?: boolean;
}

export interface CheckOutData {
  time: string | null;
  ipAddress: string | null;
  ipValid: boolean | null;
  photoUrl?: string;
  locationValid?: boolean;
}

export type AttendanceStatus = "belum_lengkap" | "lengkap" | "direview";

export interface Attendance {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  checkIn: CheckInData;
  checkOut: CheckOutData | null;
  totalHours: number | null;
  regularHours: number | null;
  overtimeHours: number | null;
  overtimeBlocks: number | null;
  overtimeBonus: number | null;
  status: AttendanceStatus;
  flaggedReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// --- 9c. settings/attendanceConfig ---
export interface AttendanceConfig {
  whitelistedIps: string[];
  lastDetectedIp: string | null;
  lastDetectedAt: string | null;
  updatedBy: string;
  updatedAt: string;
}

// --- 9e. settings/businessInfo ---
export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface BusinessInfo {
  businessName: string;
  logoUrl: string;
  bankAccounts: BankAccount[];
  invoiceFooterNote: string;
  updatedBy: string;
  updatedAt: string;
}

// --- 9d. alerts/{alertId} ---
export type AlertType =
  | "stock_warning_production"
  | "stock_opname_discrepancy"
  | "attendance_review";

export interface Alert {
  id: string;
  type: AlertType;
  severity: "warning" | "info";
  title: string;
  message: string;
  sourceCollection: string;
  sourceId: string;
  isRead: boolean;
  readBy: string | null;
  readAt: string | null;
  createdAt: string;
}

// --- 10. orders/{orderId} ---
export type OrderSource = "marketplace_manual" | "wa_form" | "walk_in";
export type OrderChannel = "walkin" | "whatsapp" | "tiktok" | "shopee";
export type OrderStatus = "pending" | "proses" | "selesai" | "void";
export type PaymentStatus = "belum_bayar" | "sudah_bayar";

export interface Order {
  id: string;
  orderNumber: string;
  source: OrderSource;
  orderChannel: OrderChannel;
  customerId: string | null;
  customerName: string;
  customerType: "reguler" | "b2b" | "reseller" | null;
  customerPhone: string | null;
  channel: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  platformFeePercent: number;
  platformFee: number;
  netRevenue: number | null;
  needsProduction: boolean;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
  shippingAddress: string | null;
  requestedDeliveryDate: string | null;
  orderNotes: string | null;
  proofOfTransferUrl: string | null;
  shippingCost: number | null;
  shippingCostConfirmed: boolean;
  invoiceNumber: string | null;
  invoiceGeneratedAt: string | null;
  invoiceUrl: string | null;
  items?: any[];
}

// --- 10. orders/{orderId}/items/{itemId} ---
export type AssemblyStatus = "pending_approval" | "completed";

export interface RainbowSourceBreakdown {
  variantId: string;
  source: "pack_jadi" | "pool_loyang" | "shortage";
  amountTaken: number;
  needsProduction: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  qty: number;
  basePrice: number;
  appliedTier: string;
  discountPerUnit: number;
  totalPrice: number;
  hppPerUnit: number;
  totalHpp: number;
  margin: number;
  assemblyStatus: AssemblyStatus | null;
  rainbowSourceBreakdown: RainbowSourceBreakdown[] | null;
}

// --- 10c. stockAdjustments/{adjustmentId} ---
export type AdjustmentReason =
  | "sample_affiliate"
  | "hadiah_bonus"
  | "rusak_reject"
  | "konsumsi_internal"
  | "lainnya";

export interface StockAdjustment {
  id: string;
  date: string;
  productId: string;
  variantId: string;
  qty: number;
  reasonCategory: AdjustmentReason;
  reasonCustom: string | null;
  recipientName: string | null;
  hppPerUnit: number;
  totalCost: number;
  createdBy: string;
  createdAt: string;
}

// --- 11. payroll/{payrollId} ---
export type PayrollStatus = "belum_dibayar" | "sudah_dibayar";
export type PayrollDataStatus = "parsial" | "final";

export interface Payroll {
  id: string;
  month: string;
  employeeId: string;
  employeeName: string;
  workDays: number;
  dailyWage: number;
  totalRegularPay: number;
  totalOvertimeBonus: number;
  performanceBonus: number;
  totalPaid: number;
  pendingReview: number;
  dataStatus: PayrollDataStatus;
  status: PayrollStatus;
  paidAt: string | null;
  isLocked: boolean;
}

// --- 12. Master Data Configurations ---
export interface CustomerTier {
  id: string; // e.g. "reguler", "b2b", "reseller", "distributor"
  name: string;
  isB2B: boolean; // if true, requires PO number, etc.
  themeColor: { bg: string; color: string; border: string; };
  isActive: boolean;
}

export interface OrderChannelConfig {
  id: string; // e.g. "walkin", "tiktok", "gofood"
  name: string;
  defaultPlatformFeePercent: number;
  isActive: boolean;
}

export interface OperationalConfig {
  id: "global"; // Singleton document in "system_configs"
  paymentMethods: string[];
  expenseCategories: string[];
  deliveryMethods: string[];
}

// --- 13. Shop Floor Management (SFM) Types ---
export type WorkOrderStatus = "PLANNED" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type SFMWorkOrderType = "PRODUKSI" | "REPACK_SAOS" | "REPACK_GULA" | "PACKING_PESANAN" | "STOCK_OPNAME" | "GENERAL_TASK";
export type SFMTaskStep = "DOUGH_COOKING" | "MIXING_EGG" | "TRAY_MOLDING" | "FREEZER_CHECKPOINT" | "PRE_PACK" | "FINAL_PACK";
export type SFMLogStage = "DOUGH_MIXING" | "TRAY_PRINTING" | "FREEZER_CHECKPOINT" | "FINAL_PACKING";

export interface WorkOrderVariantState {
  doughBatchesDone: number;
  mixingBatchesDone: number;
  doughStationStartedAt?: string;
  mixingStationStartedAt?: string;
  loyangPrinted: number;    // hasil cetak ke loyang
  moldingDone?: boolean;    // status apakah cetak loyang sudah diselesaikan
  loyangCut: number;         // hasil potong → tahu Pcs
  frozenTrays: number;       // loyang di freezer belum di-prepack
  goodPacks: number;
  goodPcs: number;
  defectPcs: number;
}

export interface WorkOrderSummaryState {
  totalDoughBatchesDone: number;
  totalTrayPrinted: number;
  totalTrayInFreezer: number;
  totalGoodPacks: number;
  totalGoodPcs?: number;
  totalDefectPacks: number;
  totalDefectPcs: number;
}

export interface WorkOrder {
  id: string;
  woNumber: string;
  woType?: SFMWorkOrderType;
  productId: string;
  productName?: string;
  variantIds: string[];
  variantNames?: string;
  productionTargets?: { variantId: string; variantName: string; targetBatches: number; targetLoyang?: number }[];
  opnameScope?: "Bahan Baku" | "Kemasan" | "Produk Jadi" | "Spesifik" | "Semua";
  opnameItems?: string[];
  sourceOrderId?: string;
  sourceOrderNumber?: string;
  sourceOrderDetails?: Order;
  repackIngredientId?: string;
  targetBatches?: number;
  targetLoyang?: number;
  targetPacks?: number;
  targetPcs?: number;
  targetQty?: number;
  targetUom?: string;
  status: WorkOrderStatus;
  currentStage: string;
  summaryState: WorkOrderSummaryState;
  createdAt: string;
  startedAt?: string;
  freezerInAt?: string;
  currentStepStartedAt?: string;
  completedAt?: string;
  assignedCrewId: string;
  assignedCrewName?: string;
  notes?: string;
  batchCode?: string;
  expiredDate?: string;
  stepDurationsMinutes?: Record<string, number>;
  pausedAt?: string;
  pausedReason?: string;
  totalPauseMs?: number;
  pauseCount?: number;
  variantState?: Record<string, WorkOrderVariantState>;
  assignedCrewIds?: string[];
}

export interface WorkOrderLog {
  id: string;
  workOrderId: string;
  stage?: SFMLogStage;
  step?: SFMTaskStep;
  action?: "GOOD_OUTPUT" | "SCRAP" | "SUB_BATCH" | "STEP_TRANSITION" | "PAUSE" | "RESUME" | "MIXING_SUB_BATCH" | "TRAY_MOLDING" | "FINISH_MOLDING" | "PARTIAL_PREPACK" | "CUT_TRAY" | "CLOSE_WO";
  valueAdded: number;
  unit: "BATCH" | "LOYANG" | "PACK" | "PCS";
  defectCount?: number;
  defectReason?: string;
  loggedByCrewId: string;
  loggedByCrewName?: string;
  timestamp: string;
  durationMinutes?: number;
  notes?: string;
}

export interface CrewKpiLog {
  id: string;
  workOrderId: string;
  crewId: string;
  crewName: string;
  date: string;
  durationMinutes: number;
  standardDurationMinutes: number;
  speedScore: number;
  totalTargetPacks: number;
  goodPacks: number;
  defectPacks: number;
  yieldRatePercentage: number;
  accuracyScore: number;
  neatnessChecklist: {
    workstationClean: boolean;
    trayArrangementNeat: boolean;
    freezerOrganization: boolean;
    vacuumSealTight: boolean;
  };
  neatnessScore: number;
  finalKpiScore: number;
  createdAt: string;
}
