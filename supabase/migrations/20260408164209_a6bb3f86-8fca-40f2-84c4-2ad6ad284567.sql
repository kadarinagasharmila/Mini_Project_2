-- Create traffic incidents table
CREATE TABLE public.traffic_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '2 hours')
);

-- Enable RLS
ALTER TABLE public.traffic_incidents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all incidents
CREATE POLICY "Anyone can view incidents"
  ON public.traffic_incidents FOR SELECT
  TO authenticated
  USING (true);

-- Users can create incidents
CREATE POLICY "Users can create incidents"
  ON public.traffic_incidents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own incidents
CREATE POLICY "Users can delete their own incidents"
  ON public.traffic_incidents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.traffic_incidents;