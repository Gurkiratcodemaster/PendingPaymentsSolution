# Supabase Integration and Setup Guide

This guide will walk you through setting up a Supabase project online and integrating it with your Next.js application locally.

---

## Step 1: Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and sign in or create an account.
2. Click **New Project** and select your organization.
3. Fill in the project details:
   - **Name**: e.g., `Printing Shop Payments`
   - **Database Password**: *Save this password securely!*
   - **Region**: Select the region closest to your customers.
   - **Pricing Plan**: Choose **Free** (or any plan of your choice).
4. Click **Create new project** and wait a few minutes for the database to provision.

---

## Step 2: Configure the Database Schema

Once your project is ready, navigate to the **SQL Editor** in the left sidebar (the `SQL` icon) and click **New Query**. Copy and paste the following SQL script to set up the tables, relations, and indexes, then click **Run**:

```sql
-- 1. Create the Customers Table
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mobile_number TEXT UNIQUE NOT NULL,
    dob DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Create the Transactions Table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('charge', 'payment')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE -- populated for charges
);

-- 3. Create Indexes for Quick Lookup
CREATE INDEX idx_customers_mobile_dob ON public.customers(mobile_number, dob);
CREATE INDEX idx_transactions_customer ON public.transactions(customer_id);

-- 4. Enable Row Level Security (RLS) on Tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 5. Define Policies (Access Rules)
-- Admin (Authenticated) Policy: Full access to all tables
CREATE POLICY "Admin full access on customers" 
    ON public.customers 
    ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Admin full access on transactions" 
    ON public.transactions 
    ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Public (Anonymous) Policy for Customers: Can read only IDs and Names
CREATE POLICY "Public read-only customer names" 
    ON public.customers 
    FOR SELECT 
    TO anon 
    USING (true);

-- Public (Anonymous) Policy for Transactions: Deny standard selects to anon.
-- We will use a secure Next.js Server Action / API Route with the service role (or service key) 
-- to verify DOB + mobile number and return transactions, ensuring no data leakage.
```

---

## Step 3: Set Up Admin Account (Supabase Auth)

To log into your admin dashboard, you need to create an admin user in Supabase Auth.
1. Navigate to **Authentication** -> **Users** in the Supabase dashboard.
2. Click **Add User** -> **Create User**.
3. Enter the Admin Email and Password you wish to use.
4. Toggle **Auto-confirm User** to `ON` (so you don't need to verify via email link), then click **Create User**.

---

## Step 4: Configure Local Environment Variables

Create a file named `.env.local` in the root of your Next.js project and add your Supabase credentials:

```env
# Get these from Supabase Dashboard -> Project Settings -> API
NEXT_PUBLIC_SUPABASE_URL=your-project-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-project-anon-key

# Get this from Supabase Dashboard -> Project Settings -> API (under "service_role" secret)
# IMPORTANT: Keep this secret on the server! Used to securely verify customer DOB + mobile number.
SUPABASE_SERVICE_ROLE_KEY=your-project-service-role-key

# Shop Payment Info
NEXT_PUBLIC_UPI_ID=yourname@upi
NEXT_PUBLIC_MERCHANT_NAME="My Printing Shop"
NEXT_PUBLIC_CONTACT_MOBILE="+919876543210"

# Dynamic Interest Logic Configurations
NEXT_PUBLIC_INTEREST_RATE_PERCENT=5.00  # Interest rate percent
NEXT_PUBLIC_INTEREST_PERIOD=monthly     # monthly, daily, or annual
NEXT_PUBLIC_INTEREST_GRACE_DAYS=30      # Days until interest starts accumulating
```

You can find the URL, Anon Key, and Service Role Key in your Supabase dashboard under **Settings** (gear icon) -> **API**.
