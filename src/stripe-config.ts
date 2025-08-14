export interface StripeProduct {
  id: string
  priceId: string
  name: string
  description: string
  mode: 'payment' | 'subscription'
  price: number
  userLimit: number
  overagePriceId: string
  features: string[]
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_SrW9XwUp5X6QGF',
    priceId: 'price_1Rvn7PH2k7OW1G0R8kUIQs5K',
    name: 'Starter Base',
    description: 'Essential features for small field service teams',
    mode: 'subscription',
    price: 99.00,
    userLimit: 3,
    overagePriceId: 'price_1RvoD1H2k7OW1G0R5F0FMbpr',
    features: [
      'Up to 3 team members included',
      '$20/month per additional user',
      'Work order management',
      'Customer database',
      'Basic invoicing',
      'Time tracking',
      'Mobile app access',
      'Email support'
    ]
  },
  {
    id: 'prod_YOUR_ACTUAL_PRO_PRODUCT_ID',
    priceId: 'price_YOUR_ACTUAL_PRO_PRICE_ID',
    name: 'Pro Base',
    description: 'Advanced features for growing businesses',
    mode: 'subscription',
    price: 199.00,
    userLimit: 3,
    overagePrice: 20.00,
    features: [
      'Up to 3 team members included',
      '$20/month per additional user',
      'Everything in Starter',
      'Project management',
      'Inventory tracking',
      'Estimates & quotes',
      'Purchase orders',
      'Advanced reporting',
      'CRM features',
      'Priority support'
    ]
  },
  {
    id: 'prod_YOUR_ACTUAL_BUSINESS_PRODUCT_ID',
    priceId: 'price_YOUR_ACTUAL_BUSINESS_PRICE_ID',
    name: 'Business Base',
    description: 'Complete solution for enterprise field service operations',
    mode: 'subscription',
    price: 399.00,
    userLimit: 3,
    overagePrice: 20.00,
    features: [
      'Up to 3 team members included',
      '$20/month per additional user',
      'Everything in Pro',
      'Multi-location support',
      'Maintenance scheduling',
      'API access',
      'Custom fields',
      'Advanced integrations',
      'QuickBooks sync',
      'Dedicated support'
    ]
  }
]

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.priceId === priceId)
}

export const getProductById = (id: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.id === id)
}