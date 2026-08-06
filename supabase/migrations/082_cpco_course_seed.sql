-- ─────────────────────────────────────────────────────────────────────────────
-- 082_cpco_course_seed.sql — Control Panel Crash Course (c.pCO / pGD)
--
-- The interactive course Sales asked for: not a digital textbook, a panel you
-- drive. Lesson bodies embed the simulator, the alarm lab and the point
-- explorer via interactive markers (see lib/learn-interactive.ts):
--
--     <div data-interactive="cpco-sim" data-scenario="bacnet-instance"></div>
--
-- The markers survive the admin editor because of the InteractiveBlock TipTap
-- node — verified by the round-trip harness before this seed was written.
--
-- Sources of truth for every fact in the bodies:
--   • CAREL c.pCO sistema manual +0300057EN rel 1.4 (platform, system menu,
--     web server, tERA, pLAN)
--   • IAT "How to setup the BACnet instance" (the keystroke procedure the
--     graded scenario reproduces)
--   • BACnet_Documentation.xls (the 38-object point list in lib/cpco/points.ts)
--
-- A seed migration, not an authored-in-UI subject, because creating categories
-- and modules still has no admin UI (docs/learn.md "Not built yet" §4). Same
-- idempotent ON CONFLICT shape as 015*.
--
-- Lessons that need the SOO or the screen-capture pass DO NOT EXIST YET —
-- they'll be added as lessons when the material lands, so nothing here is a
-- stub and nothing published teaches a guess. import_status='partial' records
-- that the module knowingly awaits more content.
--
-- Apply via Supabase CLI (npx supabase db push) — run `migration repair` first
-- if the CLI claims 059–063 are pending; they are live.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Module ───────────────────────────────────────────────────────────────────
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id,
       'Control Panel Crash Course',
       'control-panel-crash-course',
       'Drive the c.pCO control panel on our units — a working simulator of the pGD display, graded hands-on tasks like putting a unit on BACnet, the alarm system, and the integration answers customers actually ask for.',
       14, TRUE, NULL, 'partial'
FROM learn_categories c WHERE c.slug = 'technical-training'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ── Lessons ──────────────────────────────────────────────────────────────────

