import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { hasFeature } from './lib/subscriptionAccess'
import Auth from './components/Auth'
import ResetPassword from './components/ResetPassword'
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

  useEffect(() => {
    // Check if this is a password reset flow by looking for recovery tokens
    const checkPasswordReset = async () => {
      const hash = window.location.hash
      const search = window.location.search
      
      console.log('Checking for password reset tokens...')
      console.log('Hash:', hash)
      console.log('Search:', search)
      
      // Check for recovery type in hash or search params
      let isRecovery = false
      let accessToken = ''
      let refreshToken = ''
      
      if (hash.includes('type=recovery')) {
        console.log('Found recovery type in hash')
        const params = new URLSearchParams(hash.substring(1))
        isRecovery = params.get('type') === 'recovery'
        accessToken = params.get('access_token') || ''
        refreshToken = params.get('refresh_token') || ''
      } else if (search.includes('type=recovery')) {
        console.log('Found recovery type in search')
        const params = new URLSearchParams(search)
        isRecovery = params.get('type') === 'recovery'
        accessToken = params.get('access_token') || ''
        refreshToken = params.get('refresh_token') || ''
      }
      
      console.log('Recovery check results:', { isRecovery, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken })
      
      if (isRecovery && accessToken && refreshToken) {
        console.log('Setting up password reset session...')
        try {
          // Set the session from the recovery tokens
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          
          if (!error) {
            console.log('Password reset session set successfully')
            setIsPasswordReset(true)
            setLoading(false)
            // Clear the URL parameters after processing
            window.history.replaceState({}, document.title, window.location.pathname)
            return true
          } else {
            console.error('Error setting password reset session:', error)
          }
        } catch (error) {
          console.error('Error setting session for password reset:', error)
        }
      } else {
        console.log('No valid recovery tokens found')
      }
      return false
    }
    
    // Check for password reset first
    checkPasswordReset().then((isReset) => {
      if (isReset) return
      
      // If not a password reset, proceed with normal auth flow
      initializeAuth()
    })
  }, [])

  const initializeAuth = async () => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error || !session) {
        // Clear any stale tokens if there's an error or no session
        await supabase.auth.signOut()
      }
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }

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

  // Show password reset page if this is a password reset flow
  if (isPasswordReset) {
    return <ResetPassword />
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