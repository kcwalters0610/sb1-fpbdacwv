import React, { useEffect, useState } from 'react'
import {
  CreditCard,
  Users,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Package,
  Crown,
  Zap,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { supabase, SubscriptionPlan, CompanySubscription, SubscriptionUsage } from '../lib/supabase'
import { stripeProducts, getProductByPriceId } from '../stripe-config'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function SubscriptionSettings() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<CompanySubscription | null>(null)
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null)
  const [stripeSubscription, setStripeSubscription] = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeUsers, setActiveUsers] = useState(0)

  // Load user + data on mount
  useEffect(() => {
    getCurrentUser()
    loadSubscriptionData() 
    loadStripeSubscription()
  }, [])

  // Refresh after Stripe redirect and clean the URL (works for success or cancel)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    if (!status) return
    // Refresh data when we return from Checkout/Portal
    loadSubscriptionData()
    params.delete('status')
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState({}, '', clean)
  }, [])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setCurrentUser({ ...user, profile })
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const loadStripeSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: stripeData } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle()

      setStripeSubscription(stripeData)
    } catch (error) {
      console.error('Error loading Stripe subscription:', error)
    }
  }

  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(true)
    setBusyPlanId(priceId)
    setCheckoutError('')
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_id: priceId,
          mode: 'subscription',
          quantity: 1,
          user_count: activeUsers, // Pass current user count for tiered pricing
          plan_user_limit: product.userLimit,
          overage_price_id: product.overagePriceId,
          success_url: `${window.location.origin}?status=success`,
          cancel_url: `${window.location.origin}?status=cancel`,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create checkout session')
      }

      if (result.url) {
        window.location.href = result.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setCheckoutError('Failed to start checkout. Please try again.')
    } finally {
      setCheckoutLoading(false)
      setBusyPlanId(null)
    }
  }

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single()
      if (!profile) return

      // Plans
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_price')
      setPlans(plansData || [])

      // Current subscription
      const { data: subscriptionData } = await supabase
        .from('company_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('company_id', profile.company_id)
        .eq('status', 'active')
        .maybeSingle()
      setCurrentSubscription(subscriptionData)

      // Usage window (current month)
      const today = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

      const { data: usageData } = await supabase
        .from('subscription_usage')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('billing_period_start', startOfMonth.toISOString().split('T')[0])
        .lte('billing_period_end', endOfMonth.toISOString().split('T')[0])
        .maybeSingle()
      setUsage(usageData)

      // Active user count
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
      setActiveUsers(count || 0)
    } catch (error) {
      console.error('Error loading subscription data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // Stripe helpers
  // ─────────────────────────────────────────────


  // Optional internal updater (kept for fallback/manual testing)
  const upgradePlanInternally = async (planId: string) => {
    if (!currentUser?.profile?.company_id) return
    setUpgrading(true)
    try {
      const { error } = await supabase.rpc('update_company_subscription_plan', {
        company_id_param: currentUser.profile.company_id,
        new_plan_id: planId
      })
      if (error) throw error
      alert('Subscription plan updated successfully!')
      loadSubscriptionData()
    } catch (error) {
      console.error('Error upgrading plan:', error)
      alert('Error updating subscription plan')
    } finally {
      setUpgrading(false)
    }
  }

  // Derivations
  const getCurrentStripeProduct = () => {
    if (!stripeSubscription?.price_id) return null
    return getProductByPriceId(stripeSubscription.price_id)
  }

  const getPlanIcon = (planName?: string) => {
    switch ((planName || '').toLowerCase()) {
      case 'starter': return <Package className="w-6 h-6" />
      case 'pro': return <Zap className="w-6 h-6" />
      case 'business': return <Crown className="w-6 h-6" />
      default: return <Package className="w-6 h-6" />
    }
  }

  const getPlanColor = (planName?: string) => {
    switch ((planName || '').toLowerCase()) {
      case 'starter': return 'from-blue-500 to-blue-600'
      case 'pro': return 'from-purple-500 to-purple-600'
      case 'business': return 'from-yellow-500 to-yellow-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const currentStripeProduct = getCurrentStripeProduct()

  // Calculate billing metrics
  const currentPlan = currentSubscription?.plan
  const basePrice = currentPlan?.monthly_price || 0
  const planLimit = currentStripeProduct?.userLimit || 0
  const perUserCost = currentStripeProduct?.overagePrice || 0
  const overageUsers = Math.max(0, activeUsers - planLimit)
  const overageCost = overageUsers * perUserCost
  const totalMonthlyCost = (currentStripeProduct?.price || 0) + overageCost

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      {stripeSubscription && currentStripeProduct && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Current Subscription</h3>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                stripeSubscription.subscription_status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : stripeSubscription.subscription_status === 'past_due'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {stripeSubscription.subscription_status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 bg-gradient-to-r ${getPlanColor(currentStripeProduct.name)} rounded-lg flex items-center justify-center text-white`}>
                {getPlanIcon(currentStripeProduct.name)}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{currentStripeProduct.name}</h4>
                <p className="text-sm text-gray-600">{currentStripeProduct.description}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Monthly Price:</span>
                <span className="text-sm font-medium">{usd.format(currentStripeProduct.price)}/mo</span>
              </div>

              {stripeSubscription.current_period_start && stripeSubscription.current_period_end && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Current Period:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(stripeSubscription.current_period_start * 1000).toLocaleDateString()} - 
                      {new Date(stripeSubscription.current_period_end * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Next Billing:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(stripeSubscription.current_period_end * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </>
              )}

              {stripeSubscription.payment_method_brand && stripeSubscription.payment_method_last4 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Payment Method:</span>
                  <span className="text-sm text-gray-900">
                    {stripeSubscription.payment_method_brand.toUpperCase()} •••• {stripeSubscription.payment_method_last4}
                  </span>
                </div>
              )}

              {stripeSubscription.cancel_at_period_end && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-600">Cancels at period end:</span>
                  <span className="text-sm text-red-600">Yes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Subscription State */}
      {!stripeSubscription && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center py-8">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Subscription</h3>
            <p className="text-gray-600 mb-6">Choose a plan below to get started with premium features</p>
          </div>
        </div>
      )}

      {/* Available Plans */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Available Plans</h3>

        {checkoutError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800 text-sm">{checkoutError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stripeProducts.map((product) => {
            const isCurrentPlan = stripeSubscription?.price_id === product.priceId
            const canUpgrade = !isCurrentPlan && currentUser?.profile?.role === 'admin'
            const isBusy = busyPlanId === product.priceId
            
            // Calculate pricing for tiered products
            const basePrice = product.price
            const overageUsers = Math.max(0, activeUsers - product.userLimit)
            const overageCost = overageUsers * product.overagePrice
            const totalPrice = basePrice + overageCost

            return (
              <div
                key={product.id}
                className={`relative border-2 rounded-xl p-6 transition-all hover:shadow-lg ${
                  isCurrentPlan ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`w-16 h-16 bg-gradient-to-r ${getPlanColor(product.name)} rounded-xl flex items-center justify-center text-white mx-auto mb-4`}>
                    {getPlanIcon(product.name)}
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">{product.name}</h4>
                  <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                </div>

                <div className="text-center mb-6">
                  {product.isTiered && activeUsers > product.userLimit ? (
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{usd.format(totalPrice)}</div>
                      <div className="text-sm text-gray-600">per month</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {usd.format(basePrice)} base + {usd.format(overageCost)} for {overageUsers} extra user{overageUsers !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl font-bold text-gray-900">{usd.format(product.price)}</div>
                      <div className="text-sm text-gray-600">per month</div>
                      {product.isTiered && (
                        <div className="text-xs text-gray-500 mt-1">
                          Up to {product.userLimit} users included
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  {product.features.map((feature, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {canUpgrade ? (
                  <button
                    onClick={() => handleCheckout(product.priceId)}
                    disabled={checkoutLoading || isBusy}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center ${
                      product.name === 'Business Base'
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:from-yellow-600 hover:to-yellow-700'
                        : product.name === 'Pro Base'
                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                    } disabled:opacity-50`}
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Subscribe for ${usd.format(totalPrice)}/mo`
                    )}
                  </button>
                ) : isCurrentPlan ? (
                  <div className="w-full py-3 px-4 bg-blue-100 text-blue-800 rounded-lg text-center font-medium">
                    <CheckCircle className="w-4 h-4 mr-2 inline" />
                    Current Plan
                  </div>
                ) : (
                  <div className="w-full py-3 px-4 bg-gray-100 text-gray-600 rounded-lg text-center font-medium">
                    Contact Admin to Change Plans
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Subscription Features */}
      {currentStripeProduct && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Plan Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentStripeProduct.features.map((feature, index) => (
              <div key={index} className="flex items-center text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Statistics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Usage Statistics</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Active Users</p>
                <p className="text-2xl font-bold text-blue-900">{activeUsers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Current Plan</p>
                <p className="text-lg font-bold text-green-900">{currentStripeProduct?.name || 'No Plan'}</p>
              </div>
              <Package className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Billing Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Information</h3>

        {stripeSubscription ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Subscription Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Subscription ID:</span>
                  <span className="text-sm text-gray-900 font-mono">
                    {stripeSubscription.subscription_id || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Customer ID:</span>
                  <span className="text-sm text-gray-900 font-mono">
                    {stripeSubscription.customer_id || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Price ID:</span>
                  <span className="text-sm text-gray-900 font-mono">
                    {stripeSubscription.price_id || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Billing Cycle</h4>
              <div className="space-y-2">
                {stripeSubscription.current_period_start && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Period Start:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(stripeSubscription.current_period_start * 1000).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {stripeSubscription.current_period_end && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Period End:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(stripeSubscription.current_period_end * 1000).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Auto-renew:</span>
                  <span className="text-sm text-gray-900">
                    {stripeSubscription.cancel_at_period_end ? 'No' : 'Yes'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No billing information available</p>
            <p className="text-sm">Subscribe to a plan to see billing details</p>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-2">Billing Questions</h4>
            <p className="text-sm text-gray-600 mb-3">
              Have questions about your subscription or billing? We're here to help.
            </p>
            <a
              href="mailto:billing@folioops.com"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Contact Billing Support
            </a>
          </div>
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-2">Plan Changes</h4>
            <p className="text-sm text-gray-600 mb-3">
              Want to upgrade or downgrade your plan? Only admins can make plan changes.
            </p>
            {currentUser?.profile?.role !== 'admin' && (
              <p className="text-sm text-orange-600">
                Contact your admin to change subscription plans.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Usage Statistics</h3>
        
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">User Limit Progress</span>
            <span className="text-sm text-gray-600">{activeUsers} / {planLimit} users</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                activeUsers > planLimit ? 'bg-red-500' : 
                activeUsers / planLimit > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min((activeUsers / planLimit) * 100, 100)}%` }}
            ></div>
          </div>
          {activeUsers > planLimit && (
            <p className="text-xs text-red-600 mt-1">
              You are {activeUsers - planLimit} user{activeUsers - planLimit !== 1 ? 's' : ''} over your plan limit
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Active Users</p>
                <p className="text-2xl font-bold text-blue-900">{activeUsers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Plan Limit</p>
                <p className="text-2xl font-bold text-green-900">{planLimit}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          {overageUsers > 0 && (
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Overage Users</p>
                  <p className="text-2xl font-bold text-red-900">{overageUsers}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          )}

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Monthly Cost</p>
                <p className="text-2xl font-bold text-purple-900">{usd.format(totalMonthlyCost)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {overageUsers > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Overage Charges Apply</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  You have {overageUsers} user{overageUsers !== 1 ? 's' : ''} over your plan limit. Additional charges of {usd.format(overageCost)}/month will apply at {usd.format(perUserCost)}/user.
                </p>
                <p className="text-sm text-yellow-700 mt-2">
                  Consider upgrading to a higher plan to reduce per-user costs.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Billing Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Current Period</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Period Start:</span>
                <span className="text-sm text-gray-900">
                  {currentSubscription ? new Date(currentSubscription.current_period_start).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Period End:</span>
                <span className="text-sm text-gray-900">
                  {currentSubscription ? new Date(currentSubscription.current_period_end).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Next Billing:</span>
                <span className="text-sm text-gray-900">
                  {currentSubscription ? new Date(currentSubscription.current_period_end).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Cost Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Base Plan:</span>
                <span className="text-sm text-gray-900">{usd.format(currentStripeProduct?.price || 0)}</span>
              </div>
              {overageUsers > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Overage ({overageUsers} users × {usd.format(perUserCost)}):</span>
                  <span className="text-sm text-gray-900">{usd.format(overageCost)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm font-semibold text-gray-900">Total:</span>
                <span className="text-sm font-bold text-gray-900">{usd.format(totalMonthlyCost)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing History</h3>
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No billing history available yet</p>
          <p className="text-sm">Your billing history will appear here after your first billing cycle</p>
        </div>
      </div>
    </div>
  )
}
