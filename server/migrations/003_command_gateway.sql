CREATE TABLE IF NOT EXISTS public.player_commands (
  id BIGSERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command_id UUID NOT NULL,
  command_type TEXT NOT NULL,
  expected_revision BIGINT NOT NULL,
  resulting_revision BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_commands_player_command
  ON public.player_commands (player_id, command_id);

CREATE INDEX IF NOT EXISTS idx_player_commands_player_created
  ON public.player_commands (player_id, created_at DESC);

ALTER TABLE public.player_commands ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'player_commands'
      AND policyname = 'Users read own commands'
  ) THEN
    CREATE POLICY "Users read own commands" ON public.player_commands
      FOR SELECT USING (auth.uid() = player_id);
  END IF;
END
$$;
