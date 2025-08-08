import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Building2, Mail, Lock, Eye, EyeOff } from 'lucide-react'

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (!email) {
        throw new Error('Please enter your email address')
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}?type=recovery`,
      })
      if (error) {
        // Handle rate limit errors specifically
        if (error.message?.includes('email rate limit exceeded') || error.message?.includes('over_email_send_rate_limit')) {
          setError('Too many password reset requests. Please wait 3 minutes before trying again.')
          setCooldownSeconds(180)
          const interval = setInterval(() => {
            setCooldownSeconds((prev) => {
              if (prev <= 1) {
                clearInterval(interval)
                return 0
              }
              return prev - 1
            })
          }, 1000)
          return
        }
        throw error
      }

      setMessage('Password reset email sent! Check your inbox for instructions.')
      setShowForgotPassword(false)
    } catch (error: any) {
      // Only set generic error if we haven't already handled it above
      if (!error.message?.includes('email rate limit exceeded') && !error.message?.includes('over_email_send_rate_limit')) {
        setError(error.message || 'An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00446c] via-[#3a8dbd] to-[#6ac2e0] flex items-center justify-center p-4 animate-gradient-x">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="mb-4">
              <img 
                src="/Element (1).png" 
                alt="FolioOps Logo" 
                className="w-16 h-16 mx-auto object-contain"
              />
            </div>
            <h1 
              className="text-3xl font-bold mb-2 folioops-logo"
            >
              FolioOps
            </h1>
            <p className="text-gray-600"></p>
          </div>

          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset Password</h2>
                <p className="text-gray-600 text-sm">Enter your email address and we'll send you a link to reset your password.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              {message && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 text-sm">{message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || cooldownSeconds > 0}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-md"
              >
                {loading ? 'Sending...' : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Send Reset Email'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setError('')
                    setMessage('')
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

             {message && (
               <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                 <p className="text-green-800 text-sm">{message}</p>
               </div>
             )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-md"
            >
              {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>

             {!isSignUp && (
               <div className="text-center">
                 <button
                   type="button"
                   onClick={() => {
                     setShowForgotPassword(true)
                     setError('')
                     setMessage('')
                   }}
                   className="text-blue-600 hover:text-blue-800 font-medium transition-colors hover:underline text-sm"
                 >
                   Forgot your password?
                 </button>
               </div>
             )}
           </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-600 hover:text-blue-800 font-medium transition-colors hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Auth