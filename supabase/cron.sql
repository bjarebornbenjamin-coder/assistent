-- Kör efter att appen är deployad. Anropar /api/push-dispatch varje minut.
-- Byt DIN-APP och DIN_CRON_SECRET (samma värde som miljövariabeln CRON_SECRET i Vercel).
-- Kräver extensions pg_cron och pg_net (Database → Extensions i Supabase).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'dispatch-push',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://DIN-APP.vercel.app/api/push-dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer DIN_CRON_SECRET', 'Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
  $$
);

-- Avbryt senare med: select cron.unschedule('dispatch-push');
