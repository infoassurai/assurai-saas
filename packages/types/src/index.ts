// User Types
export interface User {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: 'admin' | 'agent' | 'viewer';
  isActive: boolean;
  createdAt: Date;
}

// Policy Types
export interface Policy {
  id: string;
  tenantId: string;
  companyId: string;
  policyNumber: string;
  policyType: 'auto' | 'home' | 'life' | 'health' | 'other';
  clientName: string;
  clientEmail: string;
  clientPhone: string;

  premiumAmount: number;
  agentCommission: number;
  commissionPercentage: number;

  effectiveDate: Date;
  expiryDate: Date;

  status: 'active' | 'expired' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
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
