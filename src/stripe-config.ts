export interface StripeProduct {
  id: string
  priceId: string
  name: string
  description: string
  mode: 'payment' | 'subscription'
  price: number
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
    features: [
      'Up to 5 team members',
      'Work order management',
      'Customer database',
      'Basic invoicing',
      'Time tracking',
      'Mobile app access',
      'Email support'
    ]
  },
  {
    id: 'prod_SrWATx0OLn95RO',
    priceId: 'price_1Rvn8cH2k7OW1G0RQMbHxoUv',
    name: 'Pro Base',
    description: 'Advanced features for growing businesses',
    mode: 'subscription',
    price: 199.00,
    features: [
      'Up to 15 team members',
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
    id: 'prod_SrWBY6TZNUnu4w',
    priceId: 'price_1Rvn9AH2k7OW1G0RLrZawYUP',
    name: 'Business Base',
    description: 'Complete solution for enterprise field service operations',
    mode: 'subscription',
    price: 399.00,
    features: [
      'Unlimited team members',
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