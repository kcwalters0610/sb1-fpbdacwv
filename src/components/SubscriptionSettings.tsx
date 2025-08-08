import React, { useState, useEffect } from 'react'
import { 
  CreditCard, 
  Users, 
  DollarSign, 
  Calendar, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Package,
  Crown,
  Zap,
  Building2
} from 'lucide-react'
import { supabase, SubscriptionPlan, CompanySubscription, SubscriptionUsage } from '../lib/supabase'

export default function SubscriptionSettings() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<CompanySubscription | null>(null)
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeUsers, setActiveUsers] = useState(0)

  useEffect(() => {
    getCurrentUser()
    loadSubscriptionData()
  }, [])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        setCurrentUser({ ...user, profile })
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const loadSubscriptionData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      // Load subscription plans
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_price')

      setPlans(plansData || [])

      // Load current subscription
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

      // Load current usage
      const currentMonth = new Date()
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

      const { data: usageData } = await supabase
        .from('subscription_usage')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('billing_period_start', startOfMonth.toISOString().split('T')[0])
        .lte('billing_period_end', endOfMonth.toISOString().split('T')[0])
        .maybeSingle()

      setUsage(usageData)

      // Get active user count
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

  const upgradePlan = async (planId: string) => {
    if (!currentUser?.profile?.company_id) return

    setUpgrading(true)
    try {
      const { data, error } = await supabase.rpc('update_company_subscription_plan', {
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

  const calculateOverage = () => {
    if (!currentSubscription?.plan) return { overageUsers: 0, overageCost: 0 }
    
    const overageUsers = Math.max(0, activeUsers - currentSubscription.plan.user_limit)
    const overageCost = overageUsers * currentSubscription.plan.overage_price
    
    return { 
      overageUsers, 
      overageCost,
      perUserCost: currentSubscription.plan.overage_price,
      planLimit: currentSubscription.plan.user_limit
    }
  }

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'starter': return <Package className="w-6 h-6" />
      case 'pro': return <Zap className="w-6 h-6" />
      case 'business': return <Crown className="w-6 h-6" />
      default: return <Package className="w-6 h-6" />
    }
  }

  const getPlanColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'starter': return 'from-blue-500 to-blue-600'
      case 'pro': return 'from-purple-500 to-purple-600'
      case 'business': return 'from-yellow-500 to-yellow-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const { overageUsers, overageCost, perUserCost, planLimit } = calculateOverage()
  const totalMonthlyCost = (currentSubscription?.plan?.monthly_price || 0) + overageCost

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      {currentSubscription && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 bg-gradient-to-r ${getPlanColor(currentSubscription.plan?.name || '')} rounded-lg flex items-center justify-center text-white`}>
                {getPlanIcon(currentSubscription.plan?.name || '')}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{currentSubscription.plan?.name}</h4>
                <p className="text-sm text-gray-600">{currentSubscription.plan?.description}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Base Plan:</span>
                <span className="text-sm font-medium">${currentSubscription.plan?.monthly_price.toFixed(2)}/mo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Users:</span>
                <span className={`text-sm font-medium ${overageUsers > 0 ? 'text-red-600' : ''}`}>
                  {activeUsers} / {planLimit}
                </span>
                  {activeUsers} / {planLimit}
                  {overageUsers > 0 && (
                    <span className="text-red-600 ml-1">
                      (+{overageUsers} over)
                    </span>
                  )}
              </div>
              {overageUsers > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-600">
                    Overage ({overageUsers} × ${perUserCost}):
                  </span>
                  <span className="text-sm font-medium text-red-600">
                    +${overageCost.toFixed(2)}/mo
                  </span>
                  </span>
                  <span className="text-sm font-medium text-red-600">
                    +${overageCost.toFixed(2)}/mo
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-semibold text-gray-900">Total Monthly:</span>
                <span className="text-lg font-bold text-gray-900">${totalMonthlyCost.toFixed(2)}/mo</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  currentSubscription.status === 'active' ? 'bg-green-100 text-green-800' :
                  currentSubscription.status === 'past_due' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {currentSubscription.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Period:</span>
                <span className="text-sm">{new Date(currentSubscription.current_period_start).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Renews:</span>
                <span className="text-sm">{new Date(currentSubscription.current_period_end).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {overageUsers > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Overage Charges: {overageUsers} user{overageUsers !== 1 ? 's' : ''} over your {planLimit}-user limit
                  </p>
                  <p className="text-sm text-yellow-700">
                    Additional charges: {overageUsers} × ${perUserCost}/user = ${overageCost.toFixed(2)}/month
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    <strong>Total monthly cost:</strong> ${(currentSubscription?.plan?.monthly_price || 0).toFixed(2)} (base) + ${overageCost.toFixed(2)} (overage) = ${totalMonthlyCost.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Available Plans */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Available Plans</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = currentSubscription?.plan_id === plan.id
            const canUpgrade = !isCurrentPlan && currentUser?.profile?.role === 'admin'
            
            return (
              <div 
                key={plan.id} 
                className={`relative border-2 rounded-xl p-6 transition-all hover:shadow-lg ${
                  isCurrentPlan 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`w-16 h-16 bg-gradient-to-r ${getPlanColor(plan.name)} rounded-xl flex items-center justify-center text-white mx-auto mb-4`}>
                    {getPlanIcon(plan.name)}
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                  <p className="text-gray-600 text-sm mt-1">{plan.description}</p>
                </div>

                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-gray-900">${plan.monthly_price}</div>
                  <div className="text-sm text-gray-600">per month</div>
                  <div className="text-sm text-gray-600 mt-1">{plan.user_limit} users included</div>
                  <div className="text-xs text-gray-500">+$20/user thereafter</div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    <span>Up to {plan.user_limit} team members</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    <span>Work order management</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    <span>Customer management</span>
                  </div>
                  {plan.name !== 'Starter' && (
                    <>
                      <div className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Project management</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Inventory tracking</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>CRM features</span>
                      </div>
                    </>
                  )}
                  {plan.name === 'Business' && (
                    <>
                      <div className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Multi-location support</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>API access</span>
                      </div>
                    </>
                  )}
                </div>

                {canUpgrade ? (
                  <button
                    onClick={() => upgradePlan(plan.id)}
                    disabled={upgrading}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      plan.name === 'Business'
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:from-yellow-600 hover:to-yellow-700'
                        : plan.name === 'Pro'
                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                    } disabled:opacity-50`}
                  >
                    {upgrading ? 'Upgrading...' : `Upgrade to ${plan.name}`}
                  </button>
                ) : isCurrentPlan ? (
                  <div className="w-full py-3 px-4 bg-blue-100 text-blue-800 rounded-lg text-center font-medium">
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

      {/* Usage Statistics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Usage Statistics</h3>
        
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
                <p className="text-2xl font-bold text-green-900">{currentSubscription?.plan?.user_limit || 0}</p>
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
                <p className="text-2xl font-bold text-purple-900">${totalMonthlyCost}</p>
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
                  You have {overageUsers} user{overageUsers !== 1 ? 's' : ''} over your plan limit. 
                  Additional charges of ${overageCost}/month will apply at $20 per user.
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
                <span className="text-sm text-gray-900">${(currentSubscription?.plan?.monthly_price || 0).toFixed(2)}</span>
              </div>
              {overageUsers > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Overage ({overageUsers} users × ${perUserCost}):
                  </span>
                  <span className="text-sm text-gray-900">${overageCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm font-semibold text-gray-900">Total:</span>
                <span className="text-sm font-bold text-gray-900">${totalMonthlyCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Plan Comparison</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">Feature</th>
                <th className="text-center py-3 px-4 font-medium text-gray-900">Starter</th>
                <th className="text-center py-3 px-4 font-medium text-gray-900">Pro</th>
                <th className="text-center py-3 px-4 font-medium text-gray-900">Business</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">Monthly Price</td>
                <td className="py-3 px-4 text-center text-sm font-medium">$99</td>
                <td className="py-3 px-4 text-center text-sm font-medium">$199</td>
                <td className="py-3 px-4 text-center text-sm font-medium">$399</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">Included Users</td>
                <td className="py-3 px-4 text-center text-sm">3</td>
                <td className="py-3 px-4 text-center text-sm">5</td>
                <td className="py-3 px-4 text-center text-sm">10</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">Work Orders</td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">Customer Management</td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">Project Management</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">Inventory Management</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">CRM & Leads</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">Advanced Reports</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">Multi-Location</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">API Access</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center text-gray-400">-</td>
                <td className="py-3 px-4 text-center"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
            </tbody>
          </table>
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