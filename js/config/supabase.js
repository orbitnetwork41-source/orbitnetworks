// Supabase Configuration
export const supabaseConfig = {
    url: 'https://ozyuyawnmwhkmzckxpgu.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96eXV5YXdubXdoa216Y2t4cGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjY3OTcsImV4cCI6MjA5NzU0Mjc5N30.q8BGDXNfR17wq9_g5feqqDmjLeBd4cPl2lP6D34n50g'
};

// Import Supabase
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

// Database Tables (Run in Supabase SQL Editor)
export const SCHEMA = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    package_id UUID,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Packages
CREATE TABLE packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    speed TEXT,
    validity_days INTEGER NOT NULL,
    features JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    amount DECIMAL(10,2) NOT NULL,
    method TEXT CHECK (method IN ('mpesa', 'cash', 'bank')),
    status TEXT DEFAULT 'pending',
    reference TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Routers
CREATE TABLE routers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    status TEXT DEFAULT 'online',
    location TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE routers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read" ON customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON customers FOR UPDATE USING (auth.role() = 'authenticated');
`;
