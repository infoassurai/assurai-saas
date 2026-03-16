// Pricing Plans
export const PRICING_PLANS = {
  STARTER: {
    name: 'Starter',
    price: 29,
    includedPolicies: 100,
    stripePriceId: 'price_starter_xxx',
  },
  PRO: {
    name: 'Pro',
    price: 89,
    includedPolicies: 1000,
    stripePriceId: 'price_pro_xxx',
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 249,
    includedPolicies: 'unlimited',
    stripePriceId: 'price_enterprise_xxx',
  },
};

// Policy Types
export const POLICY_TYPES = [
  'auto',
  'home',
  'life',
  'health',
  'other',
  'previdenza',
  'infortuni',
  'rc',
];

// Payment Methods
export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'contanti', label: 'Contanti' },
  { value: 'carta', label: 'Carta' },
  { value: 'rid', label: 'RID / Domiciliazione' },
  { value: 'finanziamento', label: 'Finanziamento' },
];

// API Routes
export const API_ROUTES = {
  HEALTH: '/health',
  AUTH: '/auth',
  POLICIES: '/policies',
  UPLOAD: '/upload',
  ALERTS: '/alerts',
};
