export interface StripeProduct {
  id: string
  priceId: string
  overagePriceId: string
  name: string
  description: string
  mode: 'payment' | 'subscription'
  price: number
  userLimit: number
  overagePrice: number
  features: string[]
  isTiered: boolean
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_SrW9XwUp5X6QGF',
    priceId: 'price_1Rw6P3HjUCCcUwLCVnJ7TZwc',
    overagePriceId: 'price_1Rw6PoHjUCCcUwLC4LsouchQ',
    name: 'Starter Base',
    description: 'Essential features for small field service teams',
    mode: 'subscription',
    price: 99.00,
    userLimit: 3,
    overagePrice: 20.00,
    isTiered: true,
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
    id: 'prod_SrWATx0OLn95RO',
    priceId: 'price_1Rw6Q3HjUCCcUwLCzbcpyDgy',
    overagePriceId: 'price_1Rw6QRHjUCCcUwLC0tT59VC2',
    name: 'Pro Base',
    description: 'Advanced features for growing businesses',
    mode: 'subscription',
    price: 199.00,
    userLimit: 5,
    overagePrice: 20.00,
    isTiered: true,
    features: [
      'Up to 5 team members included',
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
    id: 'prod_SrWBY6TZNUnu4w',
    priceId: 'price_1Rw6QhHjUCCcUwLCqp6bnj67',
    overagePriceId: 'price_1Rw6RBHjUCCcUwLC3bSJzXQD',
    name: 'Business Base',
    description: 'Complete solution for enterprise field service operations',
    mode: 'subscription',
    price: 399.00,
    userLimit: 10,
    overagePrice: 20.00,
    isTiered: true,
    features: [
      'Up to 10 team members included',
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