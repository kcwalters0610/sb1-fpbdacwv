import React, { useEffect, useState } from 'react'
import { CheckCircle, ArrowRight, Package, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getProductByPriceId } from '../stripe-config'

interface SuccessPageProps {
  onContinue: () => void
}

export default function SuccessPage({ onContinue }: SuccessPageProps) {
  const [subscriptionData, setSubscriptionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  const loadSubscriptionData = async () => {
    try {
      const { data } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle()

      setSubscriptionData(data)
    } catch (error) {
      console.error('Error loading subscription data:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentProduct = subscriptionData?.price_id ? getProductByPriceId(subscriptionData.price_id) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center animate-fade-in-up">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600">Your subscription has been activated</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : currentProduct ? (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-center mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mr-4 ${
                  currentProduct.name === 'Business Base' ? 'bg-yellow-100' :
                  currentProduct.name === 'Pro Base' ? 'bg-purple-100' : 'bg-blue-100'
                }`}>
                  <Package className={`w-6 h-6 ${
                    currentProduct.name === 'Business Base' ? 'text-yellow-600' :
                    currentProduct.name === 'Pro Base' ? 'text-purple-600' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{currentProduct.name}</h3>
                  <p className="text-sm text-gray-600">${currentProduct.price.toFixed(2)}/month</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {currentProduct.features.slice(0, 4).map((feature, index) => (
                  <div key={index} className="flex items-center text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
                {currentProduct.features.length > 4 && (
                  <p className="text-sm text-gray-500 mt-2">
                    +{currentProduct.features.length - 4} more features
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Subscription Active</h3>
                  <p className="text-sm text-gray-600">Your plan is now active</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">What's Next?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Access all {currentProduct?.name || 'plan'} features</li>
                <li>• Manage your team and projects</li>
                <li>• View billing details in settings</li>
                <li>• Invite team members to your workspace</li>
              </ul>
            </div>

            <button
              onClick={onContinue}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-md flex items-center justify-center"
            >
              Continue to Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}