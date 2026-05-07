CREATE TABLE IF NOT EXISTS setup_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Seed with current auth key
INSERT INTO setup_config (key, value) VALUES 
  ('tailscale_auth_key', 'tskey-auth-kF7Kvb6UBd11CNTRL-MJNQtLmxLAfWuXbG2ZEeAfZkPJCKteu61'),
  ('tailscale_download_url', 'https://tailscale.com/download/windows'),
  ('scrappy_server_ip', '100.82.234.106');

-- Disable RLS
ALTER TABLE setup_config DISABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON setup_config TO anon, authenticated, service_role;