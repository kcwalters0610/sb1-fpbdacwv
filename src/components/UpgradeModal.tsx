import React from 'react'
import { X, Check, Star, Zap, Crown } from 'lucide-react'
import { SubscriptionPlan, SUBSCRIPTION_PLANS } from '../lib/subscriptionPlans'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  currentPlan: SubscriptionPlan
  message: string
}

export default function UpgradeModal({ isOpen, onClose, currentPlan, message }: UpgradeModalProps) {
  if (!isOpen) return null

  const handleUpgrade = (plan: SubscriptionPlan) => {
    // In a real app, this would integrate with Stripe or another payment processor
    alert(`Upgrade to ${SUBSCRIPTION_PLANS[plan].name} plan would be handled here with payment processing.`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          {message && (
            <p className="text-gray-600 mt-2">{message}</p>
          )}
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(SUBSCRIPTION_PLANS).map(([planKey, plan]) => {
              const isCurrentPlan = planKey === currentPlan
              const isPlanUpgrade = (
                (currentPlan === 'starter' && (planKey === 'pro' || planKey === 'business')) ||
                (currentPlan === 'pro' && planKey === 'business')
              )
              
              return (
                <div
                  key={planKey}
                  className={`relative rounded-xl border-2 p-6 ${
                    isCurrentPlan
                      ? 'border-blue-500 bg-blue-50'
                      : isPlanUpgrade
                      ? 'border-gray-200 hover:border-blue-300 hover:shadow-md transition-all'
                      : 'border-gray-200 opacity-75'
                  }`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Current Plan
                      </span>
                    </div>
                  )}
                  
                  {planKey === 'business' && (
                    <div className="absolute -top-3 right-4">
                      <Crown className="w-6 h-6 text-yellow-500" />
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center mb-2">
                      {planKey === 'starter' && <Star className="w-6 h-6 text-green-500 mr-2" />}
                      {planKey === 'pro' && <Zap className="w-6 h-6 text-blue-500 mr-2" />}
                      {planKey === 'business' && <Crown className="w-6 h-6 text-purple-500 mr-2" />}
                      <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{plan.price}</p>
                    <p className="text-gray-600">per company</p>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="text-center">
                    {isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                      >
                        Current Plan
                      </button>
                    ) : isPlanUpgrade ? (
                      <button
                        onClick={() => handleUpgrade(planKey as SubscriptionPlan)}
                        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                          planKey === 'business'
                            ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        Upgrade to {plan.name}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-3 px-4 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                      >
                        Downgrade Not Available
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">
              Need help choosing the right plan? Contact our sales team for a personalized recommendation.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Maybe Later
              </button>
              <a
                href="mailto:sales@folioops.com"
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}