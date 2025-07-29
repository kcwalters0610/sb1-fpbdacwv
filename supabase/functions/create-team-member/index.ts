import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create regular client to verify the requesting user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the requesting user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if the requesting user is an admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .maybeSingle()

    console.log('User ID:', user.id)
    console.log('Profile data:', profile)
    console.log('Profile error:', profileError)

    if (profileError) {
      console.error('Profile lookup error:', profileError)
      throw new Error(`Profile lookup failed: ${profileError.message}`)
    }

    if (!profile) {
      throw new Error('User profile not found')
    }

    if (profile.role !== 'admin') {
      throw new Error(`User role is '${profile.role}', but admin role is required`)
    }

    // Parse the request body
    const { email, password, first_name, last_name, role, department_id } = await req.json()

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !role) {
      throw new Error('Missing required fields')
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email)

    if (existingUsers && existingUsers.length > 0) {
      throw new Error('A user with this email already exists')
    }

    // Create the user with admin privileges
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        role
      }
    })

    if (createError) {
      throw createError
    }

    if (!newUser?.user) {
      throw new Error('Failed to create user')
    }

    // Create the profile record
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: newUser.user.id,
        email,
        company_id: profile.company_id,
        first_name,
        last_name,
        role,
        is_active: true
      }])

    if (profileInsertError) {
      // If profile creation fails, delete the user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw profileInsertError
    }

    // Add to department if specified
    if (department_id) {
      const { error: deptError } = await supabaseAdmin
        .from('department_members')
        .insert([{
          department_id,
          user_id: newUser.user.id
        }])

      if (deptError) {
        console.error('Error adding to department:', deptError)
        // Don't fail the entire operation for department assignment errors
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email,
          first_name,
          last_name,
          role
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error creating team member:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})