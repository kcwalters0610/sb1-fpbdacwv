import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { hasFeature } from './lib/subscriptionAccess'
import Auth from './components/Auth'
import ResetPassword from './components/ResetPassword'
import SuccessPage from './components/SuccessPage'
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
import { Package } from 'lucide-react'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [hasAccessToPage, setHasAccessToPage] = useState(true)
  const [isPasswordReset, setIsPasswordReset] = useState(false)
  const [showSuccessPage, setShowSuccessPage] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // First check if this is a password reset by looking at the URL
        const urlParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        
        const isRecoveryFromSearch = urlParams.get('type') === 'recovery'
        const isRecoveryFromHash = hashParams.get('type') === 'recovery'
        const isSuccess = urlParams.get('status') === 'success'
        const isCancel = urlParams.get('status') === 'cancel'
        
        console.log('URL search params:', window.location.search)
        console.log('URL hash params:', window.location.hash)
        console.log('Is recovery from search:', isRecoveryFromSearch)
        console.log('Is recovery from hash:', isRecoveryFromHash)
        console.log('Is success:', isSuccess)
        console.log('Is cancel:', isCancel)
        
        if (isRecoveryFromSearch || isRecoveryFromHash) {
          console.log('Password reset detected, showing reset page')
          setIsPasswordReset(true)
          setLoading(false)
          return
        }
        
        if (isSuccess) {
          console.log('Success page detected')
          setShowSuccessPage(true)
          setCheckoutLoading(false)
          setLoading(false)
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname)
          return
        }
        
        if (isCancel) {
          console.log('Checkout cancelled, cleaning up URL')
          setCheckoutLoading(false)
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname)
        }
        
        // Normal auth flow
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth error:', error)
          await supabase.auth.signOut()
        }
        
        setSession(session)
        setLoading(false)
        
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session)
        })
        
        return () => subscription.unsubscribe()
      } catch (error) {
        console.error('Error initializing app:', error)
        setLoading(false)
      }
    }
    
    initializeApp()
  }, [])

  useEffect(() => {
    checkPageAccess()
  }, [currentPage])

  const checkPageAccess = async () => {
    // Define which pages require which features
    const pageFeatureMap: Record<string, string> = {
      'projects': 'projects',
      'estimates': 'estimates',
      'inventory': 'inventory',
      'purchase-orders': 'purchase_orders',
      'maintenance': 'maintenance',
      'crm': 'crm',
      'leads': 'leads',
      'opportunities': 'opportunities',
      'reports': 'advanced_reports'
    }

    const requiredFeature = pageFeatureMap[currentPage]
    if (requiredFeature) {
      const hasAccess = await hasFeature(requiredFeature as any)
      setHasAccessToPage(hasAccess)
      
      // Redirect to dashboard if no access
      if (!hasAccess) {
        setCurrentPage('dashboard')
      }
    } else {
      setHasAccessToPage(true)
    }
  }

  const renderCurrentPage = () => {
    // Show upgrade message for restricted pages
    if (!hasAccessToPage) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Feature Not Available</h3>
            <p className="text-gray-600 mb-4">This feature requires a higher subscription plan.</p>
            <button
              onClick={() => setCurrentPage('settings')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
        return <CRMDashboard onPageChange={setCurrentPage} />
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

  // Show password reset page if this is a password reset flow
  if (isPasswordReset) {
    return <ResetPassword />
  }

  // Show success page after successful payment
  if (showSuccessPage) {
    return <SuccessPage onContinue={() => {
      setShowSuccessPage(false)
      setCurrentPage('dashboard')
    }} />
  }

  // Show loading state during checkout
  if (checkoutLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Payment</h3>
          <p className="text-gray-600">Please wait while we redirect you to checkout...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderCurrentPage()}
    </Layout>
  )
}

export default App