import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Cloud, CloudRain, CloudSun, MapPin, RefreshCw, Sun, Thermometer, Menu, X, Home, Users, FileText, Package, Settings, LogOut, MessageSquare, Calendar, Clock, User, Truck, Target, Building2, BarChart4, ClipboardList, Wrench, DollarSign, FolderOpen, ShoppingCart, Store, PenTool as Tool } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hasFeatureAccess, SubscriptionPlan } from '../lib/subscriptionPlans'

interface LayoutProps {
  children: React.ReactNode
  currentPage: string
  onPageChange: (page: string) => void
}
export default function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>('starter')

  // Define which navigation items are visible to which roles
  const getVisibleNavItems = (role: string, plan: SubscriptionPlan) => {
    // Common items for all roles
    const commonItems = [
      { name: 'Dashboard', href: 'dashboard', icon: Home },
      { name: 'Time Cards', href: 'time-cards', icon: Clock },
      ...(hasFeatureAccess(plan, 'dispatch') ? [{ name: 'Dispatch', href: 'dispatch', icon: Truck }] : []),
    ];
    
    // Items for techs only
    const techItems = [
      { name: 'My Jobs', href: 'my-jobs', icon: ClipboardList },
     { name: 'Work Orders', href: 'work-orders', icon: ClipboardList },
     { name: 'Customers', href: 'customers', icon: Users },
     { name: 'Purchase Orders', href: 'purchase-orders', icon: ShoppingCart },
     { name: 'Vendors', href: 'vendors', icon: Store },
    ];
    
    // Items only for admin and manager roles
    const adminManagerItems = [
      { 
        name: 'Field Service', 
        children: [
          { name: 'Work Orders', href: 'work-orders', icon: ClipboardList },
          ...(hasFeatureAccess(plan, 'projects') ? [{ name: 'Projects', href: 'projects', icon: FolderOpen }] : []),
          ...(hasFeatureAccess(plan, 'estimates') ? [{ name: 'Estimates', href: 'estimates', icon: FileText }] : []),
          { name: 'Customers', href: 'customers', icon: Users },
          { name: 'Maintenance', href: 'maintenance', icon: Tool },
        ]
      },
      { 
        name: 'Purchasing', 
        children: [
          { name: 'Purchase Orders', href: 'purchase-orders', icon: ShoppingCart },
          { name: 'Vendors', href: 'vendors', icon: Store },
          { name: 'Inventory', href: 'inventory', icon: Package },
        ]
      },
      ...(hasFeatureAccess(plan, 'invoices') ? [{ name: 'Invoices', href: 'invoices', icon: DollarSign }] : []),
      { 
        name: 'Employees', 
        children: [
          { name: 'Technicians', href: 'technicians', icon: Wrench },
          { name: 'Teams', href: 'teams', icon: Users },
        ]
      },
      ...(hasFeatureAccess(plan, 'crm') ? [{ 
        name: 'CRM', 
        children: [
          { name: 'CRM Dashboard', href: 'crm', icon: BarChart4 },
          { name: 'Leads', href: 'leads', icon: Target },
          { name: 'Opportunities', href: 'opportunities', icon: Target },
        ]
      }] : []),
      ...(hasFeatureAccess(plan, 'reports') ? [{ name: 'Reports', href: 'reports', icon: BarChart4 }] : []),
    ];
    
    // Items for office staff
    const officeItems = [
      { name: 'Work Orders', href: 'work-orders', icon: ClipboardList },
      ...(hasFeatureAccess(plan, 'estimates') ? [{ name: 'Estimates', href: 'estimates', icon: FileText }] : []),
      ...(hasFeatureAccess(plan, 'invoices') ? [{ name: 'Invoices', href: 'invoices', icon: DollarSign }] : []),
      { name: 'Customers', href: 'customers', icon: Users },
      { 
        name: 'Purchasing', 
        children: [
          { name: 'Purchase Orders', href: 'purchase-orders', icon: ShoppingCart },
          { name: 'Vendors', href: 'vendors', icon: Store },
        ]
      },
      ...(hasFeatureAccess(plan, 'crm') ? [{ 
        name: 'CRM', 
        children: [
          { name: 'CRM Dashboard', href: 'crm', icon: BarChart4 },
          { name: 'Leads', href: 'leads', icon: Target },
          { name: 'Opportunities', href: 'opportunities', icon: Target },
        ]
      }] : []),
    ];
    
    // Return appropriate navigation items based on role
    if (role === 'admin' || role === 'manager') {
      return [...commonItems, { name: 'My Jobs', href: 'my-jobs', icon: ClipboardList }, ...adminManagerItems];
    }
    
    if (role === 'office') {
      return [...commonItems, ...officeItems];
    }
    
    // Tech role gets My Jobs
    return [...commonItems, ...techItems];
  };

  useEffect(() => {
    getCurrentUser()
  }, [])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          *,
          company:companies(subscription_plan)
        `)
        .eq('id', user.id)
        .single()
      
      if (profile) {
        const dbPlan = profile.company?.subscription_plan
        const plan = (dbPlan === 'starter' || dbPlan === 'pro' || dbPlan === 'business') 
          ? dbPlan 
          : 'starter'
        setUserPlan(plan as SubscriptionPlan)
        setCurrentUser({ ...user, profile })
      }
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // Get navigation items based on user role
  const navigation = currentUser?.profile?.role
    ? getVisibleNavItems(currentUser.profile.role, userPlan)
    : [];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 ${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200 relative">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
              <div className="flex-shrink-0">
                <img 
                  src="/Element (1).png" 
                  alt="Logo" 
                  className="h-8 w-8"
                />
              </div>
              <div className={`ml-2 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
                <h1 className="folioops-logo" style={{ fontSize: '24px' }}>FolioOps</h1>
              </div>
            </div>
            <button 
              className="md:hidden text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
            <button
              className="absolute -right-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-1 border border-gray-200 shadow-sm hidden md:block"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? 
                <ChevronRight className="h-4 w-4 text-gray-500" /> : 
                <ChevronLeft className="h-4 w-4 text-gray-500" />
              }
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-4">
            <nav className={`space-y-1 ${sidebarCollapsed ? 'px-1' : 'px-2'}`}>
              {navigation.map((item) => 
                item.children ? (
                  <div key={item.name} className={`mb-4 ${sidebarCollapsed ? 'text-center' : ''}`}>
                    <h3 className={`${sidebarCollapsed ? 'px-1 text-[10px]' : 'px-3 text-xs'} font-semibold text-gray-500 uppercase tracking-wider`}>
                      {item.name}
                    </h3>
                    <div className={`mt-1 space-y-1`}>
                      {item.children.map((subItem) => {
                        const Icon = subItem.icon
                        return (
                          <button
                            key={subItem.name}
                            onClick={() => {
                              onPageChange(subItem.href)
                              setSidebarOpen(false)
                            }}
                            className={`group flex ${sidebarCollapsed ? 'flex-col justify-center' : 'items-center'} ${sidebarCollapsed ? 'px-1' : 'px-3'} py-2 text-sm font-medium rounded-md w-full ${
                              currentPage === subItem.href
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <Icon className={`${sidebarCollapsed ? 'mb-1' : 'mr-3'} h-5 w-5 ${
                              currentPage === subItem.href
                                ? 'text-blue-500'
                                : 'text-gray-400 group-hover:text-gray-500'
                            }`} />
                            {!sidebarCollapsed && subItem.name}
                            {sidebarCollapsed && <span className="text-[10px]">{subItem.name.split(' ')[0]}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    key={item.name}
                    onClick={() => {
                      onPageChange(item.href)
                      setSidebarOpen(false)
                    }}
                    className={`group flex ${sidebarCollapsed ? 'flex-col justify-center' : 'items-center'} ${sidebarCollapsed ? 'px-1' : 'px-3'} py-2 text-sm font-medium rounded-md w-full ${
                      currentPage === item.href
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className={`${sidebarCollapsed ? 'mb-1' : 'mr-3'} h-5 w-5 ${
                      currentPage === item.href
                        ? 'text-blue-500'
                        : 'text-gray-400 group-hover:text-gray-500'
                    }`} />
                    {!sidebarCollapsed && item.name}
                    {sidebarCollapsed && <span className="text-[10px]">{item.name.split(' ')[0]}</span>}
                  </button>
                )
              )}
            </nav>
          </div>

          {/* User menu */}
          <div className={`border-t border-gray-200 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
            <div className={`${sidebarCollapsed ? 'flex flex-col items-center' : 'flex items-center'}`}>
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className={`${sidebarCollapsed ? 'mt-2 text-center' : 'ml-3'}`}>
                <p className="text-sm font-medium text-gray-900">
                  {sidebarCollapsed ? currentUser?.profile?.first_name?.charAt(0) + currentUser?.profile?.last_name?.charAt(0) : `${currentUser?.profile?.first_name} ${currentUser?.profile?.last_name}`}
                </p>
                <p className={`text-xs text-gray-500 capitalize ${sidebarCollapsed ? 'hidden' : 'block'}`}>
                  {currentUser?.profile?.role}
                </p>
              </div>
            </div>
            <div className={`mt-3 space-y-1 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
              <button
                onClick={() => {
                  onPageChange('settings')
                  setSidebarOpen(false)
                }}
                className={`group ${sidebarCollapsed ? 'flex flex-col items-center justify-center' : 'flex items-center'} ${sidebarCollapsed ? 'px-1' : 'px-3'} py-2 text-sm font-medium rounded-md w-full text-gray-700 hover:bg-gray-50 hover:text-gray-900`}
              >
                <Settings className={`${sidebarCollapsed ? 'mb-1' : 'mr-3'} h-5 w-5 text-gray-400 group-hover:text-gray-500`} />
                {!sidebarCollapsed && 'Settings'}
              </button>
              <button
                onClick={handleSignOut}
                className={`group ${sidebarCollapsed ? 'flex flex-col items-center justify-center' : 'flex items-center'} ${sidebarCollapsed ? 'px-1' : 'px-3'} py-2 text-sm font-medium rounded-md w-full text-gray-700 hover:bg-gray-50 hover:text-gray-900`}
              >
                <LogOut className={`${sidebarCollapsed ? 'mb-1' : 'mr-3'} h-5 w-5 text-gray-400 group-hover:text-gray-500`} />
                {!sidebarCollapsed && 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between h-16 bg-white shadow-sm px-4 lg:px-6">
          <button
            className="md:hidden text-gray-500 hover:text-gray-700 mr-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 flex justify-between items-center">
            <div></div>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
          </div>
        </div>

        {/* Page content */}
        <main className={`py-6 px-4 sm:px-6 lg:px-8 overflow-x-auto transition-all duration-300 ${sidebarOpen ? 'md:ml-0' : ''}`}>
          {children}
        </main>
    </div>
  )
}