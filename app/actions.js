"use server";

import { supabase, getSupabaseAdmin } from "@/lib/supabase";
import { processCustomerTransactions } from "@/lib/interest";

/**
 * Public Action: Fetches all customer IDs and Names to display on the landing page list.
 * This does not leak mobile numbers or DOBs.
 */
export async function fetchCustomersPublic() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl || 
    !supabaseServiceKey || 
    supabaseUrl.includes("your-project-id") || 
    supabaseServiceKey.includes("your-service-role-key")
  ) {
    return {
      success: false,
      error: "Supabase database connection is not configured. Please set up your credentials in .env.local.",
      isConfigMissing: true
    };
  }

  try {
    const adminClient = getSupabaseAdmin();
    const { data, error } = await adminClient
      .from("customers")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching public customer list:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Server error in fetchCustomersPublic:", err);
    return { success: false, error: "Internal server error" };
  }
}/**
 * Secure Server Action: Verifies customer mobile and DOB, then processes their transactions.
 */
export async function verifyCustomer(customerId, mobileNumber, dob) {
  if (!customerId || !mobileNumber || !dob) {
    return { success: false, error: "Missing required verification fields." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl || 
    !supabaseServiceKey || 
    supabaseUrl.includes("your-project-id") || 
    supabaseServiceKey.includes("your-service-role-key")
  ) {
    return { success: false, error: "Database not configured. Admin credentials are missing." };
  }

  try {
    const adminClient = getSupabaseAdmin();
    const cleanMobile = mobileNumber.trim();
    const cleanDob = dob.trim();

    // 1. Verify credentials
    const { data: customer, error: custError } = await adminClient
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .eq("mobile_number", cleanMobile)
      .eq("dob", cleanDob)
      .single();

    if (custError || !customer) {
      return { success: false, error: "Verification failed. Please check your mobile number and date of birth." };
    }

    // 2. Fetch transaction history
    const { data: transactions, error: txError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true });

    if (txError) {
      console.error("Error fetching customer transactions:", txError.message);
      return { success: false, error: "Failed to load transaction history." };
    }

    // 3. Process transactions (FIFO + dynamic interest)
    const result = processCustomerTransactions(transactions || [], new Date());

    return {
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        mobile_number: customer.mobile_number,
        dob: customer.dob,
      },
      summary: result,
    };
  } catch (err) {
    console.error("Server error in verifyCustomer:", err);
    return { success: false, error: "Internal server error during verification." };
  }
}

/**
 * Admin Action: Verify Admin Login Credentials
 * We can log in using Supabase Auth, but to make sure session token is checked, 
 * standard supabase.auth works. We can implement standard auth on the client-side, 
 * but let's provide a server action if needed, or simply handle it using supabase.auth.signInWithPassword.
 */
export async function checkSession(token) {
  // Can verify session token if needed, but client-side Supabase handles this automatically.
}
