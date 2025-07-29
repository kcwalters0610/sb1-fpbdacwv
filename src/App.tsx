import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
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

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')

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
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const renderCurrentPage = () => {
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
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderCurrentPage()}
    </Layout>
  )
}

export default App