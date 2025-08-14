import React from 'react'
import { supabase } from './supabase'

interface SubscriptionFeatures {
  work_orders?: boolean
  customers?: boolean
  invoicing?: boolean
  time_tracking?: boolean
  basic_reports?: boolean
  mobile_app?: boolean
  projects?: boolean
  inventory?: boolean
  estimates?: boolean
  purchase_orders?: boolean
  advanced_reports?: boolean
  maintenance?: boolean
  crm?: boolean
  leads?: boolean
  opportunities?: boolean
  multi_location?: boolean
  api_access?: boolean
  custom_fields?: boolean
  advanced_integrations?: boolean
}

let cachedFeatures: SubscriptionFeatures | null = null
let cacheExpiry: number = 0

export const getSubscriptionFeatures = async (): Promise<SubscriptionFeatures> => {
  // Return cached features if still valid (cache for 5 minutes)
  if (cachedFeatures && Date.now() < cacheExpiry) {
    return cachedFeatures
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {} // No features if not authenticated
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return {}
    }

    // Get active subscription
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('company_id', profile.company_id)
      .eq('status', 'active')
      .maybeSingle()

    if (!subscription?.plan) {
      // Default to starter features if no subscription
      return {
        work_orders: true,
        customers: true,
        invoicing: true,
        time_tracking: true,
        basic_reports: true,
        mobile_app: true
      }
    }

    const features = subscription.plan.features as SubscriptionFeatures || {}
    
    // Cache the features
    cachedFeatures = features
    cacheExpiry = Date.now() + (5 * 60 * 1000) // 5 minutes

    return features
  } catch (error) {
    console.error('Error getting subscription features:', error)
    // Return basic features on error
    return {
      work_orders: true,
      customers: true,
      invoicing: true,
      time_tracking: true,
      basic_reports: true
    }
  }
}

export const hasFeature = async (feature: keyof SubscriptionFeatures): Promise<boolean> => {
  const features = await getSubscriptionFeatures()
  return features[feature] === true
}

export const clearFeatureCache = () => {
  cachedFeatures = null
  cacheExpiry = 0
}

// Hook for React components
export const useSubscriptionFeatures = () => {
  const [features, setFeatures] = React.useState<SubscriptionFeatures>({})
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadFeatures = async () => {
      try {
        const subscriptionFeatures = await getSubscriptionFeatures()
        setFeatures(subscriptionFeatures)
      } catch (error) {
        console.error('Error loading subscription features:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFeatures()
  }, [])

  return { features, loading, hasFeature: (feature: keyof SubscriptionFeatures) => features[feature] === true }
}