import { createClient } from '@supabase/supabase-js';

// Your Supabase credentials
export const supabaseConfig = {
    url: 'https://ozyuyawnmwhkmzckxpgu.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96eXV5YXdubXdoa216Y2t4cGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjY3OTcsImV4cCI6MjA5NzU0Mjc5N30.q8BGDXNfR17wq9_g5feqqDmjLeBd4cPl2lP6D34n50g'
};

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

// Database Schema (Run in Supabase SQL Editor)
export const SCHEMA = `
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'super_admin')),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Customers (extends profiles for customer-specific data)
CREATE TABLE public.customers (
    id UUID PRIMARY KEY REFERENCES public.profiles(id),
    package_id UUID,
    data_used_gb DECIMAL(10,2) DEFAULT 0,
    data_limit_gb DECIMAL(10,2) DEFAULT 50,
    wallet_balance DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Packages
CREATE TABLE public.packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    speed TEXT NOT NULL,
    data_limit_gb DECIMAL(10,2),
    validity_days INTEGER NOT NULL,
    features JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id),
    amount DECIMAL(10,2) NOT NULL,
    method TEXT CHECK (method IN ('mpesa', 'cash', 'bank', 'card')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    reference TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Routers
CREATE TABLE public.routers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    model TEXT,
    location TEXT,
    status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance')),
    api_username TEXT,
    api_password TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Router Sessions (for real-time monitoring)
CREATE TABLE public.router_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    router_id UUID REFERENCES public.routers(id),
    customer_id UUID REFERENCES public.customers(id),
    session_id TEXT,
    ip_address TEXT,
    mac_address TEXT,
    data_used_gb DECIMAL(10,2) DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired'))
);

-- Support Tickets
CREATE TABLE public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ticket Replies
CREATE TABLE public.ticket_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES public.support_tickets(id),
    author_id UUID REFERENCES public.profiles(id),
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs (for admin)
CREATE TABLE public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policies
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.router_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies for customers
CREATE POLICY "Customers can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Customers can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Customers can view own customer data" ON public.customers
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Customers can view packages" ON public.packages
    FOR SELECT USING (TRUE);

CREATE POLICY "Customers can view own payments" ON public.payments
    FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can view own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Policies for admins
CREATE POLICY "Admins can do everything" ON public.profiles
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Admins can do everything" ON public.customers
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Admins can do everything" ON public.packages
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Admins can do everything" ON public.payments
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Admins can do everything" ON public.routers
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Admins can do everything" ON public.router_sessions
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Admins can do everything" ON public.support_tickets
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Admins can do everything" ON public.ticket_replies
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Admins can do everything" ON public.activity_logs
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

-- Functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create customer record when profile is created
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'customer' THEN
        INSERT INTO public.customers (id)
        VALUES (NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION handle_new_profile();
`;
