DROP POLICY IF EXISTS "Anyone can view incidents" ON public.traffic_incidents;

CREATE POLICY "Anyone can view incidents"
  ON public.traffic_incidents FOR SELECT
  TO anon, authenticated
  USING (true);
