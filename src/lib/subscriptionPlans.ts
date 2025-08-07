export type SubscriptionPlan = 'starter' | 'pro' | 'business'

export interface PlanFeatures {
  name: string
  price: string
  features: string[]
  allowedPages: string[]
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, PlanFeatures> = {
  starter: {
    name: 'Starter',
    price: '$29/month',
    features: [
      'Work Orders Management',
      'Vendor Management', 
      'Purchase Orders',
      'Inventory Tracking',
      'Maintenance Scheduling',
      'Basic Customer Management',
      'Team Management',
      'Time Cards'
    ],
    allowedPages: [
      'dashboard',
      'work-orders',
      'vendors', 
      'purchase-orders',
      'inventory',
      'maintenance',
      'customers',
      'technicians',
      'teams',
      'time-cards',
      'my-jobs',
      'settings'
    ]
  },
  pro: {
    name: 'Pro',
    price: '$79/month',
    features: [
      'Everything in Starter',
      'Estimates & Quotes',
      'Advanced Dispatch Board',
      'Project Management',
      'Advanced Scheduling',
      'Customer Sites Management'
    ],
    allowedPages: [
      'dashboard',
      'work-orders',
      'vendors',
      'purchase-orders', 
      'inventory',
      'maintenance',
      'customers',
      'technicians',
      'teams',
      'time-cards',
      'my-jobs',
      'estimates',
      'dispatch',
      'projects',
      'settings'
    ]
  },
  business: {
    name: 'Business',
    price: '$149/month',
    features: [
      'Everything in Pro',
      'Full CRM Suite',
      'Lead Management',
      'Opportunity Tracking',
      'Advanced Reports & Analytics',
      'Revenue Insights',
      'Performance Metrics'
    ],
    allowedPages: [
      'dashboard',
      'work-orders',
      'vendors',
      'purchase-orders',
      'inventory', 
      'maintenance',
      'customers',
      'technicians',
      'teams',
      'time-cards',
      'my-jobs',
      'estimates',
      'dispatch',
      'projects',
      'crm',
      'leads',
      'opportunities',
      'invoices',
      'reports',
      'settings'
    ]
  }
}

export const hasFeatureAccess = (userPlan: SubscriptionPlan, requiredPage: string): boolean => {
  return SUBSCRIPTION_PLANS[userPlan].allowedPages.includes(requiredPage)
}

export const getUpgradeMessage = (currentPlan: SubscriptionPlan, requestedFeature: string): string => {
  if (currentPlan === 'starter') {
    return `Upgrade to Pro to access ${requestedFeature} and advanced project management features.`
  }
  if (currentPlan === 'pro') {
    return `Upgrade to Business to access ${requestedFeature} and full CRM capabilities.`
  }
  return ''
}