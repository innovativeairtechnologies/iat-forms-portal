-- Add brand column to tickets so US Rotors tickets are distinguishable
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'iat'
    CHECK (brand IN ('iat', 'us_rotors'));

-- C-Series order submissions for US Rotors
CREATE TABLE IF NOT EXISTS public.us_rotors_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref       text NOT NULL,
  company         text NOT NULL,
  po_number       text,
  contact_name    text NOT NULL,
  contact_email   text NOT NULL,
  model           text NOT NULL,
  quantity        integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rph             text,
  hz              text,
  sprocket        text,
  motor_voltage   text NOT NULL DEFAULT '120/1/60',
  config          text NOT NULL DEFAULT 'A',
  notes           text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'shipped', 'complete')),
  submitted_by    uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.us_rotors_orders ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admins_all_us_rotors_orders"
  ON public.us_rotors_orders FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees WHERE id = auth.uid() AND is_admin = true
  ));

-- Any authenticated employee can insert their own orders
CREATE POLICY "employees_insert_us_rotors_orders"
  ON public.us_rotors_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

-- Employees can read their own orders
CREATE POLICY "employees_read_own_us_rotors_orders"
  ON public.us_rotors_orders FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE INDEX IF NOT EXISTS us_rotors_orders_status_idx     ON public.us_rotors_orders (status);
CREATE INDEX IF NOT EXISTS us_rotors_orders_created_at_idx ON public.us_rotors_orders (created_at DESC);
