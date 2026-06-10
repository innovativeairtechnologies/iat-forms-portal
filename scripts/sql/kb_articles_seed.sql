-- ─────────────────────────────────────────────────────────────────────────────
-- kb_articles_seed.sql  (OPTIONAL starter content)
--
-- Run this in the Supabase SQL editor AFTER 005_kb_articles.sql if you want a few
-- placeholder Knowledge Base articles to test ticket→article matching on the
-- status page. EDIT the bodies with real IAT guidance before relying on them —
-- these are skeletons aligned to the KB categories shown on /support.
--
-- Idempotent: re-running updates the existing rows (matched by slug).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO kb_articles (title, slug, excerpt, body, category, tags, sort_order) VALUES
(
  'Cooling System Diagnostics (DX & Chilled Water)',
  'cooling-system-diagnostics',
  'How to check pre/post cooling operation, common DX and chilled-water faults, and what to inspect first.',
  E'## Cooling System Diagnostics\n\n_Replace this with real IAT guidance._\n\n- Confirm the cooling unit has power and is calling for cooling.\n- For DX systems, check refrigerant pressures and the compressor.\n- For chilled-water systems, verify supply temperature and flow.\n',
  'Cooling',
  ARRAY['cooling','dx','chilled','water','diagnostics','pre','post','refrigerant','compressor'],
  1
),
(
  'Airflow Balancing: Process & React',
  'airflow-balancing',
  'Why unbalanced airflows cause system faults, and how process/react CFM should be set.',
  E'## Airflow Balancing\n\n_Replace this with real IAT guidance._\n\nUnbalanced process and react airflows are one of the most common causes of full system malfunction. Measure CFM on both sides and adjust dampers until balanced.\n',
  'Airflow',
  ARRAY['airflow','balancing','balance','cfm','damper','process','react'],
  2
),
(
  'Temperature Control & Setpoint Calibration',
  'temperature-control-setpoint',
  'Maintaining the 285°F react-heat setpoint, PID tuning basics, and temperature troubleshooting.',
  E'## Temperature Control\n\n_Replace this with real IAT guidance._\n\nThe react heat zone typically maintains a 285°F setpoint. If temperature drifts, check the heater elements, sensors, and PID parameters.\n',
  'Temperature',
  ARRAY['temperature','setpoint','react','heat','heater','calibration','pid','285'],
  3
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  body = EXCLUDED.body,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
