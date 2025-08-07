import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { hasFeatureAccess, SubscriptionPlan, getUpgradeMessage } from './lib/subscriptionPlans'
import Auth from './components/Auth'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Estimates from './components/Estimates'
import Projects from './components/Projects'
import WorkOrders from './components/WorkOrders'
import Customers from './components/Customers'
import Technicians from './components/Technicians'
import Invoices from './components/Invoices'
import MyJobs from './components/MyJobs'

// Import PurchaseOrders component
import PurchaseOrders from './components/PurchaseOrders'

// Import the Settings component
import Settings from './components/Settings'
import Dispatch from './components/Dispatch'
import TimeCards from './components/TimeCards'
import Leads from './components/Leads'
import Opportunities from './components/Opportunities'
import Vendors from './components/Vendors'
import Maintenance from './components/Maintenance'
import CRMDashboard from './components/CRMDashboard'
import Reports from './components/Reports'
import Teams from './components/Teams'
import Inventory from './components/Inventory'
import UpgradeModal from './components/UpgradeModal'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>('starter')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeMessage, setUpgradeMessage] = useState('')

  useEffect(() => {
    // Listen for navigation events
    const handleNavigation = (e: CustomEvent) => {
      setCurrentPage(e.detail);
    };
    
    window.addEventListener('navigate', handleNavigation as EventListener);
    
    return () => {
      window.removeEventListener('navigate', handleNavigation as EventListener);
    };
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error || !session) {
        // Clear any stale tokens if there's an error or no session
        await supabase.auth.signOut()
      }
      setSession(session)
      
      // Load user plan if session exists
      if (session) {
        loadUserPlan()
      }
      
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadUserPlan()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select(`
            company:companies(subscription_plan)
          `)
          .eq('id', user.id)
          .single()
        
        const planFromDB = profile?.company?.subscription_plan
        // Validate the plan exists in our SUBSCRIPTION_PLANS, default to 'starter' if not
        if (planFromDB && ['starter', 'pro', 'business', 'basic'].includes(planFromDB)) {
          // Map 'basic' to 'business' for backwards compatibility
          const mappedPlan = planFromDB === 'basic' ? 'business' : planFromDB
          setUserPlan(mappedPlan as SubscriptionPlan)
        } else {
          setUserPlan('starter')
        }
      }
    } catch (error) {
      console.error('Error loading user plan:', error)
      // Default to starter plan on error
      setUserPlan('starter')
    }
  }

  const handlePageChange = (page: string) => {
    // Check if user has access to this page
    if (!hasFeatureAccess(userPlan, page)) {
      const message = getUpgradeMessage(userPlan, page)
      setUpgradeMessage(message)
      setShowUpgradeModal(true)
      return
    }
    
    setCurrentPage(page)
  }

  const renderCurrentPage = () => {
    // Double-check access before rendering
    if (!hasFeatureAccess(userPlan, currentPage)) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Feature Not Available</h2>
            <p className="text-gray-600 mb-4">This feature is not included in your current plan.</p>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      )
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'crm':
        return <CRMDashboard />  
      case 'dispatch':
        return <Dispatch />
      case 'my-jobs':
        return <MyJobs />
      case 'time-cards':
        return <TimeCards />
      case 'leads':
        return <Leads />
      case 'opportunities':
        return <Opportunities />
      case 'maintenance':
        return <Maintenance />
      case 'estimates':
        return <Estimates />
      case 'projects':
        return <Projects />
      case 'work-orders':
        return <WorkOrders />
      case 'purchase-orders':
        return <PurchaseOrders />
      case 'customers':
        return <Customers />
      case 'technicians':
        return <Technicians />
      case 'teams':
        return <Teams />
      case 'vendors':
        return <Vendors />
      case 'inventory':
        return <Inventory />
      case 'invoices':
        return <Invoices />
      case 'reports':
        return <Reports />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <Layout currentPage={currentPage} onPageChange={handlePageChange}>
      {renderCurrentPage()}
      
      {/* Upgrade Modal */}
      <UpgradeModal 
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={userPlan}
        message={upgradeMessage}
      />
    </Layout>
  )
}

export default App