// ============================================
// Tenant (multi-tenancy)
// ============================================
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'pro' | 'enterprise';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Profile (estende auth.users)
// ============================================
export interface Profile {
  id: string;
  tenantId: string;
  fullName: string;
  role: 'admin' | 'agent' | 'subagent' | 'viewer';
  phone?: string;
  avatarUrl?: string;
  parentAgentId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Alias per retrocompatibilità
export type User = Profile & { email: string };

// ============================================
// Insurance Company
// ============================================
export interface InsuranceCompany {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Policy (polizza)
// ============================================
export type PolicyType = 'auto' | 'home' | 'life' | 'health' | 'other' | 'previdenza' | 'infortuni' | 'rc';
export type PolicyStatus = 'active' | 'expired' | 'pending' | 'cancelled';
export type PolicySource = 'manual' | 'ocr' | 'api';
export type PaymentMethod = 'contanti' | 'carta' | 'rid' | 'finanziamento';

export interface Policy {
  id: string;
  tenantId: string;
  companyId?: string;
  agentId?: string;

  policyNumber: string;
  policyType: PolicyType;

  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientFiscalCode?: string;

  premiumAmount: number;
  paymentMethod?: PaymentMethod;
  manualCommissionAmount?: number;

  effectiveDate: Date;
  expiryDate: Date;

  status: PolicyStatus;
  notes?: string;

  source: PolicySource;
  ocrConfidence?: number;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Commission
// ============================================
export type CommissionType = 'initial' | 'renewal' | 'bonus';
export type CommissionStatus = 'pending' | 'paid' | 'cancelled';

export type CommissionRole = 'agent' | 'subagent' | 'override';

export interface Commission {
  id: string;
  tenantId: string;
  policyId: string;
  agentId?: string;

  amount: number;
  percentage?: number;
  type: CommissionType;
  status: CommissionStatus;
  commissionRole?: CommissionRole;
  parentCommissionId?: string;
  paidAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Sub-Agent Commission Plan
// ============================================
export interface SubAgentCommissionPlan {
  id: string;
  tenantId: string;
  subAgentId: string;
  companyId?: string;
  policyType?: PolicyType;
  percentage: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Alert
// ============================================
export type AlertType = 'expiry' | 'payment' | 'document' | 'custom';
export type AlertChannel = 'in_app' | 'email' | 'whatsapp';

export interface Alert {
  id: string;
  tenantId: string;
  policyId?: string;

  type: AlertType;
  title: string;
  message?: string;
  dueDate: Date;

  isRead: boolean;
  isDismissed: boolean;

  channel: AlertChannel;
  sentAt?: Date;

  createdAt: Date;
}

// ============================================
// Document
// ============================================
export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Document {
  id: string;
  tenantId: string;
  policyId?: string;

  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType: string;

  ocrStatus: OcrStatus;
  ocrText?: string;

  uploadedBy?: string;
  createdAt: Date;
}

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