-- 1 · Meet the panel
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Meet the panel', 'meet-the-panel', '<h2>What is actually in the door</h2>
<p>Every unit we ship is run by a <strong>CAREL c.pCO</strong> — a programmable controller that carries our own application. The screen-and-buttons part you see on the door is the <strong>pGD terminal</strong>: a 132×64 pixel display with six backlit buttons. Everything an operator, an integrator, or a service tech does at the panel happens through those six buttons.</p>
<h3>The six buttons</h3>
<ul>
<li><strong>Alarm</strong> — shows the active alarm list. Also part of the service handshake you''ll meet later.</li>
<li><strong>Prg</strong> — opens the menus from the main screen.</li>
<li><strong>Esc</strong> — back up one level. It never changes a value.</li>
<li><strong>Up / Down</strong> — move through a list, or change the value under the cursor.</li>
<li><strong>Enter</strong> — go in, or move the cursor to the <em>next</em> field.</li>
</ul>
<p>That last one is the thing nobody expects: <strong>Enter is not "OK"</strong>. On a settings screen it walks the cursor from field to field, and on a multi-digit number it walks one digit at a time. You''ll feel it in the next lesson — it takes about a minute to internalise and then the whole panel makes sense.</p>
<h3>Why sales should care at all</h3>
<p>Because the panel is where three recurring customer conversations end up: <em>"can our building system control it?"</em>, <em>"why is it in alarm?"</em>, and <em>"can you look at it remotely?"</em>. This course gives you the answers — and the muscle memory to be credible on all three.</p>', 0, TRUE, 4
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- 2 · Driving the pGD (free play)
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Driving the pGD', 'driving-the-pgd', '<h2>Learn the grammar, not the map</h2>
<p>Below is a working copy of the panel. Same screens, same button behaviour, same quirks. Click it (or tab to it) and your keyboard works too: arrows, Enter, Esc, <strong>P</strong> for Prg, <strong>A</strong> for Alarm.</p>
<p>Try this walk, and pay attention to what Enter does on the login screen:</p>
<ul>
<li>Press <strong>Prg</strong>. The login appears with the cursor already sitting on the first password digit.</li>
<li>Press <strong>Enter</strong> four times — the cursor walks digit by digit, then the Main Menu opens. (In the simulator any password works. On a real panel, it doesn''t — ask your manager for the level you need.)</li>
<li>Arrow down to <strong>F. Settings</strong> and press Enter.</li>
<li>Wander. <strong>Esc</strong> always brings you back up a level, and it never changes anything.</li>
</ul>
<div data-interactive="cpco-sim"></div>
<p>Two more things you just used without noticing: on a list, the highlighted row stays centred as you scroll — the <strong>1/7</strong> counter top-right tells you where you are; and on a settings screen the cursor starts <em>above</em> the first field, so your first Enter puts it on the first field rather than into it.</p>', 1, TRUE, 6
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- 3 · Graded: read a setting off the panel
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Find the answer on the panel', 'find-the-answer-on-the-panel', '<h2>Your first real task</h2>
<p>Most panel work in sales is <em>reading</em>, not changing: a customer''s integrator wants a value and you''re the one standing in front of the unit. The task below is graded on whether you actually found the screen — take as many presses as you need, and use the hints if you stall.</p>
<div data-interactive="cpco-sim" data-scenario="find-device-instance"></div>
<p>Worth remembering: reading a value is the same walk as setting one. You just never press Up or Down while you''re there.</p>', 2, TRUE, 5
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- 4 · Graded: put the unit on BACnet
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Put a unit on BACnet', 'put-a-unit-on-bacnet', '<h2>The integration call, done with your own hands</h2>
<p><strong>BACnet</strong> is the protocol most building management systems speak. Three facts to carry into any BACnet conversation:</p>
<ul>
<li>BACnet on the c.pCO needs a <strong>separately purchased CAREL licence</strong> — it is not on by default. Catch this at ordering time, not at commissioning.</li>
<li>It runs on <strong>one port at a time</strong>: serial (MS/TP) or Ethernet (BACnet/IP), never both at once. Ask the integrator which they want, early.</li>
<li>The <strong>device instance</strong> is the unit''s address on the customer''s whole BACnet network. It must be unique network-wide, which is why it is <em>their integrator''s number to give us</em> — never one we invent.</li>
</ul>
<p>Now do the setup exactly the way our field procedure does it — enable the protocol on the BMS2 port, take the reboot, then set the device instance:</p>
<div data-interactive="cpco-sim" data-scenario="bacnet-instance"></div>
<p>Notice the reboot: the protocol change is <strong>not live until the controller restarts</strong>. If a BAS can''t see the unit and everything looks configured, "was it rebooted after the change?" is your first question.</p>', 3, TRUE, 8
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- 5 · The point list
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'What the building system can see — and touch', 'the-point-list', '<h2>The point list is the contract</h2>
<p>When a customer integrates one of our units, we hand their controls contractor a <strong>point list</strong>: every value the unit exposes over BACnet, with its object type and instance number. Below is a real one — 38 objects from a desiccant unit. Explore it; click any row.</p>
<p>The question that decides the sales conversation is <strong>read-only versus writable</strong>. Their BAS can <em>watch</em> everything — every sensor, every alarm — but it can <em>command</em> exactly six things: start/stop, and five setpoints. Filter the list to "writable only" and look at how short it is. That is by design: the unit protects its own sequence of operation, and their system supervises rather than drives.</p>
<div data-interactive="cpco-points"></div>
<p>Three practical notes:</p>
<ul>
<li><strong>No units on the wire.</strong> Every object is exported unitless — the integrator''s graphics won''t say °F unless they''re told. Tell them: temperatures are °F, pressures are inches of water column.</li>
<li><strong>Instance numbers are per-job.</strong> The pattern holds across units; the numbers can move with what''s installed. Always send the list for <em>their</em> job.</li>
<li><strong>The flagged rows are real.</strong> A few labels in the current export are wrong (marked ⚠ above, already with engineering). If a customer''s BAS shows "Pre Cooling" where post-cool should be, you know exactly what they''re looking at — and that the data itself is fine.</li>
</ul>', 4, TRUE, 7
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- 6 · Alarms
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Break the unit', 'break-the-unit', '<h2>One machine, two windows</h2>
<p>The unit reports seventeen alarms — fans, the desiccant wheel, every sensor, reactivation overtemperature, the burner. Each one surfaces in two places <em>at the same time</em>: on the panel''s alarm list, and as a BACnet point the customer''s building system watches.</p>
<p>Use the rig below to break things on purpose. Toggle a fault on the airflow strip and watch both windows react:</p>
<div data-interactive="cpco-alarm-lab"></div>
<p>The one to remember is <strong>BI 0, Summary Alarm</strong> — it flips when <em>anything</em> is wrong, and it''s often the only alarm point an integrator bothers to map. So the phone call usually starts as "your unit is in alarm" with no detail, and your first question is: <em>"what does the panel say?"</em> — press the Alarm button, read the list. If their BAS mapped the individual points instead, their own graphics can answer that question without the call.</p>
<p>Also worth knowing: <strong>React Overtemp trips at 320&nbsp;°F</strong> on the reactivation side. It''s the alarm that protects the wheel, and the one a customer running process changes is most likely to meet.</p>', 5, TRUE, 6
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- 7 · Remote access
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Look at it without a truck roll', 'remote-access', '<h2>Three remote stories, all true</h2>
<p>"Can you look at it remotely?" — yes, three ways, and knowing which is which makes the answer sound like engineering rather than marketing.</p>
<h3>1. The built-in web server</h3>
<p>The controller has a web server on board. On the customer''s local network, a browser opens a <strong>virtual pGD</strong> — a live mirror of the exact screen on the door, plus variable tables and trend graphs from the on-board datalogger, exportable as CSV. Nothing to install; their facilities team can watch the unit from a desk.</p>
<h3>2. tERA cloud</h3>
<p>For access from <em>outside</em> the building, the controller connects out to CAREL''s <strong>tERA</strong> cloud service over an encrypted connection — no inbound holes in the customer''s firewall, which is the sentence their IT department needs to hear. Through it we can see alarms, trend data, and even update software. Registration uses the controller''s MAC address and unique ID, both readable off the panel (you''ll find them yourself in the next lesson).</p>
<h3>3. Their BAS</h3>
<p>Everything from the point-list lesson — their own building system watching the unit over BACnet is remote monitoring too, and for many customers it''s the only kind they want.</p>
<p>The honest caveat that keeps us credible: the web server needs a network drop to the unit, and tERA needs outbound internet plus the service set up. Neither is magic; both are a line on the order, not a surprise at startup.</p>', 6, TRUE, 5
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- 8 · Graded: the system menu
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'The controller under the hood', 'the-controller-under-the-hood', '<h2>Two menu systems, one panel</h2>
<p>Everything so far lived in <em>our</em> application''s menus. Underneath it is the controller''s own operating system, with its own menu — reached by holding <strong>Alarm and Enter together for three seconds</strong>, from anywhere, on any c.pCO ever shipped. Service techs live in here; sales needs it for exactly one job:</p>
<div data-interactive="cpco-sim" data-scenario="mac-for-tera"></div>
<p>That INFORMATION screen is also where the controller''s firmware versions live — the first thing CAREL or our own engineering will ask for when something deep misbehaves. One screen, three answers: MAC for tERA registration, UID, firmware versions for support.</p>', 7, TRUE, 5
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- 9 · Graded: pLAN addressing (service)
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Service: two controllers, one network', 'service-plan-addressing', '<h2>pLAN — the controllers'' own network</h2>
<p>Multiple c.pCO controllers (and their displays) share a local network called <strong>pLAN</strong>. Up to 32 devices, each needing a unique address — and a shared display can supervise several controllers. The classic field failure is two devices at the same address: both go quiet, and the fix is thirty seconds at the panel <em>if</em> you know where the setting lives.</p>
<div data-interactive="cpco-sim" data-scenario="plan-address"></div>
<p>Note the second goal: the address isn''t applied until <strong>Update config</strong> is confirmed. Setting the number and walking away is the mistake the confirmation exists to catch. There''s also a hardware route — a recessed button next to the seven-segment address display on the controller board itself — for when there''s no working display attached.</p>', 8, TRUE, 5
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- 10 · Graded: static IP (service)
INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Service: give it a fixed address', 'service-static-ip', '<h2>DHCP is for the bench, not the building</h2>
<p>From the factory the controller asks the network for an address (<strong>DHCP</strong>). Fine on a bench; on a live site it means the address can change when the lease does — and then BACnet/IP mappings and web-server bookmarks quietly break. Customer IT will ask for a fixed address; here''s the switch:</p>
<div data-interactive="cpco-sim" data-scenario="static-ip"></div>
<p>Same lesson as pLAN: <strong>Update config</strong> is what applies it. On a real site the actual IP, mask and gateway come from the customer''s IT — our job is knowing where they go.</p>', 9, TRUE, 4
FROM learn_modules m WHERE m.slug = 'control-panel-crash-course'
ON CONFLICT (module_id, slug) DO NOTHING;

-- ── Verify (run after applying) ──────────────────────────────────────────────
--   SELECT l.display_order, l.title, l.is_published
--     FROM learn_lessons l JOIN learn_modules m ON m.id = l.module_id
--    WHERE m.slug = 'control-panel-crash-course' ORDER BY l.display_order;
--     -- expect 10 rows, all published
--   SELECT COUNT(*) FROM learn_lessons l JOIN learn_modules m ON m.id = l.module_id
--    WHERE m.slug = 'control-panel-crash-course' AND l.content LIKE '%data-interactive%';
--     -- expect 8 — every lesson except "Meet the panel" and "Look at it
--     -- without a truck roll" embeds an exercise
