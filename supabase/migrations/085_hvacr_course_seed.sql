-- ─────────────────────────────────────────────────────────────────────────────
-- 085_hvacr_course_seed.sql — Refrigeration & HVAC/R Technician Training
--
-- GENERATED FILE. Do not hand-edit — run:
--     node scripts/gen-hvacr-course.mjs
-- Source data: scripts/hvacr-course/{modules,quick,branch}.json
--
-- A full technician course: 17 subjects, 155 lessons, covering refrigeration
-- theory, components, electrical, psychrometrics, installation, troubleshooting
-- and EPA 608. Lesson bodies embed interactive markers
-- (see lib/learn-interactive.ts) that the registry in
-- components/learn/InteractiveBlockView.tsx renders as real components —
-- rotatable 3D models, labelled diagrams, and branching service calls.
--
-- Seeded rather than authored in the UI because creating categories and
-- subjects still has no admin write path (docs/learn.md "Not built yet" §4).
-- Idempotent ON CONFLICT shape, same as 015* and 082.
--
-- Quizzes are 086 — one per subject plus a category capstone.
--
-- Apply via Supabase CLI (npx supabase db push) — run `migration repair` first
-- if the CLI claims 059–063 are pending; they are live.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Category ─────────────────────────────────────────────────────────────────
INSERT INTO learn_categories (name, slug, description, icon, accent, display_order)
VALUES (
  'Refrigeration & HVAC/R',
  'refrigeration-hvacr',
  'Refrigeration and HVAC/R technician training — theory, components, electrical, psychrometrics, installation, troubleshooting, and the codes and certifications the trade runs on.',
  'Snowflake',
  NULL,
  5
)
ON CONFLICT (slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Safety Fundamentals
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Safety Fundamentals', 'safety-fundamentals',
       'Identify and select appropriate PPE for refrigeration, electrical, and brazing tasks.',
       1, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Safety Fundamentals takes about <strong>32 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Identify and select appropriate PPE for refrigeration, electrical, and brazing tasks</li><li>Apply lockout/tagout (LOTO) procedures correctly before servicing equipment</li><li>Explain electrical safety practices including arc flash awareness and PPE categories</li><li>Describe refrigerant hazards including asphyxiation, frostbite, and ASHRAE flammability/toxicity classifications</li><li>Apply special handling precautions required for mildly flammable A2L refrigerants</li><li>Explain safe storage, transport, and handling rules for refrigerant cylinders and pressure vessels</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-ppe-matcher"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'safety-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Personal Protective Equipment (PPE)', 'personal-protective-equipment-ppe', '<h3>At a glance</h3>
<ul><li>Goggles or face shield required when opening lines or charging.</li><li>Insulated gloves prevent frostbite from liquid refrigerant contact.</li><li>Hearing protection required above 85 dBA near compressors.</li><li>PPE is the last line of defense, not the first.</li></ul>
<h3>The full picture</h3>
<p>Every HVAC/R technician must treat PPE as a baseline requirement, not an optional convenience. Refrigerant handling, brazing, and electrical work each carry distinct hazards, and PPE selection should match the specific task being performed.</p><ul><li><strong>Safety goggles or a full face shield</strong> are mandatory anytime refrigerant lines are opened, gauges are connected, or a system is charged. Liquid refrigerant contacting the eye can cause severe freeze burns and permanent damage in seconds.</li><li><strong>Insulated, cold-resistant gloves</strong> (not leather work gloves alone) protect against frostbite when handling liquid refrigerant, cylinders, or cold suction lines. A second layer of loose-fitting gloves allows quick removal if refrigerant gets inside the glove.</li><li><strong>Hearing protection</strong> (earplugs or earmuffs) is required around compressors, condenser fans, and rooftop units where sustained noise exceeds 85 dBA, the OSHA action level for hearing conservation.</li><li><strong>Flame-resistant clothing and welding gloves</strong> are required for brazing and soldering, along with safety glasses rated for the task (tinted lenses for oxy-fuel torches).</li><li><strong>Steel-toe boots and hard hats</strong> are standard on commercial/industrial job sites and rooftop work.</li></ul><p>PPE is the last line of defense, not the first. Engineering controls (ventilation, guards) and administrative controls (procedures, training) should always be applied first, with PPE covering residual risk.</p>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'safety-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Lockout/Tagout (LOTO) and Electrical Safety', 'lockout-tagout-loto-and-electrical-safety', '<h3>At a glance</h3>
<ul><li>Isolate energy sources, lock and tag, then verify zero energy.</li><li>Only the technician who applied a lock removes it.</li><li>Test meter live-dead-live before and after touching a circuit.</li><li>De-energize equipment rather than work live to avoid arc flash.</li></ul>
<h3>The full picture</h3>
<p>Lockout/Tagout (LOTO) is a formal procedure that ensures energy sources are isolated and cannot be re-energized while a technician is working on equipment. The basic sequence is: (1) notify affected personnel, (2) identify all energy sources (electrical, mechanical, pneumatic, hydraulic, stored/residual), (3) shut down the equipment through normal procedure, (4) isolate the energy source (open the disconnect), (5) apply a lock and tag to the isolation point, (6) release any stored energy (capacitors, springs, pressurized lines), and (7) verify zero energy state with a meter before beginning work.</p><p>Only the person who applied the lock should remove it. On multi-technician jobs, each worker applies their own lock so no one can re-energize the circuit while someone else is still exposed.</p><p><strong>Electrical safety basics:</strong> Always assume a circuit is live until you have personally verified it is de-energized with a properly rated meter, tested on a known live source before and after the check ("test before you touch, test after you touch"). Never work on a live panel unless absolutely necessary and only with proper training and arc-rated PPE.</p><p><strong>Arc flash</strong> is a dangerous release of energy caused by an electrical fault through air, producing intense heat, light, and pressure waves capable of causing severe burns even without direct contact. Arc flash risk increases with higher voltage/fault current and closer proximity to the source. NFPA 70E defines PPE categories (0 through 4) based on incident energy exposure, ranging from basic flame-resistant clothing at Category 1 to full arc-flash suits with hoods at Category 4. Field technicians should always de-energize and lock out equipment rather than work it live, which eliminates arc flash risk entirely rather than merely managing it with PPE.</p>', 2, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'safety-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Refrigerant Hazards: Asphyxiation, Frostbite, and Safety Classifications', 'refrigerant-hazards-asphyxiation-frostbite-and-safety-classi', '<h3>At a glance</h3>
<ul><li>Leaks displace oxygen, risking asphyxiation in confined spaces.</li><li>Liquid refrigerant causes near-instant frostbite on skin contact.</li><li>ASHRAE 34 rates toxicity (A/B) and flammability (1, 2L, 2, 3).</li><li>A1 is nonflammable, A2L mildly flammable, A3 highly flammable.</li></ul>
<h3>The full picture</h3>
<p>Refrigerants are generally not acutely toxic in small amounts, but they displace oxygen. In a confined space such as a walk-in cooler, mechanical room, or crawlspace, a refrigerant leak can lower the oxygen concentration below the 19.5% threshold needed to sustain consciousness, causing <strong>asphyxiation</strong> with little to no warning odor. Technicians should use a refrigerant leak detector and, where required, an oxygen monitor before entering enclosed mechanical spaces after a suspected leak, and should ventilate the area first.</p><p>Liquid refrigerant boils at very low temperatures at atmospheric pressure (for example, R-410A boils around -61°F). Contact with skin causes near-instant <strong>frostbite</strong>, and contact with eyes can cause permanent damage. Never allow liquid refrigerant to contact skin; always open valves slowly and point hose ends away from your body when purging or connecting gauges.</p><p>ASHRAE Standard 34 assigns every refrigerant a safety classification combining two independent hazard ratings:</p><ul><li><strong>Toxicity:</strong> Class A (lower toxicity, no identified adverse health effects at concentrations below 400 ppm) or Class B (higher toxicity, effects observed below 400 ppm).</li><li><strong>Flammability:</strong> Class 1 (no flame propagation), Class 2L (lower flammability, low burning velocity under 10 cm/s), Class 2 (flammable), and Class 3 (highly flammable, low heat of combustion limit and low lower flammability limit).</li></ul><p>Common combined ratings include A1 (nonflammable, lower toxicity, e.g. R-410A, R-134a), A2L (mildly flammable, lower toxicity, e.g. R-32, R-454B, R-1234yf), A2 (flammable, e.g. some HFOs), A3 (highly flammable, e.g. hydrocarbons like R-290 propane), and B1/B2L (higher toxicity variants such as ammonia, R-717, which is B2L).</p>', 3, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'safety-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'A2L Mildly Flammable Refrigerants: New Precautions', 'a2l-mildly-flammable-refrigerants-new-precautions', '<h3>At a glance</h3>
<ul><li>A2Ls (R-32, R-454B) are now standard but mildly flammable.</li><li>Use combustible-gas-rated leak detectors and ventilate before brazing.</li><li>Eliminate ignition sources; de-energize equipment near suspected leaks.</li><li>Use only A2L-listed recovery tools; never exceed nameplate charge.</li></ul>
<h3>The full picture</h3>
<p>Because the industry is transitioning away from high-GWP HFCs, A2L refrigerants (R-32, R-454B, R-1234yf, R-455A, and others) are now standard in much new residential and light commercial equipment. A2L refrigerants have a low burning velocity and require a fairly specific fuel-air mixture and ignition source to ignite, making them much safer than A2 or A3 refrigerants, but they are not nonflammable, and technicians must adjust their habits accordingly.</p><ul><li><strong>Leak detection:</strong> Always use a combustible-gas-rated refrigerant leak detector when servicing A2L systems, and ventilate the work area before and during brazing or soldering operations.</li><li><strong>Ignition sources:</strong> Eliminate open flames, sparks, and hot surfaces in the vicinity of a suspected or confirmed A2L leak. This includes verifying equipment is de-energized so arcing contactors or relays cannot serve as an ignition source.</li><li><strong>Recovery and service equipment:</strong> Use only recovery machines, gauges, and hoses that are listed/rated for A2L refrigerants. A2L-rated tools are designed to limit ignition risk and often include spark-free components.</li><li><strong>Equipment design:</strong> New A2L equipment includes factory leak-detection sensors and, in some designs, mitigation fans that activate automatically if a leak is detected. Never disable or bypass these safety systems.</li><li><strong>Charge limits:</strong> Codes (UL 60335-2-40, ASHRAE 15) set maximum allowable refrigerant charge based on room size and application to keep concentration below the flammability threshold; do not exceed nameplate charge.</li></ul>', 4, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'safety-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Cylinder and Pressure Vessel Safety', 'cylinder-and-pressure-vessel-safety', '<h3>At a glance</h3>
<ul><li>Never heat a sealed cylinder with a torch or open flame.</li><li>Fill by weight only; max fill leaves vapor expansion space.</li><li>Transport cylinders upright and secured; never in a passenger cabin.</li><li>Check hydrostatic test date; never fill an expired cylinder.</li></ul>
<h3>The full picture</h3>
<p>Refrigerant cylinders and recovery tanks are pressure vessels and must be treated with respect. Key rules:</p><ul><li><strong>Never heat a sealed cylinder</strong> with a torch, heat gun, or open flame to increase pressure or speed a charge. Pressure inside a sealed vessel rises rapidly with temperature and can cause a violent rupture. If a cylinder needs warming to aid liquid transfer, use only a warm water bath or a manufacturer-approved cylinder heating blanket, never a direct flame.</li><li><strong>Never overfill a cylinder.</strong> Refrigerant is filled by weight, not by pressure, and cylinders have a maximum permitted fill (typically 80% of internal volume) to leave vapor space for thermal expansion of the liquid.</li><li><strong>Transport cylinders secured and upright</strong> in a well-ventilated vehicle area, never in a sealed passenger cabin, with valve caps installed to protect the valve stem from impact damage.</li><li><strong>Recovery cylinders (DOT-39) are non-refillable</strong> disposable cylinders and must never be reused after they reach their rated capacity; refillable cylinders must be requalified.</li><li><strong>Check the hydrostatic test date</strong> stamped on the cylinder collar. Refillable steel refrigerant cylinders must be hydrostatically retested (typically every 5 years in the U.S., per DOT regulations) and stamped with the test date; never fill a cylinder past its test date.</li><li><strong>Store cylinders</strong> away from heat sources, direct sunlight, and ignition sources, secured against tipping, and segregated by refrigerant type to prevent cross-contamination.</li></ul>', 5, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'safety-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Brazing/Soldering Fire Safety and Confined Space Basics', 'brazing-soldering-fire-safety-and-confined-space-basics', '<h3>At a glance</h3>
<ul><li>Use a heat shield and keep an extinguisher nearby when brazing.</li><li>Purge lines with dry nitrogen to limit oxidation and combustion risk.</li><li>Never braze a system still under refrigerant pressure.</li><li>Test confined-space atmosphere for oxygen and gases before entry.</li></ul>
<h3>The full picture</h3>
<p>Brazing (using filler metal that melts above 840°F, typically with a phos-copper or silver-based rod) and soldering (below 840°F) both use open flame and are leading causes of job-site fires when technicians work inside occupied buildings, attics, or near combustible materials.</p><ul><li>Always use a <strong>fire-resistant heat shield</strong> or wet rag behind the joint when brazing near wood framing, insulation, or finished surfaces.</li><li>Keep a <strong>charged fire extinguisher</strong> within reach whenever an open flame is in use, and know the location of the nearest exit.</li><li><strong>Purge the line with dry nitrogen</strong> while brazing to prevent internal oxidation (scale) and to reduce the internal atmosphere available to support combustion of contaminants inside the tubing.</li><li>Never braze on a system that still contains refrigerant under pressure or that has not been verified as evacuated; refrigerant exposed to a torch flame can decompose into hazardous compounds including hydrofluoric acid gas and, for A2L/A2/A3 refrigerants, ignite.</li><li>After finishing, do a final visual check for smoldering material, and wait an appropriate cool-down period before leaving the work area unattended.</li></ul><p><strong>Confined spaces</strong> (crawlspaces, mechanical pits, large air handling units, walk-in coolers with sealed doors) may have limited entry/exit, poor natural ventilation, and the potential for hazardous atmospheres. Before entry: test the atmosphere for oxygen level, flammable gas, and toxic gas; ventilate as needed; and follow your employer''s confined space entry permit program, which may require an attendant stationed outside and continuous atmospheric monitoring. Under OSHA''s <strong>General Duty Clause</strong>, employers must furnish a workplace free from recognized hazards likely to cause death or serious harm, even where no specific OSHA standard exists for that hazard — this is the legal backbone that supports many refrigerant and confined-space safety practices.</p>', 6, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'safety-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of safety fundamentals you only <em>think</em> you know.</p>
<div data-interactive="hvacr-sequence" data-set="loto"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'safety-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="safety"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'safety-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Thermodynamics Fundamentals
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Thermodynamics Fundamentals', 'thermodynamics-fundamentals',
       'Convert temperatures between Fahrenheit, Celsius, Rankine, and Kelvin scales.',
       2, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Thermodynamics Fundamentals takes about <strong>34 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Convert temperatures between Fahrenheit, Celsius, Rankine, and Kelvin scales</li><li>Distinguish between heat and temperature, and between sensible and latent heat</li><li>Explain the pressure-temperature relationship for a saturated refrigerant</li><li>Calculate superheat and subcooling from given temperature and pressure data</li><li>Describe the three modes of heat transfer and apply the high-to-low temperature rule</li><li>Explain why phase change makes vapor-compression refrigeration an effective way to move heat</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-phase-particles"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'thermodynamics-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Temperature Scales and Conversions', 'temperature-scales-and-conversions', '<h3>At a glance</h3>
<ul><li>Fahrenheit and Celsius are common scales for HVAC/R work.</li><li>Rankine and Kelvin are absolute scales starting at absolute zero.</li><li>Simple formulas convert between F, C, K, and R.</li><li>Absolute temperature is needed for ideal gas law relationships.</li></ul>
<h3>The full picture</h3>
<p>HVAC/R technicians work daily with two common temperature scales, Fahrenheit (F) and Celsius (C), plus their absolute counterparts, Rankine (R) and Kelvin (K), which start at absolute zero rather than an arbitrary reference point.</p><ul><li><strong>F to C:</strong> C = (F - 32) x 5/9</li><li><strong>C to F:</strong> F = (C x 9/5) + 32</li><li><strong>C to K:</strong> K = C + 273.15</li><li><strong>F to R:</strong> R = F + 459.67</li></ul><p>Example: A supply air temperature reads 55°F. In Celsius, that is (55 - 32) x 5/9 = 23 x 5/9 = 12.8°C. Absolute scales matter in refrigeration because certain thermodynamic relationships (like the ideal gas law) require absolute temperature, and because 0°F and 0°C are not "no heat" points, they are simply reference marks on an arbitrary scale.</p>
<div data-interactive="hvacr-temp-converter"></div>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'thermodynamics-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Heat vs. Temperature; Sensible vs. Latent Heat', 'heat-vs-temperature-sensible-vs-latent-heat', '<h3>At a glance</h3>
<ul><li>Temperature measures intensity; heat measures thermal energy in transit.</li><li>Sensible heat changes temperature; latent heat changes phase only.</li><li>Melting or boiling holds temperature steady while absorbing latent heat.</li><li>Water''s high specific heat (1.0 Btu/lb·°F) suits hydronic systems.</li></ul>
<h3>The full picture</h3>
<p><strong>Temperature</strong> is a measure of the intensity of molecular motion (how hot or cold something is), while <strong>heat</strong> is a measure of thermal energy in transit from one body to another due to a temperature difference. A large tank of 100°F water and a small cup of 100°F water are the same temperature, but the tank contains far more heat energy because it has more mass.</p><p><strong>Sensible heat</strong> is heat that changes a substance''s temperature without changing its phase — you can sense the change with a thermometer. <strong>Latent heat</strong> is heat that changes a substance''s phase (solid-liquid-vapor) without changing its temperature. When ice melts to water at 32°F or water boils to steam at 212°F (at sea level), the temperature holds steady while heat is absorbed or released as latent heat of fusion or vaporization.</p><p><strong>Specific heat</strong> is the amount of heat required to raise one pound of a substance by one degree Fahrenheit (measured in Btu/lb·°F). Water has a specific heat of 1.0 Btu/lb·°F, unusually high compared to most substances, which is why water is effective for heat transfer in hydronic systems.</p>', 2, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'thermodynamics-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Phases of Matter and the Phase-Change Diagram', 'phases-of-matter-and-the-phase-change-diagram', '<h3>At a glance</h3>
<ul><li>Matter exists as solid, liquid, or vapor in refrigeration.</li><li>Phase diagram alternates sloped sensible-heat lines with flat latent-heat plateaus.</li><li>Evaporator coil mirrors this: liquid boils to vapor at constant temperature.</li><li>Vapor gains sensible heat (superheat) after fully boiling off.</li></ul>
<h3>The full picture</h3>
<p>Matter relevant to refrigeration exists in three phases: solid, liquid, and vapor (gas). A phase-change diagram plotting temperature against heat added to a substance at constant pressure shows a repeating pattern: sensible heat raises temperature along a sloped line until the substance reaches its boiling (or melting) point, then a flat, horizontal segment shows latent heat being absorbed at constant temperature as the substance changes phase completely, and then sensible heat resumes raising temperature into the next phase.</p><p>This is exactly what happens inside an evaporator coil: liquid refrigerant enters, absorbs latent heat and boils into vapor at a constant saturation temperature, and by the time it reaches the outlet it has absorbed additional sensible heat as superheated vapor.</p>', 3, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'thermodynamics-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Pressure-Temperature Relationship and Saturation', 'pressure-temperature-relationship-and-saturation', '<h3>At a glance</h3>
<ul><li>Pure substances have one saturation temperature for each pressure.</li><li>Raising pressure raises saturation temperature, and vice versa.</li><li>P-T charts let techs find boiling or condensing temperature from pressure.</li><li>Blends show a temperature glide between bubble and dew points.</li></ul>
<h3>The full picture</h3>
<p>For a pure substance (or a near-azeotropic blend that behaves like one, such as R-410A), there is a fixed relationship between pressure and the temperature at which it boils or condenses — this is the basis of the pressure-temperature (P-T) chart every technician carries. At a given pressure, there is exactly one <strong>saturation temperature</strong> at which liquid and vapor can coexist in equilibrium. Raise the pressure, and the saturation temperature rises; lower the pressure, and it falls. This is why refrigeration systems can boil refrigerant at a cold temperature in the evaporator (low pressure) and condense it at a warm temperature in the condenser (high pressure) using the same fluid.</p><p>Non-azeotropic blends have a temperature glide, meaning the bubble point (start of boiling) and dew point (end of boiling) differ at a given pressure, but the same general pressure-to-temperature principle still applies as a range rather than a single point.</p>', 4, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'thermodynamics-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Superheat and Subcooling', 'superheat-and-subcooling', '<h3>At a glance</h3>
<ul><li>Superheat is actual vapor temperature minus saturation temperature.</li><li>Measured at the evaporator outlet to confirm no liquid floodback.</li><li>Subcooling is saturation temperature minus actual liquid temperature.</li><li>Both need a pressure-derived P-T value plus a temperature probe reading.</li></ul>
<h3>The full picture</h3>
<p><strong>Superheat</strong> is the number of degrees a vapor''s actual temperature is above its saturation temperature at the measured pressure — it tells you the refrigerant has fully boiled off into vapor and is now absorbing purely sensible heat. Superheat is measured at the evaporator outlet (or compressor suction) to confirm the evaporator is not flooding liquid back to the compressor.</p><p><em>Example:</em> Suction pressure at the evaporator outlet corresponds to a saturation temperature of 40°F on the P-T chart. The measured line temperature at that same point is 52°F. Superheat = 52°F - 40°F = 12°F.</p><p><strong>Subcooling</strong> is the number of degrees a liquid''s actual temperature is below its saturation temperature at the measured pressure — it tells you the refrigerant has fully condensed into liquid and is being cooled further before reaching the metering device.</p><p><em>Example:</em> Head pressure at the condenser outlet corresponds to a saturation temperature of 110°F. The measured liquid line temperature is 100°F. Subcooling = 110°F - 100°F = 10°F.</p><p>Both measurements require two data points: a pressure reading converted to saturation temperature via the P-T chart, and an actual temperature reading taken at the same physical location with a clamp-on thermocouple.</p>', 5, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'thermodynamics-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Heat Transfer Modes and Why This Matters for Refrigeration', 'heat-transfer-modes-and-why-this-matters-for-refrigeration', '<h3>At a glance</h3>
<ul><li>Heat transfers by conduction, convection, and radiation.</li><li>Heat always flows from hot to cold without added work.</li><li>Compressors force heat to move against its natural direction.</li><li>Phase change moves large heat loads efficiently in compact equipment.</li></ul>
<h3>The full picture</h3>
<p>Heat moves by three mechanisms:</p><ul><li><strong>Conduction:</strong> heat transfer through direct contact within or between solid materials (heat moving through a copper tube wall).</li><li><strong>Convection:</strong> heat transfer via a moving fluid (air blown across a coil by a fan, or water pumped through a chiller loop).</li><li><strong>Radiation:</strong> heat transfer via electromagnetic waves with no medium required (a person feeling warmth from a hot roof surface without touching it).</li></ul><p>Heat always flows spontaneously from a higher temperature region to a lower temperature region, never the reverse, without external work being done. This is a direct expression of the second law of thermodynamics, and it is the single most important idea in refrigeration: a refrigeration system does not "create cold," it forcibly moves heat from a naturally colder space (the conditioned space) to a naturally warmer environment (outdoors), which requires mechanical work input (the compressor) precisely because heat does not want to flow that direction on its own.</p><p>Phase change is what makes this practical: because latent heat is far larger than sensible heat for a given mass of refrigerant, boiling and condensing the refrigerant absorbs and rejects large quantities of heat efficiently, using relatively small volumes of fluid, compact heat exchangers, and a compressor sized within reasonable limits.</p>', 6, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'thermodynamics-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of thermodynamics fundamentals you only <em>think</em> you know.</p>
<div data-interactive="hvacr-classify" data-set="sensible-latent"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'thermodynamics-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="thermodynamics"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'thermodynamics-fundamentals'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. The Basic Refrigeration Cycle
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'The Basic Refrigeration Cycle', 'the-basic-refrigeration-cycle',
       'Describe the four main processes of the vapor-compression refrigeration cycle in order.',
       3, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>The Basic Refrigeration Cycle takes about <strong>33 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Describe the four main processes of the vapor-compression refrigeration cycle in order</li><li>Identify the temperature, pressure, and phase of refrigerant at each of the four key points in the cycle</li><li>Distinguish between the high side and low side of a refrigeration system</li><li>Explain conceptually what a pressure-enthalpy (P-H) diagram represents</li><li>Explain why the evaporator absorbs heat while the condenser rejects heat</li><li>Relate the vapor-compression cycle to heat pump (reverse cycle) operation</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-cycle-3d"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'the-basic-refrigeration-cycle'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'The Four Main Processes', 'the-four-main-processes', '<h3>At a glance</h3>
<ul><li>Cycle has four steps: compression, condensation, metering, evaporation.</li><li>Compressor raises refrigerant''s pressure and temperature as vapor.</li><li>Condenser rejects heat, turning hot vapor into liquid.</li><li>Refrigerant runs in a closed loop, reused continuously.</li></ul>
<h3>The full picture</h3>
<p>The mechanical vapor-compression refrigeration cycle moves refrigerant continuously through four processes, each occurring in a distinct major component, in this fixed order:</p><ol><li><strong>Compression</strong> — the compressor draws in low-pressure vapor and compresses it into high-pressure, high-temperature vapor.</li><li><strong>Condensation</strong> — the high-pressure vapor flows through the condenser, rejecting heat to the outdoor air or water and changing phase from vapor to liquid.</li><li><strong>Metering/Expansion</strong> — the high-pressure liquid passes through a metering device (thermostatic expansion valve, capillary tube, or electronic expansion valve), dropping sharply in pressure and temperature.</li><li><strong>Evaporation</strong> — the low-pressure liquid flows through the evaporator, absorbing heat from the indoor air or process fluid and boiling into low-pressure vapor, which returns to the compressor to repeat the cycle.</li></ol><p>This is a closed loop: the same refrigerant charge is reused continuously, changing phase and pressure as it circulates, never consumed or replaced during normal operation.</p>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'the-basic-refrigeration-cycle'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Refrigerant State at Each of the Four Key Points', 'refrigerant-state-at-each-of-the-four-key-points', '<h3>At a glance</h3>
<ul><li>Compressor inlet: cool, low-pressure, superheated vapor.</li><li>Compressor outlet: hot, high-pressure superheated vapor.</li><li>Condenser outlet: warm, high-pressure subcooled liquid.</li><li>Evaporator inlet: cold, low-pressure liquid/vapor mixture.</li></ul>
<h3>The full picture</h3>
<p>Understanding the state of the refrigerant at each point is essential for diagnosing a system.</p><table><thead><tr><th>Point</th><th>Location</th><th>Pressure</th><th>Relative Temperature</th><th>Phase</th></tr></thead><tbody><tr><td>1</td><td>Compressor inlet (suction)</td><td>Low</td><td>Cool, slightly superheated</td><td>Vapor (superheated)</td></tr><tr><td>2</td><td>Compressor outlet / condenser inlet (discharge)</td><td>High</td><td>Hot</td><td>Vapor (superheated)</td></tr><tr><td>3</td><td>Condenser outlet / liquid line to metering device</td><td>High</td><td>Warm, slightly subcooled</td><td>Liquid (subcooled)</td></tr><tr><td>4</td><td>Metering device outlet / evaporator inlet</td><td>Low</td><td>Cold</td><td>Liquid/vapor mixture</td></tr></tbody></table><p>Between point 4 and point 1, refrigerant travels through the evaporator, absorbing heat and boiling from a liquid/vapor mixture into fully superheated vapor. Between point 1 and point 2, the compressor adds mechanical energy, raising both pressure and temperature significantly. Between point 2 and point 3, the condenser rejects heat, first removing superheat, then condensing the vapor into liquid, then subcooling the liquid slightly. Between point 3 and point 4, the metering device causes an abrupt pressure drop with no heat transfer (an essentially adiabatic throttling process), producing the cold liquid/vapor mixture that enters the evaporator.</p>', 2, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'the-basic-refrigeration-cycle'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'High Side vs. Low Side', 'high-side-vs-low-side', '<h3>At a glance</h3>
<ul><li>High side runs from compressor discharge to metering device.</li><li>Low side runs from metering device to compressor suction.</li><li>High side holds condensing pressure; low side holds evaporating pressure.</li><li>Blue gauge hose reads low side; red hose reads high side.</li></ul>
<h3>The full picture</h3>
<p>Every vapor-compression system is divided into two pressure regions separated by the compressor on one end and the metering device on the other:</p><ul><li>The <strong>high side</strong> runs from the compressor discharge through the condenser to the metering device inlet, and operates at the system''s condensing pressure.</li><li>The <strong>low side</strong> runs from the metering device outlet through the evaporator back to the compressor suction, and operates at the system''s evaporating pressure.</li></ul><p>Gauge manifolds are connected with the blue (low side) hose to the suction service port and the red (high side) hose to the discharge/liquid service port, allowing a technician to read both pressures simultaneously and diagnose whether the system is operating within normal ranges for the current refrigerant, ambient conditions, and load.</p>', 3, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'the-basic-refrigeration-cycle'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'The Pressure-Enthalpy (P-H) Diagram', 'the-pressure-enthalpy-p-h-diagram', '<h3>At a glance</h3>
<ul><li>P-H diagram plots pressure against enthalpy (heat content).</li><li>Saturation dome separates liquid, mixture, and vapor zones.</li><li>Compression rises vertically; condensation runs left at high pressure.</li><li>Evaporation runs right, showing the system''s refrigeration effect.</li></ul>
<h3>The full picture</h3>
<p>A pressure-enthalpy (P-H) diagram is a graphical tool that plots refrigerant pressure (vertical axis, often logarithmic) against enthalpy, or heat content per unit mass (horizontal axis). A curved "saturation dome" divides the chart into three regions: subcooled liquid to the left of the dome, a liquid/vapor mixture inside the dome, and superheated vapor to the right of the dome.</p><p>Plotting the four cycle processes on this diagram reveals useful patterns: compression is a nearly vertical line moving up and slightly right (pressure rises, enthalpy increases modestly due to work input); condensation is a horizontal line moving left at high pressure (enthalpy drops sharply as heat is rejected, pressure constant); expansion is a vertical line dropping straight down (enthalpy stays essentially constant across the metering device, pressure drops sharply); and evaporation is a horizontal line moving right at low pressure (enthalpy rises as heat is absorbed, pressure constant). The horizontal distance the refrigerant travels during evaporation directly represents the system''s refrigeration effect — the heat absorbed per pound of refrigerant circulated.</p>', 4, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'the-basic-refrigeration-cycle'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Why the Evaporator Absorbs Heat and the Condenser Rejects It', 'why-the-evaporator-absorbs-heat-and-the-condenser-rejects-it', '<h3>At a glance</h3>
<ul><li>Metering device drops refrigerant temperature below room temperature.</li><li>Heat flows naturally from the warm space into cold refrigerant.</li><li>Compressor raises refrigerant temperature above outdoor air temperature.</li><li>Cycle forces heat to flow "uphill," cold space to warm air.</li></ul>
<h3>The full picture</h3>
<p>The metering device drops the refrigerant''s pressure and, correspondingly, its saturation temperature, to a point below the temperature of the space or fluid being cooled. Because heat always flows from a higher to a lower temperature, heat flows from the warmer room or process air into the colder refrigerant inside the evaporator coil, boiling the liquid into vapor.</p><p>The compressor then raises the refrigerant''s pressure and saturation temperature to a point above the temperature of the outdoor air or condenser water. Because that refrigerant is now hotter than the outdoor air, heat flows from the refrigerant into the outdoor air, condensing the vapor back into liquid. The entire cycle is simply a mechanical means of forcing heat to flow "uphill" from a cold space to a warm environment, using pressure changes to control which side is warmer than its surroundings at any given moment.</p>', 5, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'the-basic-refrigeration-cycle'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Mechanical vs. Absorption Refrigeration, and Reverse-Cycle (Heat Pump) Operation', 'mechanical-vs-absorption-refrigeration-and-reverse-cycle-hea', '<h3>At a glance</h3>
<ul><li>Mechanical systems use a compressor; absorption uses heat and absorbent fluid.</li><li>Absorption appears in some chillers and RV refrigerators.</li><li>Heat pumps use the same cycle plus a reversing valve.</li><li>Reversing valve swaps evaporator and condenser roles for heating.</li></ul>
<h3>The full picture</h3>
<p><strong>Mechanical (vapor-compression) refrigeration</strong>, described above, uses an electrically or mechanically driven compressor to move refrigerant through the cycle. <strong>Absorption refrigeration</strong> instead uses a heat source (natural gas, steam, or waste heat) combined with an absorbent fluid (commonly ammonia-water or lithium bromide-water) to drive the cycle with little or no moving compressor, relying on differences in solubility and boiling point rather than mechanical compression. Absorption systems are less common in typical field service work but appear in some large commercial chillers and specialty applications (e.g., RV refrigerators).</p><p>A <strong>heat pump</strong> uses the exact same vapor-compression cycle and components as an air conditioner, but adds a reversing valve that can swap the roles of the indoor and outdoor coils. In cooling mode, the outdoor coil is the condenser and the indoor coil is the evaporator (heat rejected outside). In heating mode, the reversing valve redirects refrigerant flow so the outdoor coil becomes the evaporator (absorbing heat from outdoor air, even when cold) and the indoor coil becomes the condenser (rejecting heat into the home). This is why heat pumps are often called "reverse cycle" systems: the same hardware and thermodynamic principles apply, only the direction of refrigerant flow and the roles of the two coils are reversed.</p>', 6, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'the-basic-refrigeration-cycle'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of the basic refrigeration cycle you only <em>think</em> you know.</p>
<div data-interactive="hvacr-label" data-set="cycle"></div>
<div data-interactive="hvacr-sequence" data-set="cycle"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'the-basic-refrigeration-cycle'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="refrigeration-cycle"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'the-basic-refrigeration-cycle'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Refrigerants: Properties, Classification & Regulation
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Refrigerants: Properties, Classification & Regulation', 'refrigerants-properties-classification-and-regulation',
       'Describe the desirable properties of an effective refrigerant.',
       4, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Refrigerants: Properties, Classification & Regulation takes about <strong>36 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Describe the desirable properties of an effective refrigerant</li><li>Explain refrigerant naming and numbering conventions, including blends vs. pure substances</li><li>Apply the ASHRAE 34 safety classification grid to identify toxicity and flammability categories</li><li>Explain ozone depletion potential (ODP) and global warming potential (GWP) and their regulatory significance</li><li>Summarize the historical transition from CFCs to HCFCs to HFCs to HFOs/A2L blends</li><li>Explain the AIM Act HFC phasedown and EPA Technology Transitions rule as current regulatory drivers</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-molecule-3d"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'What Is a Refrigerant, and What Makes One Effective', 'what-is-a-refrigerant-and-what-makes-one-effective', '<h3>At a glance</h3>
<ul><li>Refrigerants absorb heat at low pressure, reject it at high pressure.</li><li>Ideal traits: high latent heat, stability, low toxicity and flammability.</li><li>Low ozone depletion and global warming impact are now critical.</li><li>No single refrigerant is ideal for every application.</li></ul>
<h3>The full picture</h3>
<p>A refrigerant is a working fluid used in a refrigeration cycle to absorb heat at low pressure/temperature (in the evaporator) and reject heat at high pressure/temperature (in the condenser) through repeated phase changes. Desirable refrigerant properties include: a high latent heat of vaporization (moves more heat per pound circulated), a suitable boiling point and pressure-temperature curve for the intended application (neither excessively high nor low operating pressures), chemical stability (does not break down or react with system materials such as oils, gaskets, and metals), low toxicity, low or no flammability, and — increasingly critical today — low environmental impact in terms of ozone depletion and global warming potential.</p><p>No single refrigerant is ideal for every application; selection always involves tradeoffs between thermodynamic performance, safety classification, cost, and environmental regulation.</p>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Refrigerant Naming and Numbering Conventions', 'refrigerant-naming-and-numbering-conventions', '<h3>At a glance</h3>
<ul><li>ASHRAE 34 numbering standardizes refrigerant identity across trade names.</li><li>R-1xx and R-2xx series name methane- and ethane-based compounds.</li><li>R-4xx are zeotropic blends; R-5xx are azeotropic blends.</li><li>R-1xxx series covers HFOs such as R-1234yf.</li></ul>
<h3>The full picture</h3>
<p>ASHRAE Standard 34 establishes a standardized numbering system so refrigerants can be identified consistently regardless of trade name.</p><ul><li><strong>Methane-series (R-1xx):</strong> a single digit refers to a methane-based molecule; for example R-22 (chlorodifluoromethane, an HCFC).</li><li><strong>Ethane-series (R-1xx to R-2xx range naming rule):</strong> refrigerants such as R-134a are ethane-based; the letter suffix (a, b, etc.) denotes a specific isomer.</li><li><strong>R-4xx series:</strong> reserved for zeotropic blends (mixtures of two or more refrigerants that do not behave as a single substance and exhibit temperature glide), such as R-410A and R-407C.</li><li><strong>R-5xx series:</strong> reserved for azeotropic blends (mixtures that behave essentially as a single substance with one boiling point), though newer blends increasingly appear in different numbering ranges as they are assigned.</li><li><strong>R-1xxx series (HFOs):</strong> reserved for unsaturated organic compounds including hydrofluoroolefins, such as R-1234yf and R-1234ze.</li></ul><p>Blend refrigerants (like R-410A, a near-azeotropic blend of R-32 and R-125, or R-454B, a blend of R-32 and R-1234yf) are assigned once their exact composition and ratio are registered with ASHRAE; the numbers themselves do not describe the chemical formula directly but are assigned sequentially within each series.</p>', 2, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'ASHRAE 34 Safety Classification', 'ashrae-34-safety-classification', '<h3>At a glance</h3>
<ul><li>Classification combines toxicity (A/B) with flammability (1, 2L, 2, 3).</li><li>A1 is nonflammable/low toxicity; A2L (e.g. R-32) is mildly flammable.</li><li>B2L ammonia is higher toxicity and mildly flammable.</li><li>Classification drives code rules on charge size and ventilation.</li></ul>
<h3>The full picture</h3>
<p>Every refrigerant is assigned a safety classification combining toxicity and flammability, forming a grid of possible ratings:</p><table><thead><tr><th>Flammability / Toxicity</th><th>Class A (lower toxicity)</th><th>Class B (higher toxicity)</th></tr></thead><tbody><tr><td>Class 1 (no flame propagation)</td><td>A1 (e.g. R-410A, R-134a, R-22)</td><td>B1 (e.g. R-123)</td></tr><tr><td>Class 2L (mildly flammable)</td><td>A2L (e.g. R-32, R-454B, R-1234yf)</td><td>B2L (e.g. R-717 ammonia)</td></tr><tr><td>Class 2 (flammable)</td><td>A2 (e.g. R-152a)</td><td>B2 (rare)</td></tr><tr><td>Class 3 (highly flammable)</td><td>A3 (e.g. R-290 propane, R-600a isobutane)</td><td>B3 (rare)</td></tr></tbody></table><p>This classification directly drives code requirements for allowable refrigerant charge size, required ventilation, leak detection, and equipment design in the space where a system is installed.</p>', 3, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Ozone Depletion Potential (ODP) and Global Warming Potential (GWP)', 'ozone-depletion-potential-odp-and-global-warming-potential-g', '<h3>At a glance</h3>
<ul><li>ODP measures ozone-depletion ability, indexed against R-11 at 1.0.</li><li>Chlorine in CFCs and HCFCs destroys stratospheric ozone.</li><li>GWP measures warming contribution versus CO2, which equals 1.</li><li>R-410A (~2,088 GWP) far exceeds R-32 (~675) or R-1234yf (<1).</li></ul>
<h3>The full picture</h3>
<p><strong>Ozone Depletion Potential (ODP)</strong> is a relative measure of a substance''s ability to break down stratospheric ozone, indexed against R-11 (CFC-11), which is assigned an ODP of 1.0. Chlorine-containing refrigerants (CFCs and HCFCs) have significant ODP because chlorine radicals catalytically destroy ozone molecules in the upper atmosphere.</p><p><strong>Global Warming Potential (GWP)</strong> is a relative measure of how much a given mass of a gas contributes to atmospheric warming over a set time horizon (usually 100 years), indexed against carbon dioxide, which is assigned a GWP of 1. High-GWP refrigerants that leak into the atmosphere contribute to climate change even though they have no direct ozone impact. For example, R-410A has a GWP of approximately 2,088, while R-32 (a component of R-410A) has a GWP of about 675, and R-1234yf has a GWP below 1.</p><p>Modern refrigerant regulation is largely built around driving both ODP and GWP toward zero, without sacrificing the safety and efficiency needed for practical HVAC/R equipment.</p>', 4, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Historical Transition: CFCs to HCFCs to HFCs to HFOs/A2Ls', 'historical-transition-cfcs-to-hcfcs-to-hfcs-to-hfos-a2ls', '<h3>At a glance</h3>
<ul><li>CFCs (R-12) were phased out under the 1987 Montreal Protocol.</li><li>HCFCs (R-22) were phased out of U.S. production/import by 2020.</li><li>HFCs (R-410A, R-134a) have zero ODP but often high GWP.</li><li>HFOs/A2Ls (R-32, R-454B) cut GWP but add mild flammability.</li></ul>
<h3>The full picture</h3>
<p>The refrigerant industry has moved through four broad generations:</p><ul><li><strong>CFCs (chlorofluorocarbons)</strong>, such as R-12, dominated mid-20th-century refrigeration. High ODP led to their phase-out under the 1987 Montreal Protocol after their role in stratospheric ozone depletion was established.</li><li><strong>HCFCs (hydrochlorofluorocarbons)</strong>, such as R-22, served as transitional refrigerants with lower (but still nonzero) ODP. R-22 production and import were phased out in the U.S. by 2020 under the Montreal Protocol''s accelerated schedule, and existing R-22 systems now rely on reclaimed or substitute refrigerant.</li><li><strong>HFCs (hydrofluorocarbons)</strong>, such as R-410A and R-134a, contain no chlorine and therefore have zero ODP, and became the dominant replacement for CFCs/HCFCs starting in the 1990s-2000s. However, many HFCs carry high GWP, which became the next environmental concern.</li><li><strong>HFOs (hydrofluoroolefins) and A2L HFC/HFO blends</strong>, such as R-1234yf, R-32, R-454B, and R-455A, offer zero ODP and dramatically lower GWP than the HFCs they replace, at the cost of introducing mild flammability (A2L) that must be managed through equipment design and service practices.</li></ul>', 5, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Comparison of Common Refrigerants', 'comparison-of-common-refrigerants', '<h3>At a glance</h3>
<ul><li>Legacy R-12 and R-22 are phased out or reclaim-only now.</li><li>R-410A (~2,088 GWP) is being phased down after 2025.</li><li>R-32 and R-454B are the leading low-GWP A2L replacements.</li><li>Naturals like R-744 (CO2) and R-290 (propane) are growing options.</li></ul>
<h3>The full picture</h3>
<table><thead><tr><th>Refrigerant</th><th>Composition</th><th>ASHRAE Class</th><th>Approx. GWP</th><th>Typical Application</th><th>Status</th></tr></thead><tbody><tr><td>R-12</td><td>Pure CFC</td><td>A1</td><td>~10,900</td><td>Legacy auto A/C, refrigeration</td><td>Phased out (Montreal Protocol)</td></tr><tr><td>R-22</td><td>Pure HCFC</td><td>A1</td><td>~1,810</td><td>Legacy residential/commercial A/C</td><td>Production/import phased out in U.S. by 2020; service via reclaim only</td></tr><tr><td>R-410A</td><td>Blend: R-32/R-125</td><td>A1</td><td>~2,088</td><td>Residential/light commercial A/C (legacy standard)</td><td>Being phased down under AIM Act; largely replaced in new equipment by 2025</td></tr><tr><td>R-134a</td><td>Pure HFC</td><td>A1</td><td>~1,430</td><td>Automotive A/C, medium-temp refrigeration</td><td>Being phased down/replaced by lower-GWP options</td></tr><tr><td>R-32</td><td>Pure HFC</td><td>A2L</td><td>~675</td><td>Residential mini-splits, some new A/C</td><td>Growing use as R-410A replacement</td></tr><tr><td>R-454B</td><td>Blend: R-32/R-1234yf</td><td>A2L</td><td>~466</td><td>Residential/light commercial A/C and heat pumps</td><td>Primary R-410A replacement in new U.S. equipment as of 2025</td></tr><tr><td>R-1234yf</td><td>Pure HFO</td><td>A2L</td><td>&lt;1</td><td>Automotive A/C</td><td>Standard in new light-duty vehicles</td></tr><tr><td>R-455A</td><td>Blend: R-32/R-1234yf/CO2</td><td>A2L</td><td>~148</td><td>Light commercial refrigeration, some A/C</td><td>Emerging low-GWP option</td></tr><tr><td>R-744 (CO2)</td><td>Pure natural refrigerant</td><td>A1</td><td>1</td><td>Commercial/industrial refrigeration, transport</td><td>Growing use in high-pressure systems</td></tr><tr><td>R-290 (propane)</td><td>Pure hydrocarbon</td><td>A3</td><td>~3</td><td>Small self-contained refrigeration/freezers</td><td>Growing use under strict charge limits</td></tr></tbody></table>', 6, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Current U.S. Regulatory Drivers: The AIM Act and EPA Technology Transitions Rule', 'current-u-s-regulatory-drivers-the-aim-act-and-epa-technolog', '<h3>At a glance</h3>
<ul><li>The 2020 AIM Act lets EPA phase down HFC production/import.</li><li>Sector-specific GWP limits mostly phase in between 2025 and 2027.</li><li>Since January 2025, new AC/heat pumps must use GWP of 700 or lower.</li><li>This rule drives adoption of A2L refrigerants like R-32 and R-454B.</li></ul>
<h3>The full picture</h3>
<p>The <strong>American Innovation and Manufacturing (AIM) Act</strong>, enacted in 2020, gives the EPA authority to phase down the production and consumption of HFCs in the United States, consistent with the international Kigali Amendment to the Montreal Protocol. The AIM Act phasedown works by allocating a shrinking pool of HFC production/import allowances (measured in CO2-equivalent) stepped down against a 2012 baseline, with steep reductions scheduled through the 2020s and 2030s. On top of the overall allowance phasedown, EPA has finalized sector-specific GWP limits — restrictions on the maximum GWP of refrigerant allowed in new equipment for specific sectors (such as retail food refrigeration and industrial process refrigeration), generally phasing in between 2025 and 2027, with limits commonly in the 150-300 GWP range depending on the specific equipment subsector.</p><p>Separately, the EPA''s <strong>Technology Transitions rule</strong> under the AIM Act targets specific end-use sectors, including residential and light commercial air conditioning and heat pumps. As of January 1, 2025, newly manufactured residential and light commercial AC and heat pump equipment in the U.S. must use a refrigerant with a GWP of 700 or lower, which in practice has driven the industry toward R-454B and R-32 (both well under the 700 limit) as the primary replacements for R-410A (GWP ~2,088) in new equipment. Existing R-410A equipment already in the field is not affected by this manufacturing rule and can continue to be serviced with R-410A as available.</p><p>Together, these two regulatory tracks explain why A2L refrigerants have rapidly become the new normal in equipment technicians encounter in the field: the low-GWP requirement effectively rules out most legacy A1 HFCs for new equipment, and the best-performing low-GWP substitutes available at scale (R-32, R-454B, and similar blends) carry the A2L mild flammability classification. This is precisely why the safety practices covered earlier — A2L-rated leak detection, ignition source control, and A2L-rated recovery and service tools — are now a standard part of daily field work rather than a specialty concern. A separate module later in this course covers EPA Section 608 certification requirements and the detailed compliance mechanics (recovery requirements, recordkeeping, sales restrictions) in depth.</p>', 7, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of refrigerants: properties, classification & regulation you only <em>think</em> you know.</p>
<div data-interactive="hvacr-classify" data-set="ashrae"></div>', 8, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="refrigerants-regulations"></div>', 9, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerants-properties-classification-and-regulation'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Compressors
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Compressors', 'compressors',
       'Describe the compressor''s role in the refrigeration cycle and explain why it is called the system''s ''heart''.',
       5, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Compressors takes about <strong>35 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Describe the compressor''s role in the refrigeration cycle and explain why it is called the system''s ''heart''</li><li>Compare the mechanical operation, applications, and efficiency characteristics of reciprocating, scroll, rotary, screw, and centrifugal compressors</li><li>Differentiate hermetic, semi-hermetic, and open-drive compressor construction and their service implications</li><li>Identify common compressor failure modes and their root causes</li><li>Perform basic compressor diagnostic checks including amp draw, winding resistance/megohm testing, and compression testing</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-compressor-3d"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'compressors'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'The Compressor: Heart of the Refrigeration System', 'the-compressor-heart-of-the-refrigeration-system', '<h3>At a glance</h3>
<ul><li>Compressor is the heart, driving refrigerant flow and pressure.</li><li>Raises low-pressure vapor into high-pressure, high-temperature vapor.</li><li>Adds heat of compression, boosting discharge temperature further.</li><li>Every other component depends on pressures the compressor creates.</li></ul>
<h3>The full picture</h3>
<p>The compressor is often called the <strong>heart</strong> of the vapor-compression refrigeration system because it provides the mechanical energy that keeps refrigerant circulating and creates the pressure differential that makes the entire cycle work. Low-pressure, low-temperature vapor leaves the evaporator after absorbing heat from the space or product, and it is the compressor''s job to take that vapor and raise its pressure and temperature enough that it can reject that same heat (plus the heat of compression added by the compressor itself) to the ambient air or water at the condenser.</p><p>Without the compressor, refrigerant would simply equalize to one pressure throughout the system and no heat transfer could occur in a directional, useful way. Every other major component depends on the pressure and flow the compressor establishes: the condenser needs high-side pressure to condense at a temperature above ambient, the metering device needs a pressure drop to create, and the evaporator needs low-side pressure to boil refrigerant at a temperature below the space or product temperature.</p><ul><li>Creates and maintains the pressure differential between the high side and low side of the system</li><li>Adds heat of compression to the discharge vapor, raising its temperature well above the condensing temperature</li><li>Circulates refrigerant and, in most systems, entrained lubricating oil throughout the piping and components</li></ul>', 1, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'compressors'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Compressor Types and Mechanical Operation', 'compressor-types-and-mechanical-operation', '<h3>At a glance</h3>
<ul><li>Five main types: reciprocating, scroll, rotary, screw, centrifugal.</li><li>Reciprocating uses pistons; scroll uses interleaving spiral scrolls.</li><li>Screw and centrifugal handle large commercial, industrial loads.</li><li>Scroll compressors dominate residential AC and heat pumps today.</li></ul>
<h3>The full picture</h3>
<p>Different compressor designs suit different capacities, refrigerants, and applications. All perform the same basic job (reduce volume to raise pressure) but do it with very different mechanisms.</p><table><thead><tr><th>Type</th><th>How It Works</th><th>Typical Application</th></tr></thead><tbody><tr><td>Reciprocating</td><td>Piston moves up and down in a cylinder; suction and discharge reed valves open/close on pressure differential to draw in and push out vapor</td><td>Residential and light commercial refrigeration and AC, small to mid-size chillers</td></tr><tr><td>Scroll</td><td>Two interleaving spiral scrolls, one fixed and one orbiting; vapor is trapped in shrinking pockets that move toward the center as the orbiting scroll turns</td><td>Residential/light commercial AC and heat pumps, tolerant of minor liquid slugging</td></tr><tr><td>Rotary</td><td>An eccentric rolling piston or set of vanes sweeps vapor around a cylindrical chamber, compressing it as the swept volume shrinks</td><td>Small appliances, window units, some small refrigeration compressors</td></tr><tr><td>Screw</td><td>Two meshing helical rotors (male and female) trap vapor between the lobes and the housing, compressing it continuously as the rotors turn; oil is injected for sealing, lubrication, and cooling</td><td>Large commercial and industrial chillers and refrigeration systems</td></tr><tr><td>Centrifugal</td><td>A high-speed impeller flings refrigerant vapor outward, converting velocity into pressure (dynamic compression) rather than trapping and squeezing a fixed volume</td><td>Large-tonnage comfort cooling chillers, typically low-pressure refrigerants</td></tr></tbody></table><p>Reciprocating compressors are the most common in the field and the easiest to visualize: think of an automotive engine running in reverse, using pressure differential instead of combustion to move the pistons. Scroll compressors have largely replaced reciprocating designs in residential and light commercial AC/heat pump equipment because they have fewer moving parts, run quieter, and tolerate brief liquid floodback better without immediate mechanical damage. Screw and centrifugal compressors appear almost exclusively in larger commercial and industrial systems where continuous, high-volume compression is needed.</p>', 2, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'compressors'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Hermetic, Semi-Hermetic, and Open-Drive Construction', 'hermetic-semi-hermetic-and-open-drive-construction', '<h3>At a glance</h3>
<ul><li>Hermetic: motor sealed inside welded shell, not field-repairable.</li><li>Semi-hermetic: bolted housing allows field service of internal parts.</li><li>Open-drive: external motor connects via shaft seal and coupling.</li><li>Construction type shows whether a failure means repair or replacement.</li></ul>
<h3>The full picture</h3>
<p>Compressor construction is classified by how the motor and pumping mechanism are enclosed and whether the unit can be field-serviced internally.</p><ul><li><strong>Hermetic:</strong> The motor and compression mechanism are sealed together inside a welded steel shell. The motor is cooled directly by returning suction gas or liquid refrigerant. Hermetics are not field-repairable internally &mdash; if the motor or mechanism fails, the entire compressor is replaced. Common in residential and light commercial equipment.</li><li><strong>Semi-hermetic:</strong> Similar to a hermetic in that the motor still operates inside the refrigerant atmosphere, but the housing is bolted together rather than welded. Cylinder heads, valve plates, and sometimes pistons can be removed and serviced in the field. Common in commercial refrigeration and larger AC systems where field repair is economically justified.</li><li><strong>Open-drive:</strong> The motor is completely external to the refrigerant circuit and connects to the compressor shaft through a coupling or belt, passing through a shaft seal. Because the motor is not refrigerant-cooled, it must be air-cooled like an ordinary electric motor. The shaft seal is a common wear point and potential refrigerant leak path. Open-drive compressors are typical in larger industrial and ammonia refrigeration systems.</li></ul><p>From a service standpoint, this classification tells a technician immediately what is and is not repairable: a failed hermetic scroll compressor means a full replacement, while a semi-hermetic reciprocating compressor with a bad discharge valve may only need a head and valve plate service.</p>', 3, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'compressors'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Compression Ratio and Staging', 'compression-ratio-and-staging', '<h3>At a glance</h3>
<ul><li>Compression ratio equals absolute discharge pressure over suction pressure.</li><li>Higher ratios lower efficiency and raise discharge temperature.</li><li>Single-stage compressors work best up to about 9:1 ratio.</li><li>Two-stage booster compression suits very low-temperature freezer applications.</li></ul>
<h3>The full picture</h3>
<p>Compression ratio (CR) is the ratio of absolute discharge pressure to absolute suction pressure: <strong>CR = Discharge Pressure (absolute) / Suction Pressure (absolute)</strong>. Pressures must be converted to absolute by adding atmospheric pressure (about 14.7 psi at sea level) to the gauge reading, since gauges read pressure relative to atmosphere.</p><p><em>Worked example:</em> A system reads 70 psig suction and 350 psig discharge. Suction absolute = 70 + 14.7 = 84.7 psia. Discharge absolute = 350 + 14.7 = 364.7 psia. CR = 364.7 / 84.7 &asymp; 4.3:1.</p><p>As compression ratio rises, volumetric efficiency (the ratio of vapor actually pumped to the compressor''s theoretical displacement) falls, discharge temperature climbs, and mechanical/thermal stress on valves, bearings, and oil increases. Single-stage compressors generally perform best up to a compression ratio of roughly 9:1; beyond that, efficiency losses and heat become excessive.</p><p>For very low-temperature applications (such as freezer evaporators running at -20°F to -40°F), a single compressor would need an impractically high compression ratio to reach normal condensing pressures. <strong>Two-stage (booster) compression</strong> solves this by splitting the work between two compressors: a low-stage (booster) compressor pulls from the low-temperature evaporator and discharges into an intermediate pressure, and a high-stage compressor takes that intermediate-pressure vapor and compresses it the rest of the way to condensing pressure. Interstage desuperheating is often used between stages to control discharge temperature.</p>', 4, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'compressors'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Oil Management', 'oil-management', '<h3>At a glance</h3>
<ul><li>Oil lubricates, cools, and seals compressor moving parts.</li><li>Crankcase heater keeps oil warm, preventing refrigerant migration.</li><li>Oil sight glass reveals oil level and contamination signs.</li><li>Proper oil return prevents bearing failure despite normal pressures.</li></ul>
<h3>The full picture</h3>
<p>Compressor lubricating oil reduces friction and wear at bearings, pistons, and other moving parts, helps cool the motor and mechanism, and helps seal clearances between moving parts. Oil type must match the refrigerant and system (POE oils are standard with HFC refrigerants such as R-410A and R-134a; mineral oils were used with older CFC/HCFC refrigerants).</p><ul><li><strong>Crankcase heater:</strong> A resistance heater on or in the compressor shell that energizes during the off-cycle, especially in cold ambient conditions. Its job is to keep the oil warm so refrigerant vapor does not migrate into the crankcase and condense/absorb into the oil, which would otherwise dilute the oil and set up a flooded start.</li><li><strong>Oil sight glass:</strong> A small window on the compressor crankcase that lets a technician visually verify oil level and condition. Milky, foaming, or cloudy oil is a warning sign of refrigerant dilution or moisture contamination.</li><li><strong>Oil return:</strong> Oil leaves the compressor entrained in the refrigerant and must make its way all the way around the system and back to the crankcase. Proper line sizing, correctly placed traps on vertical suction risers, and adequate refrigerant velocity are all necessary to keep oil moving; poor oil return starves the compressor of lubrication over time, leading to bearing and mechanical failure even though the refrigerant charge and pressures may look normal.</li></ul>', 5, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'compressors'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Common Failure Modes and Diagnostic Checks', 'common-failure-modes-and-diagnostic-checks', '<h3>At a glance</h3>
<ul><li>Flooded start and slugging cause liquid damage inside the compressor.</li><li>Short cycling and burnout stem from control or motor faults.</li><li>Winding resistance and megohm tests reveal shorts or ground faults.</li><li>Compression test checks for worn or broken internal valves.</li></ul>
<h3>The full picture</h3>
<p>Most compressor failures trace back to a handful of recognizable causes:</p><ul><li><strong>Flooded start:</strong> Liquid refrigerant has migrated into the crankcase during the off-cycle (often due to a failed or missing crankcase heater) and dilutes the oil. On startup, the diluted, foaming oil cannot properly lubricate bearings, and any liquid in the cylinder can damage valves, pistons, or connecting rods.</li><li><strong>Slugging:</strong> Liquid refrigerant or oil enters a cylinder while the compressor is running, causing a hydraulic hammering effect that can bend rods, crack pistons, or break valves. Common causes include an overfeeding or malfunctioning metering device, an overcharged system, or evaporator floodback from low airflow/load.</li><li><strong>Short cycling:</strong> The compressor turns on and off rapidly and repeatedly, causing high inrush/starting current every cycle, excess motor heating, and accelerated contactor wear. Common causes include undercharge, a faulty thermostat/control, an oversized unit for the load, or a low-pressure control cycling on a restriction.</li><li><strong>Electrical burnout:</strong> Motor winding insulation breaks down from overheating (poor motor cooling, high discharge temperature, or high amperage), voltage problems, or long-term moisture/acid contamination. A burnout contaminates the system with acid and sludge that must be cleaned up (often with a suction-line filter drier and system flush) before a replacement compressor is installed.</li><li><strong>Valve failure:</strong> Broken, leaking, or fatigued suction/discharge reed valves (in reciprocating compressors) reduce capacity and change the normal pressure relationship between suction and discharge, often from slugging, fatigue, or debris in the system.</li></ul><p>Basic diagnostic checks include: comparing measured <strong>amp draw</strong> to the compressor''s rated load amps (RLA) on the nameplate; an <strong>ohmmeter winding resistance test</strong> comparing resistance across the three motor windings (should be low and roughly balanced; infinite resistance indicates an open winding, near-zero between windings can indicate a short); a <strong>megohm (insulation resistance) test</strong> from each winding terminal to the compressor shell/ground, where a healthy compressor reads well above 1 megohm and a low reading points to a ground fault or moisture contamination; and a <strong>compression test</strong>, where a compressor that draws normal amperage but cannot build adequate head pressure or maintain a pressure differential under load is a strong indicator of worn or broken internal valves.</p>', 6, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'compressors'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of compressors you only <em>think</em> you know.</p>
<div data-interactive="hvacr-label" data-set="compressor"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'compressors'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="compressors"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'compressors'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Condensers
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Condensers', 'condensers',
       'Explain the condenser''s role in rejecting heat and identify its three functional zones (desuperheating, condensing, subcooling).',
       6, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Condensers takes about <strong>32 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Explain the condenser''s role in rejecting heat and identify its three functional zones (desuperheating, condensing, subcooling)</li><li>Compare air-cooled, water-cooled, and evaporative condenser designs and their typical applications</li><li>Describe head pressure control strategies used to maintain proper condensing pressure across varying ambient conditions</li><li>Diagnose the effects of dirty coils, airflow restriction, and non-condensables on condenser performance</li><li>Calculate subcooling from measured pressure and temperature and use it to evaluate condenser and charge performance</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-coil-3d" data-coil="condenser"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'condensers'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'The Condenser''s Role and the Three Heat Rejection Zones', 'the-condenser-s-role-and-the-three-heat-rejection-zones', '<h3>At a glance</h3>
<ul><li>Condenser rejects evaporator heat plus the compressor''s heat of compression.</li><li>Desuperheating cools hot discharge vapor down to saturation temperature.</li><li>Condensing releases latent heat across the bulk of the coil.</li><li>Subcooling ensures 100% liquid reaches the metering device.</li></ul>
<h3>The full picture</h3>
<p>The condenser''s job is to reject the heat absorbed at the evaporator plus the heat of compression added by the compressor, transferring it into ambient air or water. Hot, high-pressure refrigerant vapor enters the condenser and leaves as a subcooled high-pressure liquid ready to be metered into the evaporator. This transformation happens across three distinct zones inside the coil.</p><table><thead><tr><th>Zone</th><th>What Happens</th><th>Location in Coil</th></tr></thead><tbody><tr><td>Desuperheating</td><td>Hot discharge vapor is cooled from discharge temperature down to its saturation temperature; no condensing yet occurs</td><td>Coil inlet (first, relatively small portion)</td></tr><tr><td>Condensing</td><td>Refrigerant changes phase from vapor to liquid at essentially constant temperature and pressure, releasing latent heat; this is the bulk of the coil</td><td>Middle majority of the coil</td></tr><tr><td>Subcooling</td><td>Fully condensed liquid is cooled further below its saturation temperature, ensuring 100% liquid enters the metering device</td><td>Coil outlet / near the receiver</td></tr></tbody></table><p>Subcooling is important because any flash vapor arriving at the metering device reduces its capacity and can cause erratic operation; a properly subcooled liquid line guarantees solid liquid feed.</p>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'condensers'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Air-Cooled Condensers', 'air-cooled-condensers', '<h3>At a glance</h3>
<ul><li>Fin-and-tube coils use axial or blower fans to move air.</li><li>Standard-efficiency units condense roughly 25 to 30°F above ambient.</li><li>Higher-efficiency designs run closer to 10 to 20°F above ambient.</li><li>Readings outside range signal airflow, charge, or coil cleanliness problems.</li></ul>
<h3>The full picture</h3>
<p>Air-cooled condensers are by far the most common type in residential and light commercial equipment. They use a fin-and-tube design similar to an evaporator coil &mdash; copper (or aluminum) tubes carrying refrigerant, expanded through aluminum fins that multiply the surface area exposed to air.</p><ul><li><strong>Propeller (axial) fans</strong> move large volumes of air at low static pressure and are typical of condensing units sitting outdoors with unobstructed airflow.</li><li><strong>Centrifugal (blower) fans</strong> are used where air must be ducted or pushed against higher resistance, such as in some packaged rooftop units.</li></ul><p>A useful field rule of thumb relates condensing temperature to ambient temperature: standard-efficiency air-cooled equipment is often designed to condense roughly 25 to 30°F above the outdoor ambient temperature, while higher-efficiency designs with more coil surface area may run closer to 10 to 20°F above ambient. For example, on a 95°F design day, a standard-efficiency unit might be expected to show a condensing temperature around 120 to 125°F. Readings well outside this range point to an airflow, charge, or coil cleanliness problem rather than a purely ambient effect.</p>', 2, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'condensers'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Water-Cooled Condensers and Cooling Towers', 'water-cooled-condensers-and-cooling-towers', '<h3>At a glance</h3>
<ul><li>Shell-and-tube condensers reject heat into a circulated water loop.</li><li>Open cooling towers evaporate water to lower the loop temperature.</li><li>Closed-circuit towers isolate process water from the evaporated water.</li><li>Water treatment prevents scale, corrosion, and Legionella risk.</li></ul>
<h3>The full picture</h3>
<p>Water-cooled condensers reject heat into a circulated water loop instead of directly into air. The most common design is the <strong>shell-and-tube condenser</strong>: refrigerant vapor enters the shell and condenses on the outside of a bundle of tubes, while cooling water is pumped through the inside of those tubes (or vice versa, depending on design).</p><p>Because the water absorbs heat, it must reject that heat somewhere, typically at a <strong>cooling tower</strong>. In an open cooling tower, warm water is sprayed or distributed over fill material while air is drawn or blown through it; a portion of the water evaporates, and this evaporative cooling drops the remaining water''s temperature before it returns to the condenser. Closed-circuit towers keep the process water in a separate loop from the water being evaporated, reducing fouling of the condenser tubes.</p><p>Water treatment is critical in these systems: untreated water promotes scale, corrosion, and biological growth (including Legionella risk in towers), all of which foul heat transfer surfaces and degrade performance. Water-cooled systems are common on larger commercial and industrial chillers where they offer more stable, often lower condensing temperatures than air-cooled equivalents.</p>', 3, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'condensers'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Evaporative Condensers', 'evaporative-condensers', '<h3>At a glance</h3>
<ul><li>Combines air- and water-cooling by spraying water on the coil.</li><li>Evaporation is driven by wet-bulb, not dry-bulb, air temperature.</li><li>Can reach lower condensing temperatures than air-cooled units on hot, dry days.</li><li>Common in large commercial, industrial, and ammonia refrigeration systems.</li></ul>
<h3>The full picture</h3>
<p>An evaporative condenser combines air-cooled and water-cooled principles in a single unit. Refrigerant flows through a coil while water is continuously sprayed or distributed over the coil''s outer surface, and air is simultaneously drawn or blown across it. The evaporation of the thin water film on the coil surface absorbs a large amount of heat directly from the refrigerant tubes, which is far more effective than air alone.</p><p>Because evaporation is driven by the difference between the water film temperature and the <strong>wet-bulb temperature</strong> of the air (rather than the dry-bulb temperature that governs air-cooled condensers), evaporative condensers can achieve condensing temperatures closer to, and often lower than, what an equivalent air-cooled unit could reach on a hot, dry day. They are widely used in large commercial and industrial refrigeration systems, including many ammonia plants.</p><p>Like cooling towers, evaporative condensers require ongoing water treatment, sump makeup water management, and periodic cleaning of the coil and basin to control scale, algae, and biological growth.</p>', 4, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'condensers'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Head Pressure Control Strategies', 'head-pressure-control-strategies', '<h3>At a glance</h3>
<ul><li>Head pressure must stay high enough for flow and oil return.</li><li>Fan cycling stages fans on/off to hold pressure in cold weather.</li><li>Variable-speed fans modulate airflow for tighter, more efficient control.</li><li>Flooded condenser control backs up liquid to raise head pressure.</li></ul>
<h3>The full picture</h3>
<p>Head (discharge) pressure must stay high enough to force adequate refrigerant flow through the metering device and to maintain oil return velocity, but not so high that it overloads the compressor or trips a high-pressure safety control. Ambient temperature swings, especially cold weather on air-cooled systems, can push head pressure too low without some form of control. Common strategies include:</p><ul><li><strong>Fan cycling control:</strong> One or more condenser fans are staged on and off (via a pressure or temperature-based control) to reduce airflow and raise head pressure when ambient conditions would otherwise drive it too low.</li><li><strong>Variable-speed fan control:</strong> A VFD or electronically commutated motor smoothly modulates fan speed to hold head pressure within a tight band, offering finer control and lower energy use than simple cycling.</li><li><strong>Flooded condenser / receiver head pressure control:</strong> A head pressure control valve intentionally backs up liquid refrigerant into a portion of the condenser coil, reducing the effective condensing surface area and artificially raising head pressure in cold ambient conditions. This method requires additional refrigerant charge to fill the flooded portion of the coil and a receiver to hold the displaced liquid during warm weather.</li></ul><p>Selecting the right strategy depends on climate, equipment design, and how critical tight head pressure control is to reliable metering device operation.</p>', 5, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'condensers'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Diagnosing Condenser Problems and Calculating Subcooling', 'diagnosing-condenser-problems-and-calculating-subcooling', '<h3>At a glance</h3>
<ul><li>Dirty or blocked coils cause high head pressure and amp draw.</li><li>Non-condensables raise standing pressure above the P-T chart value.</li><li>Subcooling equals saturation temperature minus measured liquid line temperature.</li><li>Low subcooling suggests undercharge; high suggests overcharge or a restriction.</li></ul>
<h3>The full picture</h3>
<p>A dirty or airflow-restricted air-cooled condenser coil cannot reject heat efficiently. The typical symptom set is <strong>high head pressure, high discharge (compressor) temperature, and increased compressor amp draw</strong>, since the compressor has to work harder to push heat across a fouled or blocked coil. Left unaddressed, this accelerates compressor wear and can trip high-pressure safety controls.</p><p><strong>Non-condensables</strong> (air, nitrogen, or other gases that do not condense at system operating pressures) are usually introduced by inadequate evacuation before charging or by a system that has been open to atmosphere. They collect at the top of the condenser, occupying space that should be used for condensing and raising head pressure. A telltale diagnostic: after shutting the system down and letting pressures equalize with the surroundings for several hours, the standing pressure should match the saturation pressure of the refrigerant at ambient temperature on a P-T chart. If the standing pressure is noticeably higher than that P-T chart value, non-condensables are the likely explanation, since they add their own partial pressure on top of the refrigerant''s.</p><p><strong>Subcooling</strong> is calculated as: Subcooling = Saturation temperature (from measured liquid line pressure, read on a P-T chart) minus Actual measured liquid line temperature.</p><p><em>Worked example:</em> Liquid line pressure reads 250 psig on an R-410A system, corresponding to a saturation temperature of about 95°F on the P-T chart. The measured liquid line temperature at the same point is 82°F. Subcooling = 95 - 82 = 13°F. Compared against a typical manufacturer target of roughly 8 to 12°F, this reading is slightly high but close to normal; subcooling well below target suggests undercharge or insufficient condenser surface/airflow, while subcooling well above target suggests overcharge or a restriction (such as a partially clogged liquid line filter drier) backing liquid up into the condenser.</p>', 6, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'condensers'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of condensers you only <em>think</em> you know.</p>
<div data-interactive="hvacr-label" data-set="condenser"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'condensers'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="condensers"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'condensers'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 7. Metering / Expansion Devices
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Metering / Expansion Devices', 'metering-expansion-devices',
       'Explain the metering device''s dual role of creating a pressure drop and controlling refrigerant flow into the evaporator.',
       7, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Metering / Expansion Devices takes about <strong>34 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Explain the metering device''s dual role of creating a pressure drop and controlling refrigerant flow into the evaporator</li><li>Compare fixed-orifice devices (capillary tubes, piston/orifice) with thermostatic expansion valves (TXVs) in operation and control response</li><li>Describe how a TXV''s bulb, diaphragm, and spring interact to maintain superheat, and distinguish internally from externally equalized TXVs</li><li>Explain how electronic expansion valves (EEVs) use a stepper motor and superheat sensor/controller to modulate flow</li><li>Diagnose overfeeding and underfeeding conditions from system symptoms and calculate superheat to evaluate metering device performance</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-txv-3d"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'metering-expansion-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'The Role of the Metering Device', 'the-role-of-the-metering-device', '<h3>At a glance</h3>
<ul><li>Creates the pressure drop between high side and low side.</li><li>Regulates refrigerant flow rate to match current heat load.</li><li>Overfeeding risks liquid refrigerant reaching the compressor.</li><li>Underfeeding starves the evaporator, raising discharge temperature.</li></ul>
<h3>The full picture</h3>
<p>The metering device sits in the liquid line between the condenser and the evaporator, and it performs two related jobs. First, it creates the pressure drop between the high side and low side of the system, allowing high-pressure subcooled liquid to flash down to the low evaporator pressure where refrigerant can boil at the low temperature needed to absorb heat. Second, it meters &mdash; that is, it regulates the rate of refrigerant flow into the evaporator to match the current heat load.</p><p>Getting the flow rate right matters a great deal. Too much flow floods the evaporator, risking liquid refrigerant reaching the compressor. Too little flow starves the evaporator, robbing it of capacity and potentially causing high compressor discharge temperatures from lack of returning refrigerant to cool the motor. The metering device is also what allows two very different pressures &mdash; a high-side and a low-side pressure &mdash; to coexist simultaneously in the same sealed system.</p>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'metering-expansion-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Fixed-Orifice Metering Devices: Capillary Tubes and Piston/Orifice (AXV)', 'fixed-orifice-metering-devices-capillary-tubes-and-piston-or', '<h3>At a glance</h3>
<ul><li>Capillary tubes are long, fixed-diameter tubes with no moving parts.</li><li>Capillary systems need a precise "critical charge" of refrigerant.</li><li>Piston/orifice valves are common in residential heat pumps.</li><li>Neither device actively adjusts flow as load changes.</li></ul>
<h3>The full picture</h3>
<p>Fixed-orifice devices restrict flow using a fixed geometry that does not change with operating conditions. They are simpler and cheaper than thermostatic devices but cannot actively respond to changing load.</p><ul><li><strong>Capillary tube:</strong> A long, small-bore tube of fixed length and diameter. Flow through it is passively determined by the pressure differential across it and the amount of liquid subcooling entering it. Capillary tube systems have no moving parts and no way to adjust flow, which makes the refrigerant charge amount extremely critical (often called a "critical charge" system) &mdash; even a small charge error significantly affects performance. Common in small refrigerators, freezers, window units, and small package units.</li><li><strong>Piston/orifice (often called an AXV, fixed-orifice, or "piston valve"):</strong> A fixed-diameter orifice housed in a removable piston, commonly used in residential heat pump systems (often paired with a TXV for the other flow direction). Like a capillary tube, it does not actively adjust to load; superheat simply floats up and down with changes in load, ambient conditions, and available subcooling. Adequate liquid subcooling ahead of a fixed-orifice device is essential, since any flash gas arriving at the orifice reduces its effective capacity.</li></ul>', 2, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'metering-expansion-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Thermostatic Expansion Valves (TXV): Superheat Control', 'thermostatic-expansion-valves-txv-superheat-control', '<h3>At a glance</h3>
<ul><li>TXV actively adjusts flow to hold a target superheat.</li><li>Bulb pressure, spring pressure, and evaporator pressure balance the valve.</li><li>Rising heat load raises bulb pressure, opening the valve further.</li><li>Typical target superheat range is about 8 to 12°F.</li></ul>
<h3>The full picture</h3>
<p>A thermostatic expansion valve actively modulates flow to hold evaporator superheat close to a target value across a wide range of loads, unlike a fixed-orifice device. A needle-and-seat assembly inside the valve body is positioned by a diaphragm, which balances three forces:</p><ul><li><strong>Bulb pressure (opening force):</strong> A remote sensing bulb, charged with a refrigerant-based fill, is clamped to the suction line at the evaporator outlet. It senses the temperature of the superheated vapor leaving the coil and transmits a corresponding pressure to the top of the diaphragm through a small tube.</li><li><strong>Spring pressure (closing force):</strong> An adjustable (or factory-set) spring pushes against the underside of the diaphragm, establishing the target superheat setting.</li><li><strong>Evaporator pressure (closing force):</strong> The evaporator''s own pressure also acts on the underside of the diaphragm, opposing the bulb pressure.</li></ul><p>As heat load increases, the vapor leaving the evaporator becomes warmer (more superheated), the bulb senses this higher temperature, bulb pressure rises, and the diaphragm pushes the needle further open, allowing more refrigerant flow to satisfy the added load. As load drops, the reverse happens and the valve throttles closed. This constant feedback loop is what allows a TXV to maintain a fairly steady superheat, typically in the range of about 8 to 12°F depending on manufacturer setting, across widely varying operating conditions.</p>', 3, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'metering-expansion-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Internally vs Externally Equalized TXVs', 'internally-vs-externally-equalized-txvs', '<h3>At a glance</h3>
<ul><li>Equalization is where the TXV senses evaporator pressure.</li><li>Internal equalization suits low pressure-drop, single-circuit evaporators.</li><li>External equalizer tube suits coils with multiple distributor circuits.</li><li>External sensing prevents the valve from starving the coil.</li></ul>
<h3>The full picture</h3>
<p>The "equalization" of a TXV refers to where the valve senses evaporator pressure as the closing force acting on the diaphragm.</p><ul><li><strong>Internally equalized:</strong> Evaporator pressure is sensed internally, right at the valve''s outlet port. This works well on evaporators with low internal pressure drop, such as coils with a single refrigerant circuit or a short circuit length.</li><li><strong>Externally equalized:</strong> A separate small external equalizer tube connects the underside of the diaphragm to the suction line at the evaporator outlet (near the bulb location), rather than sensing pressure right at the valve. This is necessary on evaporators with significant internal pressure drop &mdash; for example, coils with multiple distributor circuits or long refrigerant paths &mdash; because internal sensing would overstate the pressure actually present at the coil outlet, causing the valve to under-open and starve the coil of refrigerant. The external equalizer lets the valve respond to the pressure that actually exists where superheat matters: the evaporator outlet.</li></ul>', 4, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'metering-expansion-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Electronic Expansion Valves (EEV)', 'electronic-expansion-valves-eev', '<h3>At a glance</h3>
<ul><li>EEV uses a stepper motor instead of bulb and spring.</li><li>Sensors feed temperature and pressure data to a controller.</li><li>EEVs respond faster and hold lower superheat than TXVs.</li><li>Common on inverter equipment and commercial refrigeration racks.</li></ul>
<h3>The full picture</h3>
<p>An electronic expansion valve replaces the mechanical bulb-diaphragm-spring assembly with a stepper motor driven needle valve controlled by an electronic board. A temperature sensor and a pressure sensor (or a dedicated superheat/pressure transducer) are installed at the evaporator outlet and feed their readings to a controller, which calculates actual superheat in real time and commands the stepper motor to open or close the valve in small, precise increments.</p><p>Because the control loop is electronic rather than mechanical, EEVs generally respond faster and more precisely than TXVs, can maintain lower superheat setpoints safely (improving efficiency and capacity), and can be reprogrammed for different setpoints without physically changing the valve. They eliminate problems associated with poor mechanical bulb contact on the suction line, but add electronic complexity, sensor calibration, and controller diagnostics to the technician''s troubleshooting toolkit. EEVs are common on higher-efficiency variable-speed/inverter equipment and in supermarket and commercial refrigeration racks.</p>', 5, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'metering-expansion-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overfeeding, Underfeeding, and a Worked Superheat Example', 'overfeeding-underfeeding-and-a-worked-superheat-example', '<h3>At a glance</h3>
<ul><li>Overfeeding causes low superheat, frost migration, floodback risk.</li><li>Underfeeding causes high superheat, a starved coil, low suction pressure.</li><li>Superheat equals actual line temperature minus saturation temperature.</li><li>Example: 50°F minus 40°F equals 10°F, within normal range.</li></ul>
<h3>The full picture</h3>
<p>Recognizing overfeeding vs underfeeding symptoms in the field is a core diagnostic skill.</p><ul><li><strong>Overfeeding</strong> (from a TXV stuck open, a bulb that has lost its charge or lost contact with the suction line, an oversized valve, or excess flow through a fixed-orifice device) causes: low superheat, frost or heavy sweat extending abnormally far up the suction line (sometimes onto the compressor shell), risk of liquid floodback or slugging at the compressor, and oil dilution.</li><li><strong>Underfeeding</strong> (from a clogged filter drier or strainer, low refrigerant charge, a TXV stuck partially closed or losing bulb charge in a way that throttles the valve shut, a kinked liquid line, or general restriction) causes: high superheat, a starved evaporator where only the first portion of the coil frosts or cools while the rest stays warm and dry, lower-than-normal suction pressure, reduced cooling capacity, and elevated compressor discharge temperature.</li></ul><p><em>Worked superheat example:</em> At the evaporator outlet on an R-410A system, suction pressure reads 118 psig, which corresponds to a saturation temperature of 40°F on the P-T chart. A thermometer or thermocouple strapped to the suction line at that same point reads an actual temperature of 50°F. Superheat = Actual line temperature - Saturation temperature = 50 - 40 = 10°F. Compared against a typical target range of 8 to 12°F, this result falls right in range, indicating the TXV is feeding the evaporator correctly.</p>', 6, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'metering-expansion-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of metering / expansion devices you only <em>think</em> you know.</p>
<div data-interactive="hvacr-calc-classify" data-set="superheat"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'metering-expansion-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="metering-devices"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'metering-expansion-devices'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 8. Evaporators & Heat Load
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Evaporators & Heat Load', 'evaporators-and-heat-load',
       'Explain the evaporator''s role in absorbing heat via boiling refrigerant and relate evaporator temperature/pressure to desired space temperature.',
       8, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Evaporators & Heat Load takes about <strong>33 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Explain the evaporator''s role in absorbing heat via boiling refrigerant and relate evaporator temperature/pressure to desired space temperature</li><li>Compare evaporator types including finned-tube air coils, plate evaporators, and shell-and-tube chillers, and distinguish flooded from direct-expansion (DX) operation</li><li>Apply the TD (temperature difference) rule of thumb to explain coil sizing and its effect on dehumidification</li><li>Describe latent vs sensible heat removal at the evaporator and its effect on frost/ice formation and defrost requirements</li><li>Identify the basic components of a refrigeration heat load to explain why a box runs warm without performing a full load calculation</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-coil-3d" data-coil="evaporator"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'evaporators-and-heat-load'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'The Evaporator''s Role: Absorbing Heat by Boiling Refrigerant', 'the-evaporator-s-role-absorbing-heat-by-boiling-refrigerant', '<h3>At a glance</h3>
<ul><li>Low-pressure liquid refrigerant boils in the coil, absorbing heat.</li><li>Evaporator pressure sets the refrigerant''s boiling/operating temperature.</li><li>Coolers run ~15-25°F; freezers run -20 to -30°F.</li><li>Colder evaporators boost heat transfer but raise frost and dehydration.</li></ul>
<h3>The full picture</h3>
<p>The evaporator is where the useful refrigeration effect actually happens. Low-pressure liquid refrigerant leaving the metering device enters the evaporator and boils, absorbing latent heat from the air (or fluid) passing over or through the coil. Because a refrigerant''s boiling (saturation) temperature is directly tied to its pressure, controlling evaporator pressure is how a system sets the evaporator''s operating temperature.</p><p>The target evaporator temperature is chosen based on the desired space or product temperature and the amount of temperature difference needed for adequate heat transfer. A medium-temperature cooler holding product around 35°F might run an evaporator temperature roughly 15 to 25°F. A low-temperature freezer holding product around 0°F or below might run an evaporator around -20°F to -30°F. Running a colder evaporator increases the temperature difference (and thus heat transfer capacity per square foot of coil), but it also increases dehydration and frost buildup on the coil and raises the compression ratio the compressor must work against, reducing overall efficiency.</p>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'evaporators-and-heat-load'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Evaporator Types: Finned-Tube Coils, Plate, and Shell-and-Tube Chillers', 'evaporator-types-finned-tube-coils-plate-and-shell-and-tube-', '<h3>At a glance</h3>
<ul><li>Finned-tube air coils are most common in AC and refrigeration.</li><li>Distributors balance refrigerant flow across multiple coil circuits.</li><li>Plate evaporators are compact and efficient, used in chillers and ice machines.</li><li>Shell-and-tube chillers cool water, glycol, or brine, flooded or DX.</li></ul>
<h3>The full picture</h3>
<p>Evaporators appear in several physical designs depending on the application:</p><ul><li><strong>Finned-tube air coils:</strong> The most common evaporator type in air conditioning and air-cooled refrigeration. Copper tubes are expanded through aluminum (or sometimes copper) fins to maximize surface area, and a fan blows air across the coil. Multiple circuits are typically fed through a distributor downstream of the metering device to balance flow evenly.</li><li><strong>Plate evaporators:</strong> Compact, brazed flat-plate heat exchangers that offer high heat transfer efficiency in a small footprint. Common in liquid chillers, glycol systems, and ice machines.</li><li><strong>Shell-and-tube chillers:</strong> A cylindrical shell containing a tube bundle, used to chill water, glycol, or brine for large-scale comfort cooling or process cooling applications. These can be configured as either flooded or direct-expansion designs.</li></ul>', 2, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'evaporators-and-heat-load'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Flooded vs Direct-Expansion (DX) Evaporators', 'flooded-vs-direct-expansion-dx-evaporators', '<h3>At a glance</h3>
<ul><li>DX is standard; TXV/EEV controls superheat at coil outlet.</li><li>Flooded coils stay full of liquid for higher heat transfer.</li><li>A surge drum separates liquid from vapor before the compressor.</li><li>Flooded designs need more charge; mainly large/industrial systems.</li></ul>
<h3>The full picture</h3>
<p><strong>Direct expansion (DX)</strong> is the standard configuration in the great majority of unitary air conditioning, heat pump, and refrigeration equipment. Refrigerant enters as a low-percentage liquid/vapor mixture from the metering device, progressively absorbs heat as it travels through the coil, and exits fully vaporized with a small amount of superheat measured at the outlet. The metering device (TXV or EEV) controls that outlet superheat directly.</p><p>A <strong>flooded evaporator</strong> works differently: the coil (or shell, in a flooded chiller) is kept full of liquid refrigerant at essentially all times, well beyond what would fully vaporize inside the coil. Rather than relying on superheat at the coil outlet, a surge drum (accumulator) downstream separates liquid from vapor; the liquid recirculates back through the evaporator (by gravity or a pump) while only vapor is drawn off to the compressor. Because the entire heat transfer surface stays wetted with liquid rather than dry, superheated "wasted" surface near the coil outlet, flooded evaporators achieve a higher, more uniform heat transfer coefficient. This comes at the cost of more complex piping (surge drums, oil separation) and a larger refrigerant charge, so flooded designs are mainly found in large industrial and ammonia refrigeration systems and large, efficiency-critical chillers.</p>', 3, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'evaporators-and-heat-load'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Evaporator TD, Sensible vs Latent Cooling, and Dehumidification', 'evaporator-td-sensible-vs-latent-cooling-and-dehumidificatio', '<h3>At a glance</h3>
<ul><li>TD is the gap between entering air and coil saturation temp.</li><li>Comfort coils typically run a 30-35°F TD.</li><li>Low TD (10-12°F) cuts dehydration; good for produce coolers.</li><li>Higher TD removes more moisture but adds frost and dehydration risk.</li></ul>
<h3>The full picture</h3>
<p><strong>TD (temperature difference)</strong> is the difference between the entering air temperature and the evaporator''s saturation temperature, and it is a common field rule of thumb for sizing and evaluating coil performance without extensive calculation. Comfort cooling coils are commonly designed around a TD of roughly 30 to 35°F (for example, 75°F return air with an evaporator saturation temperature near 40°F). Refrigeration coolers intentionally use different TDs depending on the humidity needs of the stored product:</p><ul><li><strong>Low TD coils (roughly 10 to 12°F):</strong> A larger coil running a warmer evaporator temperature relative to the box. This removes less moisture from the air, reducing frost buildup and, importantly, reducing product dehydration/weight loss &mdash; valuable for produce and floral coolers where humidity retention matters.</li><li><strong>Medium/high TD coils (roughly 15 to 20°F or more):</strong> A smaller, less expensive coil running a colder evaporator temperature. This removes more moisture from the air (more dehumidification) but increases frost accumulation and product dehydration risk.</li></ul><p>This connects directly to <strong>sensible vs latent heat</strong> removal. Sensible heat removal lowers the dry-bulb (measurable) temperature of air without changing its moisture content. Latent heat removal condenses moisture out of the air onto the coil surface &mdash; dehumidification &mdash; and only occurs when the coil surface temperature is below the air''s dew point. Total cooling capacity is the sum of sensible and latent effects; a colder coil (higher TD) removes proportionally more latent heat (moisture) than a warmer coil (lower TD) handling the same load.</p>', 4, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'evaporators-and-heat-load'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Frost, Ice, and Defrost Necessity', 'frost-ice-and-defrost-necessity', '<h3>At a glance</h3>
<ul><li>Frost forms whenever coil surface hits 32°F or below.</li><li>Frost is normal on refrigeration coils, abnormal on AC coils.</li><li>Frost restricts airflow and insulates the coil, cutting capacity.</li><li>Defrost methods: off-cycle, electric, and hot gas defrost.</li></ul>
<h3>The full picture</h3>
<p>Frost and ice form on evaporator surfaces whenever the coil surface temperature is at or below 32°F while moisture-laden air passes over it; the moisture sublimates or freezes directly onto the fins. As frost builds, it progressively restricts airflow and insulates the coil, reducing heat transfer, and can eventually block airflow through the coil entirely if left unaddressed.</p><p>Frost is a normal, expected condition on most medium- and low-temperature refrigeration coils, since their evaporator temperatures routinely run below freezing. On an air conditioning coil, however, which normally operates well above 32°F, visible frost is abnormal and signals a fault such as low airflow (dirty filter, failed blower) or low refrigerant charge dropping coil temperature too low.</p><p>Because frost accumulation is unavoidable on sub-freezing coils, refrigeration systems require a scheduled or controlled <strong>defrost cycle</strong> to periodically melt it and restore capacity. Common methods include: <strong>off-cycle defrost</strong>, where warmer box air is circulated across the coil during scheduled compressor-off periods (used on medium-temperature applications where the box stays above freezing); <strong>electric defrost</strong>, using resistance heating elements embedded in or near the coil; and <strong>hot gas defrost</strong>, which routes hot compressor discharge gas directly through the evaporator to melt frost quickly, commonly used on low-temperature freezer applications where box air alone is too cold to defrost the coil. Defrost frequency and duration are typically governed by a time clock, temperature or pressure-differential sensing, or demand-based defrost controls.</p>', 5, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'evaporators-and-heat-load'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Basic Heat Load Concepts: Why a Box Runs Warm', 'basic-heat-load-concepts-why-a-box-runs-warm', '<h3>At a glance</h3>
<ul><li>Heat loads include transmission, infiltration, product, and respiration load.</li><li>Internal loads: lighting, motors, workers, defrost heaters add heat.</li><li>Rule out load-side causes before assuming a refrigerant fault.</li><li>Propped doors or big warm-product loads often explain a warm box.</li></ul>
<h3>The full picture</h3>
<p>A technician does not need to perform a full engineering load calculation to understand why a refrigerated space is running warmer than it should. Recognizing the basic categories of heat load helps separate a genuine mechanical/refrigerant problem from a load problem the equipment simply was not sized to handle at that moment.</p><table><thead><tr><th>Load Type</th><th>Description</th><th>Example</th></tr></thead><tbody><tr><td>Sensible (transmission)</td><td>Heat conducting through insulated walls, ceiling, and floor due to the temperature difference between inside and outside</td><td>Damaged, wet, or aged insulation increasing heat gain</td></tr><tr><td>Latent (infiltration moisture)</td><td>Moisture entering with outside/warm air that must be condensed out</td><td>Humid outside air entering through door openings</td></tr><tr><td>Infiltration</td><td>Outside air entering through door openings or gaps, carrying both sensible and latent heat</td><td>A dock door propped open during receiving</td></tr><tr><td>Product load</td><td>Heat that must be removed from product entering the box above box temperature, including freezing water content if applicable</td><td>A large delivery of warm product loaded all at once</td></tr><tr><td>Respiration load</td><td>Heat generated by living produce continuing to respire even in cold storage</td><td>Fresh fruits and vegetables in a produce cooler</td></tr><tr><td>Internal/motor loads</td><td>Heat from lighting, workers, evaporator fan motors, and defrost heaters, all of which ultimately become heat load inside the space</td><td>Lights left on, or a defrost cycle running longer than necessary</td></tr></tbody></table><p>When a box "won''t hold temperature" but refrigerant charge, superheat, and subcooling all check out normal, the cause is often on the load side rather than the mechanical side: doors propped open (infiltration), a large batch of warm product loaded without allowing pull-down time (product load), failed door gaskets or lights left on (internal load), or a defrost cycle running too frequently or too long (added heat). Ruling out these load-related causes before assuming a refrigerant or mechanical fault saves significant diagnostic time.</p>', 6, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'evaporators-and-heat-load'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of evaporators & heat load you only <em>think</em> you know.</p>
<div data-interactive="hvacr-calc-classify" data-set="heat-load"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'evaporators-and-heat-load'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="evaporators"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'evaporators-and-heat-load'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 9. Refrigerant System Components
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Refrigerant System Components', 'refrigerant-system-components',
       'Identify the function and placement of major refrigerant system components in a basic refrigeration circuit.',
       9, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Refrigerant System Components takes about <strong>35 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Identify the function and placement of major refrigerant system components in a basic refrigeration circuit</li><li>Explain how filter-driers, suction accumulators, and receivers protect the compressor and system</li><li>Describe the purpose of oil separators, solenoid valves, and check valves in system control</li><li>Interpret sight glass indications for moisture content and flash gas</li><li>Locate and safely use service valves and gauge ports during service procedures</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-component-map"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerant-system-components'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Liquid Line Filter-Driers', 'liquid-line-filter-driers', '<h3>At a glance</h3>
<ul><li>Removes moisture, acid, and debris from the liquid line.</li><li>Desiccant core bonds with water; screen traps particulates.</li><li>Moisture causes freeze-ups, acids, and winding/plating damage.</li><li>Replace after burnout, opened circuit, or excess pressure drop.</li></ul>
<h3>The full picture</h3>
<p>A filter-drier is installed in the liquid line, typically after the condenser or receiver and before the metering device, to remove moisture, acid, and particulate contamination from the refrigerant. The drier core contains a desiccant material (such as molecular sieve, activated alumina, or silica gel) that chemically bonds with water molecules, along with a filtering screen that traps metal filings, sludge, and other debris that could clog the metering device.</p><p>Moisture in a system is dangerous because it can freeze at the metering device orifice (causing intermittent restriction), react with refrigerant and oil to form acids, and contribute to copper plating and motor winding breakdown in hermetic compressors. Acid removal is especially critical after a compressor burnout, where high heat breaks down refrigerant and oil into corrosive acids that must be filtered out before a replacement compressor is installed.</p><p>Filter-driers should be replaced any time the refrigerant circuit is opened for repair, after a compressor burnout (often requiring a high-capacity acid-removal drier and a suction line drier as well), or when a pressure drop test across the drier shows excessive restriction — a temperature drop of more than 3°F (about 1.7°C) across the drier, or a visibly cooler/frosted outlet, indicates the drier is restricted and should be changed.</p><p>Bidirectional filter-driers are used in heat pump liquid lines because refrigerant flow reverses between heating and cooling modes; these driers filter effectively in either flow direction, unlike a standard one-way drier.</p>', 1, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerant-system-components'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Suction Line Accumulators', 'suction-line-accumulators', '<h3>At a glance</h3>
<ul><li>Prevents liquid and oil slugs from reaching the compressor.</li><li>Liquid and oil settle in the shell; vapor exits to compressor.</li><li>A metered bleed hole slowly returns oil and liquid safely.</li><li>Critical on heat pumps during defrost and variable loads.</li></ul>
<h3>The full picture</h3>
<p>A suction accumulator is installed in the suction line between the evaporator outlet and the compressor inlet. Its primary job is to prevent liquid refrigerant and oil slugs from reaching the compressor, which can cause valve damage, broken connecting rods, or hydraulic lock on reciprocating compressors, and can wash oil out of the crankcase leading to bearing failure.</p><p>Inside the accumulator, refrigerant vapor and any entrained liquid enter and slow down; liquid refrigerant and oil drop to the bottom of the shell due to gravity and reduced velocity, while vapor exits toward the compressor. A metered bleed hole (or U-tube pickup) at the bottom of the accumulator allows a small, controlled amount of liquid and oil to be reintroduced into the suction gas gradually, so it can boil off safely before reaching the compressor while still returning oil to keep the compressor lubricated.</p><p>Accumulators are especially important on heat pump systems, where a reversing valve and variable outdoor loads increase the risk of liquid floodback during defrost cycles or low-load conditions, and on systems where evaporator loading varies significantly (such as low ambient startup or a wide range of operating conditions).</p>', 2, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerant-system-components'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Receivers and King Valves', 'receivers-and-king-valves', '<h3>At a glance</h3>
<ul><li>Receiver stores a liquid refrigerant reserve after the condenser.</li><li>King valve isolates the receiver, used for pump-down service.</li><li>Receiver systems need head pressure control in cold ambients.</li><li>No-receiver systems are critically charged; exact charge matters.</li></ul>
<h3>The full picture</h3>
<p>A receiver is a storage vessel for liquid refrigerant, installed in the liquid line downstream of the condenser. It allows the system to hold a reserve of liquid refrigerant so the metering device always has a full column of liquid to work with, even as system load and refrigerant charge distribution change across the condenser and evaporator under varying operating conditions.</p><p>The king valve is a manual shutoff valve located at the outlet of the receiver. It allows a technician to isolate the receiver from the rest of the system, which is the standard method for pumping down a system: closing the king valve while running the compressor draws refrigerant out of the low side and stores it in the receiver and condenser, allowing repairs to be made on the low side without recovering the full system charge.</p><p>Systems that use a receiver are called flooded or receiver-controlled systems and typically also require a differential pressure or head pressure control to make sure the condenser produces enough pressure to push liquid into the receiver, especially at low ambient outdoor temperatures. Systems without a receiver are considered critically charged, meaning the exact refrigerant charge is calculated for the specific line set and equipment, and even small charge errors significantly affect performance.</p>', 3, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerant-system-components'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Oil Separators', 'oil-separators', '<h3>At a glance</h3>
<ul><li>Installed right after the compressor to remove entrained oil.</li><li>Baffles and coalescing filters knock oil out of hot gas.</li><li>Collected oil returns to the crankcase via a float valve.</li><li>Poor oil return starves compressor lubrication, causing bearing failure.</li></ul>
<h3>The full picture</h3>
<p>An oil separator is installed in the discharge line, immediately after the compressor, on systems where oil management is a concern — commonly on commercial refrigeration racks, low-temperature systems, systems with long piping runs, or systems using reciprocating or screw compressors that carry more oil in the discharge gas than typical residential equipment.</p><p>The separator uses a combination of reduced velocity, baffles, and sometimes a coalescing filter or mesh screen to knock oil droplets out of the hot discharge vapor. The collected oil settles to the bottom of the separator and is returned to the compressor crankcase through a float valve or metered orifice, while the oil-depleted refrigerant vapor continues on to the condenser.</p><p>Without adequate oil return, oil can accumulate in the evaporator and long suction lines, reducing heat transfer efficiency (oil coats tube walls, insulating the refrigerant from the metal) and eventually starving the compressor of the lubrication it needs, leading to bearing and bushing failure.</p>', 4, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerant-system-components'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Solenoid Valves and Check Valves', 'solenoid-valves-and-check-valves', '<h3>At a glance</h3>
<ul><li>Solenoids stop liquid flow for pump-down when compressor cycles off.</li><li>Also used for hot gas defrost and hot gas bypass.</li><li>Check valves allow one-way flow, bypassing unused metering devices.</li><li>Let heat pumps meter correctly in both flow directions.</li></ul>
<h3>The full picture</h3>
<p>A solenoid valve is an electrically operated valve consisting of a coil and a plunger or piston that opens or closes a valve port when energized or de-energized. In the liquid line, a solenoid valve is commonly used just ahead of the metering device to stop refrigerant flow into the evaporator when the compressor cycles off — this is called a pump-down control strategy, and it prevents liquid refrigerant from migrating into the evaporator or crankcase during the off cycle, reducing the risk of flooded starts and liquid floodback.</p><p>Solenoid valves are also used for hot gas defrost (routing hot discharge gas to the evaporator), hot gas bypass (for capacity control and low-load head pressure control), and multi-circuit systems where individual evaporators or zones need independent on/off control while sharing a common condensing unit.</p><p>A check valve is a one-way valve that allows refrigerant flow in only one direction, using a spring-loaded disc or ball. In heat pump systems, check valves are placed in parallel with the indoor and outdoor metering devices (often each with its own bypass check valve) so that refrigerant can bypass a non-functioning metering device and flow freely in the direction not needed for metering, while being forced through the correct metering device in the direction that is needed — this allows a single set of components to work correctly in both heating and cooling mode as the reversing valve changes refrigerant flow direction.</p>', 5, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerant-system-components'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Sight Glasses, Service Valves, and the Complete System', 'sight-glasses-service-valves-and-the-complete-system', '<h3>At a glance</h3>
<ul><li>Clear liquid is normal; bubbles signal charge or restriction issues.</li><li>Built-in moisture indicator changes color for wet vs. dry.</li><li>Service valves give access for gauges, recovery, and charging.</li><li>Tracing full component flow helps pinpoint where problems originate.</li></ul>
<h3>The full picture</h3>
<p>A sight glass is a small window installed in the liquid line, usually after the receiver or filter-drier, that allows visual inspection of the refrigerant. Clear, bubble-free liquid indicates a properly charged system under normal conditions. Bubbles or foam in the sight glass (flash gas) usually indicate a low refrigerant charge, a restriction upstream (such as a clogged drier or partially closed valve), or non-condensables in the system — though a brief flash of bubbles right after compressor shutdown or startup can be normal.</p><p>Many sight glasses include a built-in moisture indicator, a chemical element that changes color (commonly green for dry, yellow or pink for wet) based on the moisture content of the refrigerant, giving a quick field check of whether the filter-drier is doing its job.</p><p>Service valves — including the compressor''s suction and discharge service valves, king valves, and dedicated gauge ports (schrader valves or ball valve ports) — provide the access points a technician uses to connect gauges, recover refrigerant, evacuate the system, and add charge. Understanding how all these components fit together — compressor, condenser, receiver with king valve, filter-drier, sight glass, solenoid and check valves, metering device, evaporator, accumulator, and back to the compressor — lets a technician trace refrigerant flow through a full schematic, predict what a symptom at one point (like bubbles in the sight glass or a frosted drier) means for the rest of the circuit, and pinpoint where a problem originates.</p>', 6, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerant-system-components'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of refrigerant system components you only <em>think</em> you know.</p>
<div data-interactive="hvacr-label" data-set="components"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerant-system-components'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="system-components"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'refrigerant-system-components'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 10. Electrical Fundamentals for HVAC/R
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Electrical Fundamentals for HVAC/R', 'electrical-fundamentals-for-hvac-r',
       'Apply Ohm''s law to calculate voltage, current, and resistance in basic HVAC/R circuits.',
       10, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Electrical Fundamentals for HVAC/R takes about <strong>38 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Apply Ohm''s law to calculate voltage, current, and resistance in basic HVAC/R circuits</li><li>Differentiate series and parallel circuits and single-phase versus three-phase power</li><li>Identify common HVAC/R electrical components and describe their function</li><li>Read a basic ladder wiring diagram to trace circuit operation</li><li>Use a multimeter safely to measure voltage, continuity, resistance, and capacitance and diagnose common electrical failures</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-control-circuit"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'electrical-fundamentals-for-hvac-r'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Basic Circuit Concepts and Ohm''s Law', 'basic-circuit-concepts-and-ohm-s-law', '<h3>At a glance</h3>
<ul><li>Ohm''s law: Voltage = Current x Resistance (E = I x R).</li><li>Power (watts) = Voltage x Current; sizes wiring and breakers.</li><li>Series circuits: same current; one open part stops everything.</li><li>Parallel circuits: same voltage; current divides among branches.</li></ul>
<h3>The full picture</h3>
<p>Every electrical circuit involves three fundamental quantities: voltage (electrical potential difference, measured in volts, the force pushing electrons through a circuit), current (the rate of electron flow, measured in amperes), and resistance (the opposition to current flow, measured in ohms). These three quantities are related by Ohm''s law: <strong>Voltage (E) = Current (I) x Resistance (R)</strong>, often written as E = I x R. This can be rearranged to solve for any unknown value: I = E / R, or R = E / I.</p><p>Power, measured in watts, is calculated as P = E x I (voltage times current), and is useful for sizing wiring, breakers, and understanding heat generation in components. Technicians use Ohm''s law constantly: for example, if a 24V control transformer secondary is feeding a circuit with 40 ohms of resistance, the current draw would be I = 24 / 40 = 0.6 amps.</p><p>In a series circuit, components are connected end-to-end along a single path, so the same current flows through every component, and total resistance is the sum of individual resistances (R-total = R1 + R2 + R3...). If one component in a series circuit fails open, the entire circuit stops working — this is why a single blown thermal fuse or open safety switch can shut down an entire control circuit.</p><p>In a parallel circuit, components are connected across common points, so voltage is the same across each branch, but current divides among the branches based on each branch''s resistance, and total resistance is always less than the smallest individual resistance. Most HVAC/R control circuits combine both series (safety switches, contacts) and parallel (multiple loads sharing a common voltage source) wiring.</p>', 1, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'electrical-fundamentals-for-hvac-r'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'AC Power: Single-Phase, Three-Phase, and Voltage Levels', 'ac-power-single-phase-three-phase-and-voltage-levels', '<h3>At a glance</h3>
<ul><li>Residential equipment uses single-phase 120V/240V line power.</li><li>Larger equipment uses three-phase power (208/240/480V).</li><li>Control circuits run on 24V AC via a step-down transformer.</li><li>Single-phasing drops one leg, causing motor overheating.</li></ul>
<h3>The full picture</h3>
<p>Residential and light commercial HVAC/R equipment typically runs on single-phase AC power, most commonly 120V or 240V (in North America), where voltage rises and falls in one continuous sine wave. Larger commercial and industrial equipment often uses three-phase power (commonly 208V, 240V, or 480V), which uses three separate sine waves offset by 120 degrees from each other, allowing more efficient power delivery and smoother torque in larger motors and compressors.</p><p>Within any given system, there are generally two distinct voltage levels at play: line voltage (the incoming power supply voltage, such as 120V, 208V, 240V, or 480V) that runs the compressor, fan motors, and heating elements directly, and control voltage — almost always 24V AC in residential and light commercial systems — that operates thermostats, relays, and contactor coils. A step-down transformer reduces line voltage to 24V for the control circuit, isolating the low-voltage thermostat wiring from dangerous line voltages while still allowing it to control high-power loads through relays and contactors.</p><p>Three-phase equipment is also vulnerable to a specific failure mode called single-phasing, where one of the three incoming phases is lost (due to a blown fuse, loose connection, or utility issue) while the motor continues trying to run on the remaining two phases, drawing excessive current and quickly overheating the windings.</p>', 2, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'electrical-fundamentals-for-hvac-r'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key Components: Contactors, Relays, and Capacitors', 'key-components-contactors-relays-and-capacitors', '<h3>At a glance</h3>
<ul><li>Contactors and relays use low-voltage coils to switch higher-current loads.</li><li>Run capacitors stay energized, improving motor efficiency and torque.</li><li>Start capacitors give a brief boost, then switch out.</li><li>Shorted caps cause humming/high amps; open caps block starting.</li></ul>
<h3>The full picture</h3>
<p>A contactor is an electromechanical switch that uses a low-voltage coil to pull in a set of higher-current contacts, allowing a 24V control signal to energize a compressor or condenser fan motor circuit running on line voltage. Relays operate on the same basic principle but are generally used for lower-current loads, such as switching a fan relay circuit or an indoor blower motor''s low-speed tap.</p><p>Capacitors store and release electrical energy to assist motor operation. A run capacitor stays in the circuit continuously while the motor runs, shifting the phase of current in the start winding to create a rotating magnetic field and improve running efficiency and torque; it is used on single-phase PSC (permanent split capacitor) motors. A start capacitor provides a much larger, short-duration boost of capacitance to help a motor overcome initial starting torque, and is switched out of the circuit (typically by a potential or current relay) once the motor reaches a percentage of running speed — start capacitors are found on hard-start kits and some compressor applications.</p><p>A shorted capacitor will typically cause a motor to hum, draw high amperage, and trip on overload without starting, while an open (failed) capacitor often prevents the motor from starting at all or causes it to start with a noticeable delay and struggle to reach speed. Capacitor values are rated in microfarads (µF) with a tolerance range, and a capacitance reading outside that tolerance (measured with a multimeter''s capacitance function, with the capacitor discharged and disconnected) confirms the need for replacement.</p>', 3, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'electrical-fundamentals-for-hvac-r'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Motors, Transformers, and Overcurrent Protection', 'motors-transformers-and-overcurrent-protection', '<h3>At a glance</h3>
<ul><li>PSC motors run fixed speed with a permanent run capacitor.</li><li>ECM motors are variable-speed, efficient, and harder to diagnose.</li><li>Transformers step line voltage down to 24V for controls.</li><li>Fuses, breakers, and overloads each guard against overcurrent differently.</li></ul>
<h3>The full picture</h3>
<p>PSC (permanent split capacitor) motors are the traditional single-phase induction motor design used for decades in condenser fans and blower motors; they run at a fixed speed determined by the number of poles and line frequency, use a run capacitor permanently wired in the circuit, and are relatively simple and inexpensive but less efficient, especially at lower speeds or partial loads.</p><p>ECM (electronically commutated motor) motors use a built-in or associated electronic control module that converts AC power to DC and drives a brushless DC motor, allowing for variable speed operation, torque or airflow-matching control algorithms, and significantly higher efficiency across a range of operating speeds. ECMs communicate with the control board via low-voltage signal wires (in addition to power wires) and require different diagnostic approaches than PSC motors — a technician generally cannot diagnose an ECM by simply checking winding resistance the way they would a PSC motor, since the module''s internal electronics must also be considered.</p><p>Transformers step voltage up or down using primary and secondary windings linked by a magnetic field; HVAC/R control transformers commonly step 120V or 240V down to 24V for the control circuit. Fuses, circuit breakers, and overloads all provide overcurrent protection but work differently: fuses use a metal element that melts and opens the circuit at a specific current, providing one-time protection; circuit breakers use a bimetal element or magnetic trip mechanism that can be reset after tripping; and overloads (built into or external to a motor) monitor motor current and/or temperature, opening the circuit to protect the motor winding from an overcurrent or overheat condition, and often reset automatically once temperature drops.</p>', 4, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'electrical-fundamentals-for-hvac-r'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Reading a Basic Ladder Diagram', 'reading-a-basic-ladder-diagram', '<h3>At a glance</h3>
<ul><li>Ladder rungs run in parallel between two power rails.</li><li>Series-wired safety devices can shut down the compressor.</li><li>Diagrams show components in their normal, de-energized resting state.</li><li>Misreading a switch''s resting state is a common misdiagnosis.</li></ul>
<h3>The full picture</h3>
<p>A ladder diagram (or line diagram) represents a control circuit as a set of horizontal ''rungs'' connected between two vertical power rails — typically labeled L1 (hot) and L2 or the transformer secondary and common, in a 24V control circuit. Each rung represents a parallel path containing switches, contacts, or safety devices in series with a load (a coil, relay, or indicator light), and reading the diagram left to right, top to bottom, lets a technician trace how power flows to energize each load.</p><p>Ladder diagrams place safety and limit devices in series within the rung leading to a component they protect — for example, a high-pressure control and a low-pressure control are typically wired in series in the rung feeding the compressor contactor coil, meaning if either safety opens, the contactor de-energizes and the compressor stops, regardless of what the thermostat is calling for.</p><p>Components on the diagram are usually shown in their normal, de-energized state (contacts open or closed as they sit with no power applied), which is critical to understand when troubleshooting — a normally closed (N.C.) switch that should be closed at rest but reads open with a meter indicates a failure, while assuming the wrong resting state can lead to a misdiagnosis.</p>', 5, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'electrical-fundamentals-for-hvac-r'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Multimeter Use and Common Electrical Failures', 'multimeter-use-and-common-electrical-failures', '<h3>At a glance</h3>
<ul><li>Measure voltage live in parallel; measure resistance de-energized.</li><li>Continuity tests check fuses, switches, and overloads for failure.</li><li>Fully discharge capacitors before measuring, even when power is off.</li><li>Open windings read infinite resistance; shorted windings read very low.</li></ul>
<h3>The full picture</h3>
<p>A digital multimeter (DMM) is used to measure voltage (AC or DC), resistance, continuity, and often capacitance. When measuring voltage, the meter is connected across a live circuit (in parallel) with power on, and proper PPE (insulated gloves, safety glasses) should be used, along with confirming meter leads and settings before contacting any live terminal. When measuring resistance or continuity, the circuit must be de-energized and, ideally, the component isolated (disconnected) from the rest of the circuit, since resistance readings on a powered circuit or with parallel paths still connected can give false results.</p><p>Continuity testing (often shown as a low resistance reading or an audible tone) confirms a complete path exists through a wire, switch, or winding, and is commonly used to check fuses, safety switches, and thermal overloads for a good (closed) or failed (open) condition. Capacitance testing requires the capacitor be fully discharged first (by shorting the terminals with an insulated tool or discharge resistor) before removing it from the circuit and measuring; never assume a capacitor is discharged just because the unit is powered off, as capacitors can hold a dangerous charge after power is removed.</p><p>An open winding in a motor or compressor reads as infinite resistance (no continuity) between the winding terminals, meaning the winding is broken and the motor cannot run at all. A shorted winding typically reads an abnormally low resistance and may trip breakers or overloads quickly due to excessive current draw. Welded (stuck-closed) contactor points occur when arcing pits and fuses the contacts together, causing the load (often the compressor) to run continuously even when the thermostat is satisfied and the contactor coil is de-energized — this is a common cause of a compressor that will not shut off. Single-phasing, common on three-phase equipment, occurs when one leg of power is lost, causing the motor to overheat rapidly while drawing excessive current on the remaining phases, and is usually caught by overload protection before permanent damage occurs, provided the overloads are functioning correctly.</p>', 6, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'electrical-fundamentals-for-hvac-r'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of electrical fundamentals for hvac/r you only <em>think</em> you know.</p>
<div data-interactive="hvacr-label" data-set="circuit"></div>
<div data-interactive="hvacr-classify" data-set="capacitor"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'electrical-fundamentals-for-hvac-r'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="electrical-fundamentals"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'electrical-fundamentals-for-hvac-r'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 11. Controls & Safety Devices
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Controls & Safety Devices', 'controls-and-safety-devices',
       'Differentiate types of thermostats and describe how each controls equipment operation.',
       11, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Controls & Safety Devices takes about <strong>36 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Differentiate types of thermostats and describe how each controls equipment operation</li><li>Explain the function of low-pressure and high-pressure controls in protecting refrigeration systems</li><li>Describe common defrost strategies and defrost methods used on refrigeration and heat pump systems</li><li>Identify key safety devices and the specific failure modes each is designed to prevent</li><li>Trace the sequence of operation for a basic refrigeration system''s control circuit</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-control-sequence"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'controls-and-safety-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Thermostats', 'thermostats', '<h3>At a glance</h3>
<ul><li>Mechanical thermostats use bimetal or bellows elements to switch contacts.</li><li>Electronic thermostats use thermistors and microprocessors for tighter control.</li><li>Smart thermostats add Wi-Fi, scheduling, and geofencing features.</li><li>A thermostat call must still pass every series safety device.</li></ul>
<h3>The full picture</h3>
<p>A thermostat is the primary control that senses space or process temperature and signals the system to run or stop to maintain a desired setpoint. Mechanical thermostats use a temperature-sensitive element, such as a bimetal strip or a sealed bellows/bulb filled with a volatile fluid, that physically moves to open or close electrical contacts as temperature changes; they are simple, inexpensive, and reliable but generally less precise and offer no scheduling or diagnostic capability.</p><p>Electronic (digital) thermostats use a thermistor or other electronic sensor to measure temperature and a microprocessor to control staging, timing, and setpoint logic. They typically provide tighter temperature control, programmable schedules, and features like adjustable anticipation, multi-stage heating/cooling control, and lockout timers to prevent short cycling.</p><p>Smart thermostats add connectivity (Wi-Fi), remote access, learning algorithms, occupancy/geofencing detection, and integration with home automation systems, on top of the same core electronic thermostat control logic. Regardless of type, thermostats generally control equipment through low-voltage (24V) signals to relays and contactors rather than switching line voltage directly, and technicians should understand that a thermostat calling correctly does not guarantee the equipment will run — the call must also pass through every safety device wired in series in the control circuit.</p>', 1, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'controls-and-safety-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Pressure Controls', 'pressure-controls', '<h3>At a glance</h3>
<ul><li>Low-pressure control stops the compressor on low suction pressure.</li><li>LPC serves freeze protection and pump-down operating roles.</li><li>High-pressure control stops the compressor on excessive discharge pressure.</li><li>Many HPCs are manual-reset to force root-cause diagnosis.</li></ul>
<h3>The full picture</h3>
<p>A low-pressure control (LPC) monitors suction (low-side) pressure and opens its contacts to stop the compressor when pressure drops below a set point, then closes again once pressure rises back to a set differential. The LPC serves two main functions depending on the application: as a freeze protection device, it prevents the evaporator coil from icing over by stopping the compressor before suction pressure (and corresponding evaporator temperature) drops low enough to freeze condensate on the coil; and as a pump-down control, it acts as the operating control that starts and stops the compressor in a pump-down cycle, cycling off once low-side pressure drops to the cut-out setting after the liquid line solenoid closes.</p><p>A high-pressure control (HPC) monitors discharge (high-side) pressure and opens to stop the compressor if pressure rises above a safe limit, protecting the compressor, condenser, and piping from dangerously high pressures that could result from a dirty condenser coil, condenser fan failure, refrigerant overcharge, or non-condensables (air) in the system. Many high-pressure controls are manual-reset only, meaning they must be physically reset by a technician after tripping, forcing a diagnosis of the root cause before the system is allowed to restart — this is intentional, since automatically restarting into the same high-pressure fault repeatedly can cause compressor damage or a safety hazard.</p><p>On many systems, LPC and HPC functions are combined into a single dual-pressure control housing two independent switches, wired in series in the compressor contactor circuit so that either an abnormally low or abnormally high pressure condition will stop the compressor.</p>', 2, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'controls-and-safety-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Defrost Controls and Strategies', 'defrost-controls-and-strategies', '<h3>At a glance</h3>
<ul><li>Time-temperature defrost runs on a fixed schedule with a termination sensor.</li><li>Demand defrost triggers only when frost is actually detected.</li><li>Electric and hot gas defrost melt frost using different heat sources.</li><li>Reverse cycle defrost is used specifically on heat pumps.</li></ul>
<h3>The full picture</h3>
<p>Any system operating an evaporator coil below approximately 32°F (0°C) surface temperature will accumulate frost, which insulates the coil and reduces heat transfer over time; defrost controls periodically remove this frost buildup. Time-temperature defrost uses a simple timer to initiate defrost at fixed intervals (for example, every 6 hours) regardless of actual frost accumulation, combined with a temperature sensor (defrost termination thermostat) that ends the defrost cycle once the coil reaches a target temperature (confirming frost has melted) or a maximum time limit is reached as a safety backstop.</p><p>Demand defrost is a more efficient strategy that initiates defrost only when actual frost accumulation is detected or calculated, using sensors that measure airflow restriction, coil temperature differential, or elapsed compressor run time combined with ambient conditions, rather than a fixed schedule. This reduces unnecessary defrost cycles, saving energy and reducing wear compared to time-temperature defrost, which may defrost a coil that has little or no frost buildup.</p><p>Electric defrost uses resistance heating elements mounted directly on or near the evaporator coil, energized during the defrost cycle (with the compressor and evaporator fan typically off) to melt frost through direct heat, commonly used on walk-in coolers and some residential freezers. Hot gas defrost redirects hot compressor discharge gas through the evaporator coil (using a solenoid valve) during defrost, using the refrigerant''s own heat to melt frost efficiently without a separate heat source, common in commercial refrigeration. Reverse cycle defrost, used on air-source heat pumps, temporarily switches the reversing valve to send the system into cooling mode, which routes hot discharge gas to the outdoor coil (now acting as the condenser) to melt frost, while the indoor coil temporarily acts as an evaporator — auxiliary or emergency heat is often engaged during this cycle to offset the temporary loss of heating to the space.</p>', 3, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'controls-and-safety-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Safety Devices', 'safety-devices', '<h3>At a glance</h3>
<ul><li>Oil pressure switch protects compressors from inadequate lubrication.</li><li>Internal and external overloads protect motor windings from overheating.</li><li>Freeze stats prevent hydronic coils from freezing and rupturing.</li><li>Fusible plugs and relief valves guard against overpressure.</li></ul>
<h3>The full picture</h3>
<p>Beyond the LPC and HPC already discussed, several other safety devices protect specific components. An oil pressure safety switch (commonly found on larger reciprocating and screw compressors with a separate oil pump) monitors the differential between oil pump discharge pressure and crankcase (suction) pressure; if adequate oil differential pressure is not established within a set time delay after compressor start, the switch trips and shuts the compressor down to prevent bearing damage from inadequate lubrication.</p><p>Motor overloads protect motor windings from overheating due to excess current or ambient temperature. An internal overload is embedded directly within the motor windings (thermally connected to sense actual winding temperature) and typically resets automatically once the motor cools. An external overload is mounted outside the motor, often on the compressor terminal box or in the control panel, sensing current draw (and sometimes temperature) from outside the winding; some are automatic reset while others require manual reset, and external overloads generally respond somewhat slower than internal overloads since they are not in direct thermal contact with the windings.</p><p>A freeze stat (freezestat) is a safety control, commonly used on air handlers with hydronic coils or in some refrigeration applications, that senses low coil or air temperature and shuts down the system (or opens a valve) to prevent a coil from freezing and rupturing. A fusible plug is a safety device containing a metal alloy that melts at a specific temperature, venting refrigerant to relieve pressure in the event of a fire or extreme overpressure condition, commonly found on receivers and refrigerant cylinders. A relief valve (pressure relief valve) performs a similar overpressure protection function using a spring-loaded mechanism that opens at a set pressure and recloses once pressure drops, rather than permanently venting the entire charge as a fusible plug does.</p>', 4, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'controls-and-safety-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Sequence of Operation for a Basic Refrigeration Control Circuit', 'sequence-of-operation-for-a-basic-refrigeration-control-circ', '<h3>At a glance</h3>
<ul><li>Thermostat call opens the liquid line solenoid to start flow.</li><li>LPC closes on rising suction pressure, starting the compressor.</li><li>Satisfied thermostat triggers pump-down, then closes the compressor.</li><li>HPC can stop the compressor anytime, overriding thermostat and LPC.</li></ul>
<h3>The full picture</h3>
<p>Consider a basic commercial refrigeration system with a thermostat, dual-pressure control, liquid line solenoid valve, and pump-down control scheme. When the thermostat calls for cooling (space temperature rises above setpoint), it energizes the liquid line solenoid valve, which opens and allows liquid refrigerant to flow to the metering device and evaporator. As pressure rises on the low side (from the compressor''s prior pump-down cycle bringing pressure down), the low-pressure control contacts close once suction pressure reaches its cut-in setting, energizing the compressor contactor coil (assuming the high-pressure control contacts are also closed, since both are wired in series) and starting the compressor.</p><p>The system runs, removing heat from the refrigerated space, until the thermostat is satisfied (space temperature drops to setpoint) and de-energizes the liquid line solenoid valve. The solenoid closes, stopping liquid flow to the evaporator, but the compressor continues running momentarily, pumping down the remaining refrigerant in the low side into the receiver and condenser. As low-side pressure falls, the low-pressure control (now acting as the compressor''s operating control in this cycle) opens its contacts once pressure reaches the cut-out setting, de-energizing the compressor contactor and stopping the compressor — completing the pump-down.</p><p>If at any point during operation discharge pressure rises above the high-pressure control''s set point (from a dirty condenser, fan failure, or overcharge), its contacts open, immediately de-energizing the compressor contactor regardless of what the thermostat or low-pressure control are doing, and (if manual reset) keeping the compressor locked out until a technician resets the control after correcting the fault. This layered interaction — thermostat for setpoint demand, LPC for both freeze protection and pump-down operating control, and HPC for compressor and system protection — illustrates how multiple controls work together in series and in sequence to both maintain the desired temperature and protect the equipment from damaging operating conditions.</p>', 5, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'controls-and-safety-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of controls & safety devices you only <em>think</em> you know.</p>
<div data-interactive="hvacr-label" data-set="safety-devices"></div>', 6, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'controls-and-safety-devices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="controls-safety-devices"></div>', 7, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'controls-and-safety-devices'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 12. Psychrometrics & Dehumidification
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Psychrometrics & Dehumidification', 'psychrometrics-and-dehumidification',
       'Define psychrometrics and identify the key properties of moist air used to describe its condition.',
       12, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Psychrometrics & Dehumidification takes about <strong>35 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Define psychrometrics and identify the key properties of moist air used to describe its condition</li><li>Explain how a psychrometric chart is organized and trace a cooling-coil process across it</li><li>Calculate and interpret sensible heat ratio (SHR) for a cooling/dehumidification process</li><li>Compare refrigerant-based (DX coil) dehumidification with desiccant dehumidification and identify when each is preferred</li><li>Identify common dehumidifier system types and explain the practical consequences of poor humidity control</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-psychrometric-chart"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'What Is Psychrometrics?', 'what-is-psychrometrics', '<h3>At a glance</h3>
<ul><li>Studies moisture in air and its effects on comfort, equipment, storage.</li><li>Changing temperature alone shifts RH even without added moisture.</li><li>Lets techs tell a real moisture problem from air that just feels humid.</li><li>Core language for sizing dehumidifiers and explaining performance ratings.</li></ul>
<h3>The full picture</h3>
<p>Psychrometrics is the branch of engineering that studies the physical and thermodynamic properties of moist air &mdash; that is, mixtures of dry air and water vapor. Every technician who works on air conditioning, refrigeration, or dehumidification equipment is, whether they realize it or not, managing psychrometric processes. Air is never just "air"; it is always a mixture of dry gas plus some amount of water vapor, and that water vapor content dramatically affects comfort, equipment performance, condensation risk, and product quality in storage or process environments.</p><p>Because moist air properties are interrelated, changing one property (for example, temperature) changes others (relative humidity) even if the actual moisture content of the air has not changed. Understanding these relationships lets a technician diagnose problems correctly &mdash; for instance, distinguishing a genuine excess-moisture-load problem from a simple case of air that feels humid because it is warm.</p><p>For a company that designs, sells, or services dehumidification equipment, psychrometrics is the technical language used to size equipment, explain performance ratings (such as pints-per-day removal at AHAM test conditions), and diagnose field complaints. A technician fluent in psychrometrics can explain <em>why</em> a unit is or is not performing, not just swap parts.</p>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key Properties of Moist Air', 'key-properties-of-moist-air', '<h3>At a glance</h3>
<ul><li>Dry-bulb is plain temperature; wet-bulb is cooled by evaporation.</li><li>Dew point is where condensation starts forming on cold surfaces.</li><li>RH shifts with temperature; humidity ratio only changes with real moisture.</li><li>Enthalpy is total heat content (sensible plus latent) per pound of air.</li></ul>
<h3>The full picture</h3>
<p>Several measurable and derived properties describe the state of moist air at any given point. A technician should be able to define each and understand how they relate to one another.</p><ul><li><strong>Dry-bulb temperature (DB):</strong> The temperature of air measured by an ordinary thermometer, unaffected by moisture. This is the temperature most people mean when they say "the temperature."</li><li><strong>Wet-bulb temperature (WB):</strong> The temperature read by a thermometer whose bulb is covered with a water-saturated wick and exposed to moving air. Evaporative cooling of the wick lowers the reading below dry-bulb (except at 100% RH, where WB equals DB). Wet-bulb depression (DB minus WB) is a practical field indicator of how much moisture the air can still absorb.</li><li><strong>Dew point temperature (DP):</strong> The temperature at which air, if cooled at constant pressure with no change in moisture content, would become saturated (100% RH) and begin to condense water. Any surface colder than the surrounding air''s dew point will collect condensation &mdash; this is the single most important concept for diagnosing sweating ducts, coils, windows, and walls.</li><li><strong>Relative humidity (RH):</strong> The ratio of the actual water vapor present in the air to the maximum amount the air could hold at that same dry-bulb temperature, expressed as a percentage. RH is temperature-dependent: the same absolute moisture content produces a lower RH reading as air warms and a higher RH reading as air cools.</li><li><strong>Humidity ratio (absolute humidity), W:</strong> The actual mass of water vapor per unit mass of dry air, typically expressed in grains of moisture per pound of dry air or pounds per pound. Unlike RH, humidity ratio does not change with temperature alone &mdash; it only changes when moisture is actually added or removed. This is the property that matters for sizing dehumidification capacity.</li><li><strong>Enthalpy (h):</strong> The total heat content of the moist air mixture (sensible plus latent heat), usually expressed in Btu per pound of dry air. Enthalpy changes describe the total cooling or heating load a coil must handle.</li><li><strong>Specific volume:</strong> The volume occupied by a unit mass of dry air (plus its associated moisture), used to convert between airflow (CFM) and mass flow rate for load calculations.</li></ul><p>In the field, RH is what most gauges and complaints reference, but humidity ratio and dew point are what actually determine condensation risk and true moisture load. A room can read "60% RH" and be perfectly safe at 75&deg;F, or read "60% RH" and be dangerously wet if that same absolute moisture is present at 55&deg;F &mdash; context and dry-bulb temperature always matter.</p>', 2, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Reading a Psychrometric Chart', 'reading-a-psychrometric-chart', '<h3>At a glance</h3>
<ul><li>Plots dry-bulb temperature against humidity ratio on one chart.</li><li>Saturation curve marks 100% RH; air can''t exist beyond it.</li><li>Cooling moves left (sensible only) until reaching the dew point.</li><li>Past dew point, path follows saturation curve as moisture condenses out.</li></ul>
<h3>The full picture</h3>
<p>The psychrometric chart is a graphical tool that plots all these properties simultaneously so that if you know any two independent properties of an air sample, you can find all the others by locating a single point on the chart.</p><ul><li><strong>Horizontal axis (bottom):</strong> Dry-bulb temperature, increasing left to right.</li><li><strong>Vertical axis (right side):</strong> Humidity ratio (grains or pounds of moisture per pound of dry air), increasing bottom to top.</li><li><strong>Curved boundary line (upper left, sweeping down to the right):</strong> The saturation curve, representing 100% RH. Every point on this curve corresponds to air fully saturated with water vapor at that temperature. No air state can exist above and to the left of this curve under normal atmospheric conditions &mdash; any attempt to push air past it results in condensation (fog or liquid water) removing the excess moisture.</li><li><strong>Curved lines sweeping through the body of the chart:</strong> Constant RH lines (10%, 20%, 30%... up to the 100% saturation curve).</li><li><strong>Diagonal lines running up and to the left:</strong> Lines of constant wet-bulb temperature (which closely parallel, but are not identical to, lines of constant enthalpy).</li><li><strong>Nearly vertical lines:</strong> Lines of constant dew point, which project horizontally to intersect the saturation curve at the corresponding dew-point temperature &mdash; a quick way to read dew point directly off the humidity ratio axis.</li></ul><p>A cooling-and-dehumidification process (typical of an air conditioner or refrigerant dehumidifier cooling coil) traces a path on the chart from the entering air condition down and to the left toward the coil''s effective surface temperature. Initially, while the air is still warmer than its dew point, the process is purely <strong>sensible cooling</strong> &mdash; the point moves horizontally left (temperature drops, humidity ratio unchanged). Once the air reaches its dew point (touches the saturation curve), further cooling forces the point to follow down along the saturation curve as both temperature and humidity ratio drop together &mdash; this segment is where actual moisture removal (latent cooling) occurs, since the excess moisture condenses out on the coil fins. The coil''s actual leaving air condition is a blend of air that fully contacted the cold fin surfaces and bypass air that didn''t, which is why real coils never drive air exactly onto the saturation curve.</p>', 3, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Sensible Heat Ratio and Why Cooling Below Dew Point Dehumidifies', 'sensible-heat-ratio-and-why-cooling-below-dew-point-dehumidi', '<h3>At a glance</h3>
<ul><li>SHR = sensible heat removed divided by total heat removed.</li><li>Comfort systems run ~0.70–0.80 SHR; dehumidifiers run much lower.</li><li>Coil surface must drop below dew point for any moisture removal.</li><li>Warm, dirty, or undercharged coils blow "cold" air but dehumidify poorly.</li></ul>
<h3>The full picture</h3>
<p>Any cooling process removes two kinds of heat: <strong>sensible heat</strong> (which changes dry-bulb temperature, measurable with a thermometer) and <strong>latent heat</strong> (the heat associated with a change of state &mdash; water vapor condensing to liquid &mdash; which changes moisture content without changing temperature during the phase change itself). The <strong>Sensible Heat Ratio (SHR)</strong> is defined as:</p><p><strong>SHR = Sensible heat removed &divide; Total heat removed (sensible + latent)</strong></p><p>An SHR of 1.0 means all cooling is sensible (no dehumidification is occurring at all). An SHR of 0.70, for example, means 70% of the cooling capacity is lowering temperature and 30% is condensing moisture out of the air. Comfort cooling systems are typically designed for an SHR around 0.70&ndash;0.80; dedicated dehumidifiers are deliberately designed for a much lower SHR (more latent capacity relative to sensible) so they pull moisture out efficiently without over-cooling the space.</p><p>The physical reason cooling below the dew point causes dehumidification is straightforward: air can only hold a certain maximum mass of water vapor at a given temperature (the saturation limit defined by the saturation curve). As air passes over a coil whose surface temperature is below the air''s dew point, a thin boundary layer of air in contact with the fin surface is cooled below its dew point and can no longer hold all its water vapor in gaseous form. The excess vapor condenses directly onto the cold fin surface as liquid water, which then drains off through the condensate pan and drain line. If the coil surface temperature stays above the entering air''s dew point, no condensation occurs and the process is 100% sensible &mdash; this is exactly why an air conditioner with a dirty, iced, or improperly charged coil (running too warm) can blow "cold" air that does very little actual dehumidifying.</p><p>Because latent capacity depends on driving coil temperature below the dew point (not just below room temperature), a dehumidifier''s performance is highly sensitive to entering air conditions. As entering air temperature drops, a standard refrigerant dehumidifier''s capacity falls off sharply and eventually the coil may frost, which is why low-temperature spaces require either a hot-gas/electric defrost cycle or an entirely different technology such as desiccant dehumidification.</p>', 4, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Refrigerant (DX Coil) Dehumidification vs. Desiccant Dehumidification', 'refrigerant-dx-coil-dehumidification-vs-desiccant-dehumidifi', '<h3>At a glance</h3>
<ul><li>DX uses a cold coil plus reheat to dry air without overcooling.</li><li>DX works best in warm, moderate-to-high humidity spaces (45°F+).</li><li>DX capacity drops and coils frost below ~40–45°F entering air.</li><li>Desiccants adsorb moisture chemically, working in cold or very dry air.</li></ul>
<h3>The full picture</h3>
<p><strong>Refrigerant-based (DX/mechanical) dehumidification</strong> uses a standard vapor-compression refrigeration circuit: a compressor, condenser, metering device, and evaporator (cooling) coil, exactly like an air conditioner, but typically followed by a reheat coil (often the condenser, reheating the now-dry air back up) so the unit removes moisture without excessively cooling the space. Room air passes across the cold evaporator coil, moisture condenses out as described above, and the reheated, drier air is returned to the space. This is the technology used in nearly all portable and whole-building refrigerant dehumidifiers.</p><ul><li><strong>Best suited for:</strong> Moderate-to-warm, moderate-to-high humidity environments (roughly 45&deg;F and above entering air, with RH above ~35&ndash;40%) &mdash; basements, crawl spaces, pool rooms, general building dehumidification, warehouses, and most residential/light-commercial applications.</li><li><strong>Limitations:</strong> Capacity drops significantly as entering air temperature or humidity falls; below roughly 40&ndash;45&deg;F, coils frost and need defrost cycles, hurting efficiency; cannot practically reach very low humidity ratios (very low dew points) because the evaporator would need to run at damaging sub-freezing temperatures continuously.</li></ul><p><strong>Desiccant dehumidification</strong> uses a hygroscopic material (a substance that chemically or physically attracts and holds water vapor) instead of a cold coil. The two dominant technologies are:</p><ul><li><strong>Solid desiccant wheels (e.g., silica gel):</strong> A slowly rotating wheel impregnated with silica gel (or similar material such as molecular sieve or lithium chloride-treated media) is divided into a process airstream and a reactivation (regeneration) airstream. Moist process air passes through one segment of the wheel and the desiccant adsorbs water vapor from it, delivering very dry air. Meanwhile a separate heated reactivation airstream passes through another segment of the same rotating wheel, driving the absorbed moisture back out (regenerating the desiccant) so that segment can adsorb again once it rotates back into the process stream. This requires a heat source (electric, gas, or waste heat) for regeneration.</li><li><strong>Liquid desiccants (e.g., lithium chloride solutions):</strong> Air is contacted with a hygroscopic liquid salt solution that absorbs moisture; the diluted solution is later regenerated by heating to drive off the absorbed water, concentrating it for reuse. Liquid systems are common in large industrial dehumidification and some specialty applications.</li></ul><p>Desiccant systems do not rely on cooling air below its dew point &mdash; adsorption works via a different physical mechanism (vapor pressure differential at the desiccant surface) that functions even at low temperatures and low humidity ratios, and can drive air to extremely low dew points (well below 0&deg;F) that refrigerant systems cannot reach.</p><ul><li><strong>Best suited for:</strong> Low-temperature spaces (refrigerated warehouses, ice rinks), very low target humidity (pharmaceutical and electronics manufacturing, lithium battery production, museums/archives), and applications needing dew points below what a coil-frost-limited DX system can achieve.</li><li><strong>Trade-offs:</strong> Requires energy input for regeneration heat, generally higher energy cost per unit of moisture removed than DX in moderate conditions, and reactivation air/heat must be exhausted or managed, adding ductwork complexity.</li></ul><p><strong>Rule of thumb for selection:</strong> if the space is warm-to-moderate temperature and moderate-to-high humidity, refrigerant dehumidification is usually more energy-efficient and lower cost. If the space is cold, or the target humidity is very low, desiccant technology is usually required or far more efficient.</p>', 5, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Common Dehumidifier System Types', 'common-dehumidifier-system-types', '<h3>At a glance</h3>
<ul><li>Portable DX units rated in pints removed per day (AHAM).</li><li>Whole-building/ducted DX handles humidity oversized ACs can''t.</li><li>Desiccant units range from small wheels to large industrial systems.</li><li>Hybrid DX-plus-desiccant designs reach very low humidity targets.</li></ul>
<h3>The full picture</h3>
<p><strong>Portable refrigerant dehumidifiers</strong> are self-contained DX units (compressor, evaporator, condenser/reheat coil, fan, and condensate collection all in one cabinet) sized for a single room or small area, common in basements, homes, and job-site moisture control. Capacity is rated in pints of water removed per 24 hours at a standardized AHAM test condition (typically 65&deg;F/60% RH in current standards).</p><p><strong>Whole-building/ducted refrigerant dehumidifiers</strong> are larger DX units, either standalone or integrated with the HVAC ductwork, that dehumidify an entire building or zone. These are common in humid climates where the air conditioning system alone cannot remove enough moisture to maintain comfort and indoor air quality (a common issue with oversized or variable-capacity AC systems that satisfy the thermostat''s temperature setpoint too quickly to run long enough for adequate latent removal).</p><p><strong>Desiccant dehumidifiers</strong> range from small heat-regenerated wheel units for crawl spaces and pools up to large industrial rotary desiccant systems for warehouses, cold storage anterooms, ice rinks, and manufacturing cleanrooms where low-temperature or very-low-humidity performance is required beyond what refrigerant systems can deliver.</p><p>Some hybrid or specialty designs combine a DX pre-cooling stage with a downstream desiccant stage to balance efficiency and reach very low humidity targets, common in demanding industrial process dehumidification.</p>', 6, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practical Implications of Humidity Control', 'practical-implications-of-humidity-control', '<h3>At a glance</h3>
<ul><li>Mold risk rises above ~60–70% RH with organic material present.</li><li>Condensation forms whenever a surface drops below the air''s dew point.</li><li>Sensitive goods (paper, electronics, meds) need tight RH bands.</li><li>In manufacturing, humidity control is process-critical, not just comfort.</li></ul>
<h3>The full picture</h3>
<p><strong>Mold, mildew, and condensation prevention:</strong> Mold growth generally becomes a risk above roughly 60&ndash;70% sustained RH combined with organic material (wood, drywall, dust) as a food source; keeping indoor RH below about 50&ndash;60% substantially reduces this risk. Condensation on cold surfaces (windows, ductwork, pipes, cold water lines) occurs whenever the surface temperature drops below the air''s dew point &mdash; a technician diagnosing "sweating" ducts or pipes should always check insulation and the surrounding air''s dew point, not just assume equipment malfunction.</p><p><strong>Product and material storage:</strong> Many stored goods (paper, electronics, pharmaceuticals, wood products, museum artifacts, ammunition, seeds) are sensitive to moisture absorption, corrosion, or biological growth; warehouses and archives often specify tight RH bands (e.g., 45&plusmn;5% RH) that require properly sized dehumidification, sometimes paired with humidification for the low end.</p><p><strong>Comfort:</strong> Humans perceive comfort based on both dry-bulb temperature and humidity; high RH at a given temperature feels warmer and "stickier" because it reduces the body''s ability to cool itself through evaporation of perspiration, while very low RH causes dry skin, static, and respiratory irritation. This is why comfort standards (such as ASHRAE 55) specify acceptable ranges of both temperature and humidity, not temperature alone.</p><p><strong>Industrial process control:</strong> Many manufacturing processes (pharmaceutical tableting, chocolate and confectionery production, battery manufacturing, semiconductor fabrication, injection molding of hygroscopic plastics) require tightly controlled humidity because moisture affects product quality, chemical reactions, static electricity generation, or material handling properties. In these settings, dehumidification is not a comfort feature but a process-critical utility, and downtime or underperformance of the dehumidification system can directly halt production or cause scrapped product.</p>', 7, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of psychrometrics & dehumidification you only <em>think</em> you know.</p>
<div data-interactive="hvacr-classify" data-set="dehumidify"></div>', 8, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="psychrometrics-dehumidification"></div>', 9, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'psychrometrics-and-dehumidification'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 13. System Types & Applications
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'System Types & Applications', 'system-types-and-applications',
       'Describe the distinguishing characteristics of domestic and commercial refrigeration systems.',
       13, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>System Types & Applications takes about <strong>32 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Describe the distinguishing characteristics of domestic and commercial refrigeration systems</li><li>Explain how comfort air conditioning fits within the broader category of refrigeration systems</li><li>Explain reverse-cycle heat pump operation, including the reversing valve and balance point concept</li><li>Distinguish air-cooled and water-cooled chiller systems and their typical building applications</li><li>Identify industrial/process refrigeration applications and the refrigerants commonly used in them</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-system-types"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Domestic Refrigeration', 'domestic-refrigeration', '<h3>At a glance</h3>
<ul><li>Sealed, factory-charged units with capillary tube metering, no service ports.</li><li>Common refrigerants: R-600a (flammable hydrocarbon) or older R-134a.</li><li>Service is mostly electrical, gaskets, and defrost system repairs.</li><li>Frozen evaporator often means a failed defrost heater, timer, or thermostat.</li></ul>
<h3>The full picture</h3>
<p>Domestic refrigeration refers to household refrigerators and freezers, the most common refrigeration appliance a technician will encounter outside of dedicated HVAC/R trade work. These are sealed, factory-charged systems using a small hermetic compressor, a capillary tube or short length of restrictor tubing as the metering device (rather than a serviceable expansion valve), a static or forced-draft condenser, and one or more evaporators depending on whether the unit uses a single-evaporator design or separate evaporators for the fresh food and freezer compartments.</p><p>Most modern domestic refrigerators use low-GWP refrigerants such as R-600a (isobutane, a flammable hydrocarbon used only in very small factory-sealed charges under 150g) or, in older units, R-134a. Because household refrigerators are entirely factory-sealed with no service ports on most models, field service is largely limited to electrical/control diagnostics, door gasket and defrost system repair, and compressor replacement; refrigerant circuit repairs on a hydrocarbon-charged unit require specific flammable-refrigerant safety precautions and small-charge handling skill.</p><p>Frost-free domestic units use a timed or adaptive-defrost cycle with an electric heater to periodically melt frost off the evaporator, along with a defrost thermostat or thermistor to terminate the heater once the coil is clear &mdash; a very common service call is a frozen-over evaporator coil caused by a failed defrost heater, timer, or thermostat.</p>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Commercial Refrigeration', 'commercial-refrigeration', '<h3>At a glance</h3>
<ul><li>Reach-ins are self-contained; walk-ins use remote condensing units.</li><li>Supermarket racks centralize compressors serving many cases at once.</li><li>Med-temp racks run ~20–35°F; low-temp racks ~-20 to -30°F.</li><li>Ice machines use hot-gas harvest; scale and airflow are top issues.</li></ul>
<h3>The full picture</h3>
<p>Commercial refrigeration covers a wide range of systems that store or display food and other perishables at businesses, from single self-contained units to large centralized systems.</p><ul><li><strong>Reach-in and walk-in coolers/freezers:</strong> Reach-ins are self-contained cabinets (often with a single visible compressor/condenser package) used in restaurants and small retail. Walk-ins are larger insulated rooms with a remote or packaged condensing unit and one or more evaporator coils inside, used for bulk storage in restaurants, grocery, and food distribution. Walk-in coolers typically run box temperatures around 35&ndash;40&deg;F, while walk-in freezers run around -10&deg;F to 0&deg;F.</li><li><strong>Supermarket multiplex (rack) systems:</strong> Rather than giving every case or walk-in its own compressor, supermarkets commonly use a centralized equipment room with multiple compressors piped in parallel (a "rack") feeding a network of display cases and walk-ins throughout the store. Racks are often split into a medium-temperature rack (serving dairy, deli, produce cases, and coolers, roughly 20&ndash;35&deg;F evaporator range) and a low-temperature rack (serving frozen food cases and freezers, roughly -20&deg;F to -30&deg;F evaporator range). This centralized approach improves compressor efficiency and redundancy but means a single rack failure can affect many fixtures at once.</li><li><strong>Ice machines:</strong> Commercial ice makers are self-contained DX refrigeration systems that freeze a thin layer of water onto an evaporator plate or inside evaporator cells, then use a hot-gas (or in some designs a reverse-cycle) harvest cycle to release the formed ice. Common designs include cube, flake, and nugget ice machines, each with different evaporator geometry and harvest methods; water quality (scale buildup) and airflow/condenser cleanliness are the most common service issues.</li></ul>', 2, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Comfort Cooling as a Refrigeration Application', 'comfort-cooling-as-a-refrigeration-application', '<h3>At a glance</h3>
<ul><li>AC uses the same vapor-compression cycle as any refrigeration system.</li><li>Differs mainly in target temperature range and humidity performance focus.</li><li>Common setups: split systems, packaged rooftop units, ductless mini-splits.</li></ul>
<h3>The full picture</h3>
<p>Residential and commercial air conditioning is, fundamentally, a refrigeration application: it uses the same vapor-compression cycle (compressor, condenser, metering device, evaporator) as any other refrigeration system, with the evaporator absorbing heat from indoor air and the condenser rejecting that heat outdoors. What distinguishes comfort cooling from other refrigeration applications is primarily the target temperature range (evaporator conditions designed to cool air to roughly 55&ndash;60&deg;F rather than to preserve food or freeze product) and the emphasis on both sensible and latent (humidity) performance for occupant comfort, as covered in the psychrometrics module.</p><p>Common comfort cooling configurations include split systems (indoor evaporator/air handler connected by refrigerant lines to an outdoor condensing unit), packaged rooftop units (all components in one outdoor cabinet, common on commercial buildings), and ductless mini-split/multi-split systems (one or more indoor evaporator units connected to an outdoor unit without ductwork, popular for additions, retrofits, and zoned comfort control).</p>', 3, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Heat Pumps: Reverse-Cycle Operation', 'heat-pumps-reverse-cycle-operation', '<h3>At a glance</h3>
<ul><li>Reversing valve redirects refrigerant flow to heat or cool the building.</li><li>Outdoor coil frosts in heating mode, requiring periodic defrost cycles.</li><li>Balance point is the outdoor temp where capacity meets building heat loss.</li><li>Below balance point, auxiliary (strip) heat makes up the shortfall.</li></ul>
<h3>The full picture</h3>
<p>A heat pump is mechanically almost identical to an air conditioner, but it is designed to provide both cooling and heating by reversing the direction of refrigerant flow. The key added component is the <strong>reversing valve</strong> (also called a four-way valve), a solenoid-actuated valve that redirects high-pressure discharge gas from the compressor to either the outdoor coil (cooling mode, where the outdoor coil acts as the condenser and the indoor coil as the evaporator) or the indoor coil (heating mode, where the indoor coil becomes the condenser, rejecting heat into the building, and the outdoor coil becomes the evaporator, absorbing heat from outdoor air even at cold temperatures).</p><p>In heating mode, the outdoor coil is extracting heat from outside air that may be well below freezing, which causes frost to build on the outdoor coil under humid, cold conditions. Heat pumps handle this with a periodic <strong>defrost cycle</strong>: the reversing valve temporarily switches back to cooling-mode refrigerant flow (sending hot gas to the outdoor coil to melt the frost) while the outdoor fan is cycled off, and the system typically uses a defrost thermostat/sensor plus timer or demand-defrost control logic to determine when defrost is needed and when to terminate it.</p><p>The <strong>balance point</strong> of a heat pump is the outdoor temperature at which the heat pump''s heating capacity exactly equals the building''s heat loss at design indoor conditions. Above the balance point, the heat pump alone can maintain the setpoint; below it, the heat pump''s capacity (which declines as outdoor temperature drops, since there is less available heat in colder outdoor air and the compressor must work across a larger pressure differential) is no longer sufficient, and the system needs <strong>supplemental (auxiliary) heat</strong> &mdash; typically electric resistance heat strips, or in a dual-fuel/hybrid system, a fossil-fuel furnace &mdash; to make up the difference. Properly setting the balance point and supplemental heat lockout/staging in the control system is critical to both comfort and operating cost, since running electric strip heat unnecessarily is far less efficient than heat pump operation.</p>', 4, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Chillers', 'chillers', '<h3>At a glance</h3>
<ul><li>Chillers cool water/glycol, then circulate it to air handlers.</li><li>Air-cooled chillers reject heat directly to outdoor air.</li><li>Water-cooled chillers use cooling towers and are generally more efficient.</li><li>Chilled water typically supplied ~42–45°F, returns ~55–58°F.</li></ul>
<h3>The full picture</h3>
<p>A chiller is a refrigeration system that cools a liquid (almost always water or a water/glycol mixture) rather than cooling air directly. That chilled liquid is then circulated through piping to one or more air handling units, fan coil units, or process equipment, where it absorbs heat from air or a process stream. Chillers are the dominant cooling technology for large commercial buildings, campuses, and many industrial processes because a central chiller plant is often more efficient and easier to maintain than many distributed direct-expansion units, and chilled water piping is simpler to distribute through a large building than refrigerant piping.</p><ul><li><strong>Air-cooled chillers:</strong> Reject heat directly to outdoor air through a condenser coil and fans, similar to a large air conditioning condensing unit. These avoid the need for a cooling tower and associated water treatment, making them popular where water use, tower maintenance, or space for a tower is a concern, though they are generally somewhat less efficient than water-cooled chillers, especially in hot climates.</li><li><strong>Water-cooled chillers:</strong> Reject heat to a condenser water loop that runs to a cooling tower, where the heat is rejected to the atmosphere primarily through evaporative cooling of the tower water. Water-cooled chillers are generally more efficient than air-cooled chillers (the condensing temperature can be held closer to the outdoor wet-bulb temperature rather than the higher dry-bulb temperature), which is why they dominate in large buildings, but they require cooling tower water treatment, makeup water, and more maintenance.</li></ul><p>Large chillers commonly use centrifugal, screw, or scroll compressors depending on capacity, and may use refrigerants such as R-134a, R-513A, R-1233zd, or (in older systems still in service) R-123 or R-22. Chilled water is typically supplied around 42&ndash;45&deg;F and returns around 55&ndash;58&deg;F after picking up heat at the air handlers, though process chiller setpoints vary widely by application.</p>', 5, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Industrial/Process Refrigeration and Transport Refrigeration', 'industrial-process-refrigeration-and-transport-refrigeration', '<h3>At a glance</h3>
<ul><li>Ammonia (R-717): efficient, natural, toxic refrigerant for industrial plants.</li><li>CO2 (R-744): high-pressure, used in cascade/transcritical supermarket systems.</li><li>Blast freezing and cold storage often need multi-stage/cascade compression.</li><li>Transport reefers are self-contained diesel/electric DX units on trailers.</li></ul>
<h3>The full picture</h3>
<p>Industrial or process refrigeration serves manufacturing processes, food processing plants, and large cold storage warehouses, often at larger capacities and more extreme temperatures than commercial refrigeration. Two refrigerants dominate this space:</p><ul><li><strong>Ammonia (R-717):</strong> A highly efficient, low-cost, zero-ODP, zero-GWP natural refrigerant used extensively in industrial systems &mdash; cold storage warehouses, food and beverage processing, and ice rinks. Ammonia is toxic and has a distinct pungent odor even at low concentrations (which aids leak detection), and it is mildly flammable at high concentrations, so ammonia systems require specific engineering controls, ventilation, detection systems, and specially trained/certified technicians. Ammonia systems commonly use flooded evaporators and are often built as large custom-engineered rack systems rather than packaged equipment.</li><li><strong>Carbon dioxide (R-744):</strong> A natural refrigerant increasingly used in industrial and supermarket applications, particularly as a low-temperature refrigerant in cascade systems (where a CO2 low-temperature circuit rejects its heat to an upper-stage circuit using ammonia or another refrigerant) or in transcritical CO2 booster systems that eliminate HFCs from supermarket racks entirely. CO2 operates at much higher pressures than traditional refrigerants, requiring components and technician practices rated for those pressures, but it is non-toxic, non-flammable (A1 safety class), and has a global warming potential of 1 by definition.</li></ul><p>Low-temperature industrial applications include blast freezing (rapidly freezing food product, often at -20&deg;F to -40&deg;F evaporator temperatures or colder) and cold storage warehousing (bulk frozen storage typically held around -10&deg;F to 0&deg;F box temperature). These applications demand systems engineered for continuous heavy duty cycles, aggressive defrost strategies, and often multi-stage or cascade compression because a single compression stage becomes inefficient across very large temperature lifts.</p><p><strong>Transport refrigeration</strong> covers refrigerated trailers, shipping containers (reefers), and rail cars that maintain product temperature during shipping. These self-contained diesel- or electric-powered DX units must operate reliably across wide ambient conditions and vibration/road shock, and are typically charged with HFC or HFO refrigerants (such as R-404A historically, transitioning to lower-GWP options like R-452A) sized for the specific temperature range of the cargo, from chilled produce (around 34&ndash;38&deg;F) to deep-frozen goods (around -10&deg;F to -20&deg;F).</p>', 6, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'System Type Comparison', 'system-type-comparison', '<h3>At a glance</h3>
<ul><li>Quick-reference table of refrigerant, temp range, and application by system.</li><li>Comfort/heat pump systems typically use R-410A, R-32, or R-454B.</li><li>Industrial ammonia/CO2 systems span roughly -40 to +35°F.</li><li>Transport refrigeration ranges from chilled (34–38°F) to frozen (-20°F).</li></ul>
<h3>The full picture</h3>
<table><thead><tr><th>System Type</th><th>Typical Refrigerant(s)</th><th>Typical Temperature Range</th><th>Typical Application</th></tr></thead><tbody><tr><td>Domestic refrigeration</td><td>R-600a, R-134a</td><td>Fresh food: 34&ndash;40&deg;F; Freezer: -10 to 0&deg;F</td><td>Household refrigerators and freezers</td></tr><tr><td>Commercial reach-in/walk-in</td><td>R-404A, R-448A, R-449A, R-290</td><td>Cooler: 35&ndash;40&deg;F; Freezer: -10 to 0&deg;F</td><td>Restaurants, retail, food distribution storage</td></tr><tr><td>Supermarket rack systems</td><td>R-448A/R-449A (HFO blends), transcritical R-744</td><td>Med-temp: 20&ndash;35&deg;F; Low-temp: -20 to -30&deg;F</td><td>Centralized display case and walk-in refrigeration</td></tr><tr><td>Comfort air conditioning</td><td>R-410A, R-32, R-454B</td><td>Supply air: 55&ndash;60&deg;F; Evaporator: 38&ndash;45&deg;F</td><td>Residential and commercial space cooling</td></tr><tr><td>Heat pumps</td><td>R-410A, R-32, R-454B</td><td>Heating supply air: 90&ndash;120&deg;F; balance point varies by climate</td><td>Combined heating and cooling for buildings</td></tr><tr><td>Chillers (air- or water-cooled)</td><td>R-134a, R-513A, R-1233zd, (legacy R-123/R-22)</td><td>Chilled water supply: 42&ndash;45&deg;F</td><td>Large building HVAC via air handlers, process cooling</td></tr><tr><td>Industrial/process (ammonia)</td><td>R-717 (ammonia)</td><td>-40 to +35&deg;F depending on process</td><td>Cold storage warehouses, food/beverage processing</td></tr><tr><td>Industrial/process (CO2)</td><td>R-744 (carbon dioxide)</td><td>-40 to +35&deg;F, often in cascade with ammonia</td><td>Low-temp industrial and supermarket cascade/booster systems</td></tr><tr><td>Transport refrigeration</td><td>R-404A (legacy), R-452A</td><td>Chilled: 34&ndash;38&deg;F; Frozen: -10 to -20&deg;F</td><td>Refrigerated trailers, shipping containers, rail cars</td></tr></tbody></table>', 7, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of system types & applications you only <em>think</em> you know.</p>
<div data-interactive="hvacr-classify" data-set="system-type"></div>', 8, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="system-types-applications"></div>', 9, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'system-types-and-applications'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 14. Installation Practices
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Installation Practices', 'installation-practices',
       'Explain why a dry nitrogen purge during brazing prevents internal oxide scale and why silver-based alloys are required for refrigerant joints.',
       14, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Installation Practices takes about <strong>35 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Explain why a dry nitrogen purge during brazing prevents internal oxide scale and why silver-based alloys are required for refrigerant joints</li><li>Perform and evaluate a standing nitrogen pressure test on a new installation</li><li>Explain why deep vacuum evacuation is necessary and use a micron gauge to verify system dryness before charging</li><li>Compare methods of introducing refrigerant charge, including weighing in by nameplate/manufacturer data, liquid versus vapor charging, and high-side versus low-side charging</li><li>Select an appropriate leak detection method for a given field situation and describe basic piping practices for proper oil return</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-micron-gauge"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'installation-practices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Copper Tubing Handling and Brazing Practices', 'copper-tubing-handling-and-brazing-practices', '<h3>At a glance</h3>
<ul><li>Use Type ACR tubing; cut square and ream burrs before joining.</li><li>Clean joints to bright copper before brazing for a solid bond.</li><li>Purge with nitrogen while brazing to prevent oxide scale forming.</li><li>Use silver-based brazing alloy; never soft solder on refrigerant lines.</li></ul>
<h3>The full picture</h3>
<p>Refrigerant piping systems are only as reliable as the joints that hold them together. Copper tubing used in HVAC/R work is almost always Type ACR (Air Conditioning and Refrigeration) tubing, which is cleaned and capped at the factory to keep the inside free of oxidation and moisture. Technicians should never uncap tubing until they are ready to work with it, and cut lengths should be capped or taped immediately if brazing will not happen right away. Tubing must be cut square with a proper tubing cutter (not a hacksaw, which leaves burrs and metal chips inside the line), and the cut end must be reamed to remove the internal burr, since a burr disrupts refrigerant flow and can shed metal fragments that contaminate the system.</p><p>Before brazing, joints should be cleaned mechanically with abrasive cloth or a fitting brush until bright, shiny copper is exposed. Chemical flux is generally not required for copper-to-copper joints when using the correct filler metal, but is used for copper-to-brass or copper-to-steel transitions. The single most important field practice during brazing is purging the inside of the tubing with dry nitrogen while the joint is heated. Without a nitrogen purge, the intense heat of a torch (often exceeding 1100°F/600°C at the joint) causes the copper''s inner surface to oxidize, forming black cupric oxide scale. This scale later flakes loose when refrigerant flows through the line at velocity, and the resulting particles migrate through the system, clogging filter driers, plugging capillary tubes and TXV screens, and scoring compressor bearings and valves.</p><p>A proper nitrogen purge uses a regulator set to a very low flow (often described as just enough flow to feel it exit a small pinhole in tape covering the open end, roughly 1-3 SCFH) — enough to displace air/oxygen from the pipe interior without building pressure that could blow apart a joint being soldered or interfere with heat application. Purge nitrogen should flow continuously before, during, and for a short period after brazing until the joint cools below oxidation temperature (roughly 400°F/200°C).</p><p>For refrigeration and air conditioning joints, the industry standard filler metal is a silver-based brazing alloy (commonly referred to by trade names such as Sil-Fos, Stay-Silv, or BCuP-series alloys, generally containing phosphorus and 0-15% silver for copper-to-copper joints, or higher silver content, around 15-45%, for copper-to-brass/steel joints). These alloys melt in the 1190-1400°F range, well above soft solder (used for drain lines or non-pressure joints) and produce a strong, leak-tight joint capable of withstanding system operating pressures and vibration over the life of the equipment. Soft solder (tin/antimony or lead-free plumbing solder) is never acceptable on refrigerant-carrying lines because it cannot reliably hold pressure or withstand thermal cycling.</p>', 1, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'installation-practices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Pressure Testing with Nitrogen', 'pressure-testing-with-nitrogen', '<h3>At a glance</h3>
<ul><li>Test only with dry nitrogen, never refrigerant, oxygen, or shop air.</li><li>Pressurize to manufacturer limits, then check joints with bubbles/detector.</li><li>Standing test holds pressure for hours, correlated against temperature.</li><li>Unexplained pressure drop signals a leak needing repair and retest.</li></ul>
<h3>The full picture</h3>
<p>Once piping is brazed and the system is otherwise complete (but before evacuation and charging), the technician must verify that every joint and connection is mechanically sound and leak-free under pressure. This is done with dry nitrogen, never with refrigerant, oxygen, or compressed air. Refrigerant should not be used for pressure testing because releasing it to atmosphere during a leak search is wasteful, illegal under EPA venting prohibitions, and can create a flammable/reactive mixture on A2L refrigerant systems. Oxygen and compressed shop air must never be used because oxygen mixed with refrigerant oil under pressure can cause a violent explosion, and shop air introduces moisture and oil contamination.</p><p>The system is pressurized with dry nitrogen from a cylinder through a regulator, typically to a pressure below the equipment''s maximum test pressure or design working pressure as specified by the manufacturer — commonly in the range of 150-300 psig for AC systems and higher for some refrigeration systems, always checking nameplate/manufacturer limits first. Some technicians add a small amount (a few ounces via a trace-gas cylinder or a refrigerant charge of a few psi) of refrigerant or a specialized tracer gas to the nitrogen so an electronic leak detector can be used to pinpoint any leak found; this is sometimes called a ''nitrogen with trace gas'' test.</p><p>After pressurizing, all accessible joints are checked with bubble solution and/or an electronic detector. Then the system is left standing, isolated from the nitrogen source, for a standing pressure test — typically a minimum of several hours, though many specifications call for 24 hours or more (per manufacturer instructions or local code) to allow for stabilization. Pressure and ambient temperature are logged at the start and end of the test. A drop in pressure that cannot be explained by a corresponding drop in ambient temperature (gases contract and lose pressure as temperature falls, roughly following the ideal gas law) indicates a leak, and the system must be re-inspected, repaired, and retested before proceeding. A system that holds pressure with only temperature-correlated fluctuation is considered to have passed the standing pressure test.</p>', 2, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'installation-practices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Evacuation and Dehydration', 'evacuation-and-dehydration', '<h3>At a glance</h3>
<ul><li>Deep vacuum boils off trapped moisture before refrigerant is added.</li><li>Vacuum is measured in microns; target roughly 500 microns.</li><li>Triple evacuation or one deep continuous pull both remove moisture/air.</li><li>Evacuate from both sides with core removal tools for speed.</li></ul>
<h3>The full picture</h3>
<p>After a system passes the pressure test, it must be evacuated to remove air, nitrogen, and — critically — moisture and other non-condensable gases before refrigerant is introduced. This step is frequently rushed by inexperienced technicians, but it is one of the most consequential steps in the entire installation. Moisture left in a system reacts with refrigerant and oil to form acids, which attack motor windings, valves, and internal metal surfaces; it can freeze at the metering device and cause intermittent restrictions; and both moisture and air/non-condensables reduce heat transfer efficiency and raise head pressure, since non-condensable gases do not condense in the condenser the way refrigerant vapor does.</p><p>A standard shop vacuum pump cannot achieve a deep enough vacuum on its own to boil off trapped moisture — water boils at progressively lower temperatures as pressure drops, and at the deep vacuum levels used in this trade (well below atmospheric pressure), residual moisture will vaporize and be pulled out by the pump. This is why technicians pull a ''deep vacuum,'' meaning far below the roughly 29.9 in. Hg that most compound gauges max out at, measured instead in microns of mercury using a dedicated electronic micron gauge (1000 microns = 1 mm Hg; atmospheric pressure is about 760,000 microns).</p><p>Two accepted approaches are used: (1) triple evacuation, where the system is pulled down to a moderate vacuum, broken with dry nitrogen to atmospheric or slightly above, then pulled down again, repeated three times — each nitrogen break dilutes and helps carry out residual moisture and non-condensables; or (2) a deep single evacuation, where a good two-stage vacuum pump with clean oil is used to pull the system down to a very low micron level in one continuous pull and hold it there. Many manufacturers and best practices call for reaching approximately 500 microns (some specs allow up to 500-1000 microns depending on system size and manufacturer) and then performing a vacuum decay/rise test: isolate the pump with a valve, wait several minutes, and confirm the vacuum does not rise significantly, which would indicate a leak or continued outgassing of trapped moisture.</p><p>Best practice is to evacuate from both the high and low side simultaneously (using core removal tools or Schrader-less service ports whenever possible, since factory Schrader cores severely restrict flow) using large-diameter, short vacuum-rated hoses, since standard charging hoses with small Schrader fittings dramatically slow evacuation. The micron gauge should be connected at a point on the system itself, not just at the pump, so it is not misled by the pump''s own low reading (a phenomenon sometimes caused by restrictive hoses or fittings between the gauge and the true system vacuum).</p>', 3, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'installation-practices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Charging Methods', 'charging-methods', '<h3>At a glance</h3>
<ul><li>Weigh in charge by nameplate weight for the most accurate fill.</li><li>Fine-tune with superheat (fixed orifice) or subcooling (TXV) targets.</li><li>Charge liquid into the high side with compressor off to avoid slugging.</li><li>Zeotropic blends often need liquid charging to avoid fractionation.</li></ul>
<h3>The full picture</h3>
<p>Once a system has held a deep vacuum, it is ready to be charged with refrigerant. The most accurate and preferred method for the initial charge on any properly evacuated system is weighing in the charge using an electronic refrigerant charging scale, dialing in the exact weight specified on the equipment nameplate or in the manufacturer''s installation instructions, which typically also specifies an additional amount per foot of line set beyond a base length. Weighing in charge removes guesswork and is required for many split-system installations where the correct charge cannot be reliably verified any other way until the line set length is accounted for.</p><p>For systems already in operation, technicians often verify or fine-tune charge using superheat (fixed-orifice/piston metering devices) or subcooling (TXV metering devices) targets rather than weight alone, since factors like line length, TXV bulb charge, and the receiver hold varying amounts of refrigerant. Manufacturer-specified target superheat/subcooling values, sometimes called the refrigerant charge ''slip'' or charging charts, are used to fine-tune charge after an initial weigh-in or when the exact nameplate charge is unknown or the system has been modified.</p><p>Refrigerant may be added to a system as either liquid or vapor, and the choice matters. Charging liquid refrigerant into the high side (from the liquid port on the manifold, with the cylinder inverted or using a liquid-draw cylinder) is the fastest way to add a large charge and is done with the compressor off before startup, since liquid refrigerant entering the compressor directly (slugging) can cause severe mechanical damage. Charging vapor into the low side (suction) while the compressor is running is slower but safer for topping off an operating system, since only vapor is drawn in and there is no risk of liquid slugging — however, on many blended refrigerants (zeotropic blends) vapor-only charging from a cylinder can shift the blend''s composition over time (fractionation), so many blends should be charged as liquid into the system (through a metering restrictor/short length of capillary or a specified charging orifice on the hose) even when adding to the low side. Always follow the specific refrigerant''s charging instructions on the cylinder and the equipment''s service literature.</p><p>An accurate digital charging scale (resolution of a tenth of an ounce or better) is essential; charging ''by feel'' or by gauge pressure alone is imprecise and can easily result in overcharge or undercharge, both of which cause performance and reliability problems.</p>', 4, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'installation-practices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Leak Detection Methods', 'leak-detection-methods', '<h3>At a glance</h3>
<ul><li>Electronic sniffers catch low-level leaks but can give false positives.</li><li>Bubble solution visually confirms a leak''s exact location under pressure.</li><li>UV dye reveals hard-to-find leaks after some system run time.</li><li>Nitrogen plus trace gas combines pressure testing with leak pinpointing.</li></ul>
<h3>The full picture</h3>
<p>Every technician needs several leak detection tools because no single method works in every situation. An electronic leak detector (sniffer) draws in air near a suspect joint and senses refrigerant gas at very low concentrations (many modern units detect down into the single-digit grams-per-year range); it is fast and sensitive but can give false positives near contaminated surfaces (oil residue, cleaning solvents) and requires the technician to move the probe slowly and methodically around every joint, valve stem, and service port.</p><p>Bubble solution (a soap-based leak detection fluid) is inexpensive, simple, and excellent for confirming a suspected leak location once the system is pressurized with nitrogen (or nitrogen plus a trace amount of refrigerant): a growing bubble at the joint visually confirms escaping gas. It will not detect very small leaks reliably and cannot be used on a live, unpressurized, or evacuated system.</p><p>Ultraviolet (UV) dye is injected into the refrigerant/oil charge (either at manufacture or added by the technician through the low side) and circulates with the system oil. At a suspected leak point, oil and dye residue accumulate and fluoresce brightly under a UV lamp, making even old or intermittent leaks visible after the system has run for a period of time. UV dye is a valuable diagnostic tool for hard-to-find or recurring leaks but is a slower method since it requires system run time for the dye to reach the leak site and show up.</p><p>Pressurizing with dry nitrogen and a small trace amount of the actual refrigerant (or a dedicated tracer gas) combines the standing pressure test with electronic or bubble detection, letting a technician pinpoint a leak''s exact location under controlled, safe conditions without wasting a full refrigerant charge or violating venting rules. This nitrogen-plus-trace-gas approach is standard practice on new installations and major repairs before final evacuation and charging.</p>', 5, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'installation-practices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Basic Piping Practices: Line Sizing, Traps, and Risers', 'basic-piping-practices-line-sizing-traps-and-risers', '<h3>At a glance</h3>
<ul><li>Size lines from manufacturer tables, not just equipment connection stubs.</li><li>Vertical suction risers need high velocity to carry oil upward.</li><li>P-traps at riser bases catch oil during low-velocity periods.</li><li>Avoid accidental sags or extra loops that trap oil unintentionally.</li></ul>
<h3>The full picture</h3>
<p>Refrigerant line sizing is not arbitrary — undersized lines create excessive pressure drop and velocity noise, while oversized lines slow refrigerant velocity below the point needed to carry entrained compressor oil back to the compressor. Manufacturers publish line sizing tables based on system capacity (tonnage/BTU), equivalent line length, and vertical rise; technicians should always size lines per the manufacturer''s tables rather than simply matching the size of the equipment''s connection stubs, especially on longer line set runs common in split systems and remote condensing units.</p><p>Oil is miscible with refrigerant and travels through the system dissolved in or entrained with refrigerant vapor and liquid. On suction lines with vertical risers (where refrigerant vapor must travel upward, such as from a below-grade evaporator to a rooftop condensing unit), velocity must be kept high enough to physically carry oil droplets upward against gravity; if velocity is too low, oil will collect at the base of the riser. This is why long vertical suction risers are often sized one size smaller than a level run would require, deliberately trading a bit of extra pressure drop for the higher velocity needed for oil return.</p><p>A P-trap (oil trap) is installed at the base of a vertical suction riser to catch oil during low-velocity conditions (such as at minimum unloaded compressor capacity) and allow refrigerant vapor flow to periodically pick it up and carry it upward in slugs rather than letting it pool indefinitely. On very tall risers, additional traps may be needed at intervals (commonly every 20 feet of vertical rise per manufacturer guidance) so accumulated oil doesn''t create a large enough slug to cause liquid floodback into the compressor when it finally moves.</p><p>A common installation mistake is adding unnecessary traps or low points elsewhere in the piping — for example, a sagging horizontal run or an extra loop installed for convenience — which becomes an unintended oil trap in the wrong location, starving the compressor of lubrication over time. Piping should be pitched slightly toward the direction of desired oil flow, layouts should avoid unnecessary directional changes, and every trap in the system should be intentional and sized/placed according to manufacturer guidance, not an incidental byproduct of sloppy routing.</p>', 6, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'installation-practices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of installation practices you only <em>think</em> you know.</p>
<div data-interactive="hvacr-sequence" data-set="install"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'installation-practices'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="installation-practices"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'installation-practices'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 15. Troubleshooting & Diagnostics
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Troubleshooting & Diagnostics', 'troubleshooting-and-diagnostics',
       'Apply a systematic troubleshooting approach to diagnose HVAC/R system complaints efficiently and safely.',
       15, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Troubleshooting & Diagnostics takes about <strong>38 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Apply a systematic troubleshooting approach to diagnose HVAC/R system complaints efficiently and safely</li><li>Read a pressure-temperature (PT) chart correctly and use manifold/digital gauges to determine saturation temperatures</li><li>Calculate superheat and subcooling and interpret them together to diagnose charge level, airflow, and metering device problems</li><li>Match common symptoms (short cycling, high head pressure, low suction pressure, iced evaporator, noisy compressor, no cooling) to their most likely root causes</li><li>Select and safely use the core tools of the trade for diagnostics, including manifold gauges, clamp meters, and leak detectors</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-diagnostic-quadrant"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'troubleshooting-and-diagnostics'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'A Systematic Troubleshooting Approach', 'a-systematic-troubleshooting-approach', '<h3>At a glance</h3>
<ul><li>Gather information from the customer before touching the system.</li><li>Verify the complaint yourself by observing actual operation.</li><li>Inspect visually, then test electrical, pressure, and temperature values.</li><li>Always verify the repair actually resolved the original complaint.</li></ul>
<h3>The full picture</h3>
<p>Effective troubleshooting is a disciplined process, not guesswork. The first step is gathering information: ask the customer or building occupant what the complaint is, when it started, whether anything changed recently (a new thermostat, recent service, a power outage, a filter change), and whether the problem is constant or intermittent. Skipping this step often leads technicians to chase symptoms that have nothing to do with the actual complaint.</p><p>Next, verify the complaint yourself before touching anything. Run the system and observe: does it actually fail to cool, does it cycle oddly, does it make an unusual noise? Some ''complaints'' turn out to be normal operation misunderstood by the occupant, and confirming the issue firsthand prevents wasted repair effort. Following verification, perform a visual inspection: check the thermostat settings and batteries, filters, disconnects, breakers, obvious physical damage, refrigerant lines for oil residue (a sign of a leak), and airflow obstructions before connecting a single gauge.</p><p>Only after gathering information and inspecting should the technician move to testing: electrical checks (voltage, amperage, continuity, resistance), pressure readings, temperature readings (return/supply air, coil, line temperatures), and superheat/subcooling calculations as appropriate. Testing should isolate the problem to a specific component or subsystem — is it electrical, mechanical, refrigerant charge, airflow, or controls? Good technicians narrow the field of possible causes step by step rather than replacing parts speculatively.</p><p>Once the root cause is isolated, the technician repairs or replaces the failed component, and — critically — verifies the fix by running the system through a full cycle and confirming the original complaint is resolved and no new problems were introduced (correct pressures, correct superheat/subcooling, correct amp draw, correct temperature split across the coil). Repairs are not complete until verified; simply replacing a part and leaving is not adequate professional practice.</p>', 1, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'troubleshooting-and-diagnostics'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Reading a PT Chart and Using Gauges', 'reading-a-pt-chart-and-using-gauges', '<h3>At a glance</h3>
<ul><li>PT charts link refrigerant pressure to saturation temperature.</li><li>Each refrigerant has its own unique pressure-temperature chart.</li><li>Blue hose connects low side; red hose connects high side.</li><li>A2L refrigerants require specially rated gauges and hoses.</li></ul>
<h3>The full picture</h3>
<p>Every pure refrigerant and refrigerant blend has a defined relationship between pressure and the temperature at which it boils (evaporates) or condenses at that pressure — this is the saturation temperature, and it is documented on a pressure-temperature (PT) chart specific to each refrigerant (R-410A, R-22, R-404A, R-454B, etc. each has its own chart, since blends and different molecules boil at different pressures for a given temperature). Many manifold gauges have refrigerant-specific scales printed directly on the dial, and digital gauges/probes allow the technician to select the refrigerant from a menu and display saturation temperature automatically alongside pressure.</p><p>To use a PT chart in the field: read the low-side (suction) gauge pressure, then find that pressure on the chart for the refrigerant in use to determine the evaporator saturation temperature. Similarly, read the high-side (discharge/liquid) gauge pressure and find the corresponding condensing saturation temperature. These two saturation temperatures are the foundation for calculating superheat and subcooling.</p><p>Gauges must be connected correctly and safely: the blue hose to the low side, red hose to the high side, and yellow (or center) hose to a recovery machine, vacuum pump, or refrigerant cylinder as needed, following proper hose connection sequence to minimize refrigerant release. Gauge manifold valves should remain closed except when actively transferring refrigerant or venting to a recovery device, and technicians should always purge hoses of air before connecting to a system and use low-loss fittings where available to minimize refrigerant emissions, since venting is both wasteful and, for most refrigerants, a violation of EPA regulations.</p><p>On A2L (mildly flammable) refrigerant systems such as R-32 or R-454B, gauges, hoses, and any tool that connects to the refrigerant circuit must be rated for use with A2L refrigerants, and technicians should be aware of ignition sources and ensure adequate ventilation when working on these systems.</p>', 2, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'troubleshooting-and-diagnostics'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Superheat and Subcooling: Diagnosing Charge and Airflow', 'superheat-and-subcooling-diagnosing-charge-and-airflow', '<h3>At a glance</h3>
<ul><li>Superheat confirms all liquid refrigerant vaporized before the compressor.</li><li>Subcooling confirms refrigerant fully condensed before the metering device.</li><li>Superheat verifies charge on fixed-orifice systems; subcooling on TXVs.</li><li>Always check airflow before adjusting charge based on pressures.</li></ul>
<h3>The full picture</h3>
<p>Superheat is the difference between the actual temperature of refrigerant vapor leaving the evaporator (measured at the suction line near the compressor or evaporator outlet with a clamp-on temperature probe) and the saturation (boiling point) temperature corresponding to the suction pressure read on the gauge. Superheat confirms that all the liquid refrigerant has fully vaporized before reaching the compressor, protecting it from liquid slugging, and is the primary charge-verification method on fixed-orifice/piston metering device systems.</p><p>Subcooling is the difference between the saturation (condensing) temperature corresponding to the high-side/liquid line pressure and the actual measured temperature of the liquid line leaving the condenser. Subcooling confirms that refrigerant has fully condensed to a liquid with some safety margin before it reaches the metering device, and is the primary charge-verification method on TXV (thermostatic expansion valve) systems, since a TXV actively regulates superheat itself and therefore superheat alone is not a reliable proxy for charge on TXV systems.</p><p>Superheat and subcooling should always be interpreted together, along with airflow condition, because charge level and airflow restriction can produce overlapping symptoms. The table below summarizes common combinations for a fixed-orifice system (adapt the subcooling role accordingly on TXV systems, where subcooling is the primary charge indicator):</p><table><thead><tr><th>Superheat</th><th>Subcooling</th><th>Most Likely Cause</th></tr></thead><tbody><tr><td>High</td><td>Low</td><td>Undercharge (not enough refrigerant in the system)</td></tr><tr><td>High</td><td>Normal/High</td><td>Restriction in the liquid line or metering device, or low evaporator airflow causing excess evaporation (also check for low airflow across the evaporator, e.g., dirty filter/coil or weak blower)</td></tr><tr><td>Low</td><td>High</td><td>Overcharge (too much refrigerant in the system)</td></tr><tr><td>Low</td><td>Low/Normal</td><td>Low evaporator load or high airflow, or a flooding/oversized metering device allowing liquid carryover</td></tr><tr><td>Normal</td><td>Normal</td><td>Charge and airflow are correct; investigate elsewhere if a complaint persists</td></tr></tbody></table><p>Airflow must always be checked alongside these numbers: low airflow across the evaporator (dirty filter, dirty coil, weak blower, blocked ductwork) lowers evaporator temperature and pressure and can mimic undercharge symptoms even with a correct refrigerant charge, while low airflow across the condenser (dirty condenser coil, failed condenser fan, restricted airflow) raises head pressure and can mimic overcharge symptoms. A technician should never adjust charge based on pressures alone without first confirming airflow on both coils is normal.</p>', 3, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'troubleshooting-and-diagnostics'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Common Symptom-to-Cause Tables', 'common-symptom-to-cause-tables', '<h3>At a glance</h3>
<ul><li>Short cycling often traces to oversized equipment or low charge.</li><li>High head pressure usually means a dirty or blocked condenser.</li><li>Low suction pressure suggests undercharge or restricted airflow.</li><li>Symptoms overlap causes, so measurements must confirm the diagnosis.</li></ul>
<h3>The full picture</h3>
<p>Experienced technicians build a mental library connecting symptoms to likely causes, which speeds diagnosis while still requiring verification through testing. The table below lists common complaints and their most frequent root causes, though a given symptom can have multiple possible causes and each still requires confirmation with actual measurements.</p><table><thead><tr><th>Symptom</th><th>Likely Causes</th></tr></thead><tbody><tr><td>Short cycling (frequent on/off cycling)</td><td>Oversized equipment, dirty/iced evaporator coil, low refrigerant charge, faulty thermostat/control, restricted airflow, low-pressure control nuisance tripping</td></tr><tr><td>High head pressure</td><td>Dirty/blocked condenser coil, failed or slow condenser fan motor, overcharge, non-condensables (air) in the system, recirculating condenser air (poor unit clearance)</td></tr><tr><td>Low suction pressure</td><td>Undercharge, restricted metering device or filter drier, low evaporator airflow (dirty filter/coil, weak blower, blocked ducts), iced evaporator coil</td></tr><tr><td>Iced/frosted evaporator coil</td><td>Low airflow across coil, low refrigerant charge, failed defrost control (on refrigeration systems), stuck-open TXV allowing excessive refrigerant flow, low ambient operation without proper controls</td></tr><tr><td>Noisy compressor</td><td>Liquid slugging (flooding, overcharge, or low load), loss of oil/lubrication, worn internal bearings/valves, loose mounting, failing start/run components causing hard starting</td></tr><tr><td>No cooling at all</td><td>Loss of power (breaker/disconnect/fuse), failed compressor or capacitor, complete loss of charge (major leak), failed control board/thermostat, tripped safety switch (high pressure, low pressure, overload)</td></tr></tbody></table><p>Because many symptoms overlap across multiple possible causes, the table is a starting point for forming a hypothesis, not a substitute for testing. For example, both an iced evaporator coil and a dirty condenser coil can eventually cause ''no cooling,'' but the root cause and repair are completely different, so verification with gauges, temperature probes, and electrical meters remains essential before any part is replaced.</p>', 4, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'troubleshooting-and-diagnostics'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Tools of the Trade and Safe Use', 'tools-of-the-trade-and-safe-use', '<h3>At a glance</h3>
<ul><li>Manifold gauges read high- and low-side pressures simultaneously.</li><li>Clamp meters verify motor amp draw without breaking circuits.</li><li>Recovery machines are required before removing refrigerant, per EPA rules.</li><li>Always lockout equipment and discharge capacitors before servicing.</li></ul>
<h3>The full picture</h3>
<p>Manifold gauges (analog, or increasingly digital gauge sets/wireless probes) remain the core diagnostic tool, reading high-side and low-side pressures simultaneously; digital gauges add the convenience of automatic saturation temperature display and, on many models, direct superheat/subcooling calculation when paired with clamp-on temperature probes. A clamp meter measures amperage (and often voltage, resistance, and capacitance on combination meters) without breaking the circuit, letting a technician safely verify motor amp draw against nameplate/rated load amps (RLA) or full load amps (FLA) to catch overloaded or failing motors and compressors.</p><p>Accurate thermometers — pipe clamp/contact probes for line temperatures, and probe or infrared thermometers for air temperature — are essential for calculating superheat, subcooling, and temperature split across coils. A dedicated electronic leak detector locates refrigerant leaks with high sensitivity, while a micron gauge (covered in the installation module) verifies vacuum depth during evacuation and can also help diagnose a system that won''t hold vacuum due to an internal leak or excessive moisture.</p><p>A recovery machine is required whenever refrigerant must be removed from a system for repair, per EPA regulations prohibiting venting of most refrigerants to atmosphere; it pulls refrigerant into a recovery cylinder for reuse, reclamation, or proper disposal. Recovery machines and cylinders must never be overfilled (recovery cylinders are typically filled only to 80% of their rated liquid capacity to leave room for vapor expansion) and must be rated for the refrigerant category in use.</p><p>Safe tool use includes de-energizing and lockout/tagout of equipment before opening electrical panels for meter testing on non-live components, always treating capacitors as potentially charged and discharging them safely before handling, wearing safety glasses and gloves when connecting/disconnecting gauges (refrigerant under pressure can cause frostbite or eye injury on rapid release), and never bypassing safety controls (high-pressure switches, low-pressure switches, overloads) to keep a system running, since these controls exist to prevent catastrophic failure or hazardous conditions.</p>', 5, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'troubleshooting-and-diagnostics'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of troubleshooting & diagnostics you only <em>think</em> you know.</p>
<div data-interactive="hvacr-branch"></div>', 6, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'troubleshooting-and-diagnostics'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="troubleshooting-diagnostics"></div>', 7, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'troubleshooting-and-diagnostics'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 16. Preventive Maintenance
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Preventive Maintenance', 'preventive-maintenance',
       'Explain why preventive maintenance improves efficiency, extends equipment lifespan, and supports code and regulatory compliance.',
       16, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Preventive Maintenance takes about <strong>30 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Explain why preventive maintenance improves efficiency, extends equipment lifespan, and supports code and regulatory compliance</li><li>Execute a comprehensive PM checklist covering coils, filters, belts, electrical connections, charge, drains, and refrigeration-specific items</li><li>Adjust maintenance priorities seasonally for cooling-dominant and heating-dominant equipment</li><li>Document service records completely and accurately in a way that supports warranty, compliance, and future troubleshooting</li><li>Describe how consistent preventive maintenance reduces refrigerant leaks and supports emissions compliance</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-pm-checklist"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'preventive-maintenance'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Why Preventive Maintenance Matters', 'why-preventive-maintenance-matters', '<h3>At a glance</h3>
<ul><li>Dirty coils, worn belts, or low charge quietly waste energy.</li><li>PM prevents premature compressor failure and costly emergency replacement.</li><li>Reliability is critical in refrigeration to avoid spoiled inventory.</li><li>Documented PM supports EPA leak inspection and compliance needs.</li></ul>
<h3>The full picture</h3>
<p>Preventive maintenance (PM) is scheduled, proactive service performed to keep equipment operating at or near its designed efficiency and to catch small problems before they become failures. Unlike reactive (breakdown) service, PM is planned, typically seasonal or interval-based, and follows a checklist rather than responding only to a complaint. The financial case for PM is straightforward: a dirty condenser coil, a slipping belt, or a slightly low refrigerant charge each quietly increase energy consumption, sometimes significantly, well before the system fails outright or throws an obvious fault. Regular PM catches these efficiency losses early, keeping utility costs down for the owner and reducing strain on components.</p><p>PM also directly extends equipment lifespan. Compressors fail prematurely from causes that are often preventable — running with low oil due to trap or piping issues, overheating from dirty coils, electrical stress from loose connections, or acid formation from unaddressed moisture — so catching these conditions during a scheduled visit, rather than after the compressor has already failed, is far cheaper than the alternative of an emergency replacement, and it keeps the equipment running for the customer during critical periods (a July heat wave or a food-safety-critical walk-in cooler failure).</p><p>Reliability is especially critical in commercial refrigeration, where an unnoticed failure can mean spoiled inventory, food safety violations, or a shut-down business. PM programs for refrigeration equipment (walk-in coolers/freezers, reach-in cases, ice machines) are typically more frequent and detailed than comfort-cooling PM because the consequences of failure are more severe and immediate.</p><p>Finally, PM supports code and regulatory compliance. As covered in the codes and certification module, systems above certain refrigerant charge thresholds are subject to periodic leak inspection and repair requirements under EPA regulations; a documented, consistent PM program is often the mechanism by which those inspections actually happen and get recorded, and it demonstrates good-faith compliance to a regulator or auditor if the system is ever reviewed.</p>', 1, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'preventive-maintenance'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'A Typical PM Checklist', 'a-typical-pm-checklist', '<h3>At a glance</h3>
<ul><li>Clean coils and filters; check belts, bearings, electrical connections.</li><li>Verify refrigerant charge via superheat/subcooling against baseline.</li><li>Clean condensate drains and inspect door gaskets/seals.</li><li>Confirm defrost system and safety controls are functioning correctly.</li></ul>
<h3>The full picture</h3>
<p>A thorough PM visit works through the system methodically rather than glancing at a gauge and moving on. A representative checklist for an AC or refrigeration system includes the following categories, each with specific items:</p><ul><li><strong>Coils:</strong> Inspect and clean the evaporator coil (removing dust, mold, or biological growth that reduces heat transfer and can affect indoor air quality) and clean the condenser coil (removing dirt, leaves, cottonwood fluff, or grease buildup — especially common on rooftop and outdoor units, and on kitchen-adjacent condensing units where grease-laden air is drawn through the coil).</li><li><strong>Filters:</strong> Replace or clean air filters on the schedule appropriate to the environment; a dirty filter is one of the single most common causes of reduced airflow, iced coils, and premature blower/compressor stress.</li><li><strong>Belts and bearings:</strong> Inspect belts for wear, cracking, and correct tension (or replace on a schedule); check motor and fan bearings for noise, play, or lack of lubrication, and lubricate per manufacturer specification where applicable.</li><li><strong>Electrical connections:</strong> Inspect and torque electrical connections to specification (loose connections create resistance, heat, and eventual failure — a leading cause of contactor and terminal burnout); check contactors for pitting, inspect capacitors for bulging/leaking and test capacitance against rated value, and verify motor amp draws against nameplate values.</li><li><strong>Refrigerant charge:</strong> Verify charge using superheat/subcooling as appropriate to the metering device, and compare readings against the system''s baseline/target values; investigate any drift that suggests a slow leak.</li><li><strong>Drain/condensate system:</strong> Clean and flush the condensate drain line and pan, check for proper pitch and for algae/biological growth, and verify the float switch or overflow protection is functional — a clogged drain is a common cause of water damage callbacks.</li><li><strong>Door gaskets and seals (refrigeration):</strong> Inspect walk-in and reach-in door gaskets for tears, gaps, or poor sealing, and check door heaters/anti-sweat heaters where applicable; a failing gasket dramatically increases infiltration load and ice buildup on evaporator coils.</li><li><strong>Defrost system (refrigeration):</strong> Verify defrost timer/controller operation, defrost heater function, termination/limit controls, and confirm the coil fully clears of frost during the defrost cycle without excessive downtime.</li></ul><p>Beyond this checklist, a thorough technician also verifies safety controls are functional (high/low pressure switches, overloads), checks refrigerant line insulation for gaps or degradation, and inspects the overall physical condition of the cabinet, ductwork, or enclosure for damage that could affect performance or safety.</p>', 2, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'preventive-maintenance'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Seasonal Maintenance Considerations', 'seasonal-maintenance-considerations', '<h3>At a glance</h3>
<ul><li>Spring pre-season AC checks catch issues before peak summer demand.</li><li>Fall checks cover burners, ignition, and heat pump defrost function.</li><li>Refrigeration runs year-round but still needs seasonal ambient attention.</li><li>Tailor schedule to environment: salt air, grease, dust exposure.</li></ul>
<h3>The full picture</h3>
<p>PM scheduling should reflect how equipment is used across the year. For cooling-dominant equipment (residential/commercial AC), a pre-season inspection in spring is valuable to catch problems before peak summer demand, when service capacity is stretched thin and customers have the least tolerance for downtime; a lighter fall check can address winterization concerns such as protecting outdoor equipment and, in some climates, verifying condensate lines and low-ambient controls before freezing weather.</p><p>For heating equipment (furnaces, heat pumps in heating mode), a pre-season fall inspection focuses on burner/heat exchanger safety inspection (where applicable, checking for cracks that could allow combustion gas leakage), ignition system function, and — for heat pumps — verifying reversing valve operation and defrost cycle function, since a heat pump''s defrost system is critical to winter performance and often is not exercised or noticed until cold weather arrives.</p><p>Refrigeration equipment (commercial coolers, freezers, ice machines) generally runs year-round and is less seasonal in scheduling, but ambient temperature swings still matter: air-cooled condensers exposed to summer heat need condenser cleaning checked more frequently, while equipment in unconditioned spaces (rooftop, outdoor, or unheated back-of-house areas) may need attention to low-ambient operating controls or head pressure control valves as outdoor temperatures swing seasonally.</p><p>Regardless of season, a good PM program adjusts its checklist and frequency based on the specific installation''s environment — coastal/high-salinity environments accelerate coil corrosion, kitchen environments accelerate condenser grease buildup, and dusty industrial environments accelerate filter loading — and a one-size-fits-all schedule applied without considering these factors will under-serve some equipment and potentially over-service others.</p>', 3, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'preventive-maintenance'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Documenting Service Records', 'documenting-service-records', '<h3>At a glance</h3>
<ul><li>Record date, tech, equipment ID, readings, parts, refrigerant used.</li><li>Baseline data helps spot gradual degradation across future visits.</li><li>Documentation supports warranty claims and protects tech/company liability.</li><li>Thorough records are an EPA regulatory requirement for larger systems.</li></ul>
<h3>The full picture</h3>
<p>Every PM visit should produce a written service record, whether on paper or (increasingly) through a digital field service management platform. A complete record includes the date of service, the technician''s name (and certification number, where relevant to refrigerant handling), the equipment identified by location/asset tag or serial number, the specific checklist items performed, any readings taken (pressures, temperatures, superheat/subcooling, amp draws), any refrigerant added or recovered and its type and quantity, any parts replaced, and any deficiencies noted along with recommendations for follow-up repair.</p><p>Good documentation serves several purposes beyond simple record-keeping. It creates a performance baseline over time, so a technician on a future visit can compare current readings against historical trends and catch gradual degradation (a slowly rising amp draw, a slowly declining subcooling reading) that would be invisible from a single visit''s snapshot. It supports warranty claims by proving the equipment was properly maintained according to manufacturer requirements. It protects the technician and company by documenting what was found and recommended, even if the customer declines a recommended repair. And, as covered in the next module, thorough documentation is a regulatory requirement for larger refrigerant systems under EPA rules, which mandate specific records be kept and retained for a defined period.</p>', 4, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'preventive-maintenance'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'PM''s Role in Reducing Leaks and Supporting Emissions Compliance', 'pm-s-role-in-reducing-leaks-and-supporting-emissions-complia', '<h3>At a glance</h3>
<ul><li>Most leaks start small at joints, seals, or degraded braze points.</li><li>Oil-residue checks and charge verification catch leaks early.</li><li>Undetected small leaks can grow into threshold-exceeding leak rates.</li><li>Preventing leaks saves refrigerant cost and cuts environmental impact.</li></ul>
<h3>The full picture</h3>
<p>Refrigerant leaks rarely start as catastrophic failures — most begin as small, slow leaks at vibration-prone joints, worn valve stem seals, corroded coil tubing, or degraded braze joints, and they grow worse over time if undetected. A consistent PM program that includes visual inspection for oil residue (a telltale sign of a slow leak, since refrigerant oil leaks along with refrigerant and leaves a visible trace) and periodic charge verification catches these leaks early, often long before they grow large enough to cause a performance complaint.</p><p>This matters beyond simple system performance. Refrigerants — especially HFCs with high global warming potential — are potent greenhouse gases when released to atmosphere, and regulatory frameworks (covered in detail in the next module) impose specific leak rate thresholds and mandatory repair timelines on larger systems. A facility that relies only on reactive service (waiting for a complaint before checking a system) is far more likely to have small leaks accumulate undetected into a threshold-exceeding leak rate, triggering a mandatory repair requirement and consuming refrigerant (which is increasingly expensive and supply-constrained under phasedown regulations) without benefit.</p><p>In short, good PM is not just a service quality practice — it is one of the most effective practical tools an HVAC/R company has for keeping customers in compliance with refrigerant management regulations, controlling refrigerant costs in a phasedown environment, and reducing the industry''s overall environmental footprint, since preventing a leak from ever growing large is far better for the environment (and the customer''s budget) than any amount of recovery or reclaim after the fact.</p>', 5, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'preventive-maintenance'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of preventive maintenance you only <em>think</em> you know.</p>
<div data-interactive="hvacr-classify" data-set="pm"></div>', 6, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'preventive-maintenance'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="maintenance"></div>', 7, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'preventive-maintenance'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 17. Codes, Regulations & EPA 608 Certification
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Codes, Regulations & EPA 608 Certification', 'codes-regulations-and-epa-608-certification',
       'Identify the four EPA Section 608 certification types and the appliance categories, charge thresholds, and exam requirements associated with each.',
       17, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Overview and objectives', 'overview-and-objectives', '<p>Codes, Regulations & EPA 608 Certification takes about <strong>40 minutes</strong> to work through, and closes with a knowledge check of 8 questions that you have to pass to complete the subject.</p>
<h3>What you''ll be able to do</h3>
<ul><li>Identify the four EPA Section 608 certification types and the appliance categories, charge thresholds, and exam requirements associated with each</li><li>Explain the record-keeping and leak rate/repair requirements that apply to systems containing 50 or more pounds of refrigerant</li><li>Distinguish correctly among recovery, recycling, and reclaiming as defined for the EPA 608 exam</li><li>Describe the recovery equipment certification requirements, including the added requirement for A2L-rated equipment on A2L refrigerant systems</li><li>Identify relevant safety codes/standards and state-level programs (such as California''s CARB program) that operate alongside federal EPA 608 requirements</li></ul>
<h3>Try it first</h3>
<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>
<div data-interactive="hvacr-epa-tools"></div>', 0, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'codes-regulations-and-epa-608-certification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'EPA Section 608 Certification Types', 'epa-section-608-certification-types', '<h3>At a glance</h3>
<ul><li>Type I covers small appliances with 5 lbs or less of charge.</li><li>Type II covers high-pressure equipment; requires a hands-on exam.</li><li>Type III covers low-pressure chillers (e.g., R-11, R-113).</li><li>Universal requires all three exams; certification never expires.</li></ul>
<h3>The full picture</h3>
<p>Section 608 of the Clean Air Act requires technicians who service, maintain, repair, or dispose of equipment that could release refrigerant into the atmosphere to be certified. The EPA 608 program defines four certification types, and technicians should know exactly which appliances each covers, since exam questions frequently test this distinction directly.</p><ul><li><strong>Type I</strong> covers small appliances, defined as factory-sealed refrigeration/AC equipment containing 5 pounds or less of refrigerant charge (household refrigerators, most window units, small dehumidifiers, and vending machines are typical examples). The Type I exam is closed-book.</li><li><strong>Type II</strong> covers high-pressure and very-high-pressure appliances, which includes most common commercial and residential split-system and packaged AC and refrigeration equipment using refrigerants such as R-410A, R-22, and R-404A. A Type II certification requires passing a practical (hands-on) component in addition to the written exam, and once earned, a single Type II certification covers equipment of any charge size in that pressure category — there is no separate small-charge/large-charge split within Type II itself.</li><li><strong>Type III</strong> covers low-pressure appliances, principally low-pressure chillers using refrigerants such as R-11 and R-113, common in large commercial building HVAC plants.</li><li><strong>Universal certification</strong> is earned by passing all three exams (Type I, II, and III) and covers all appliance categories; it is the recommended certification for technicians expecting to work across residential, commercial, and industrial equipment types.</li></ul><p>Once earned, an EPA 608 certification (of any type, including Universal) does not expire — there is no periodic renewal or continuing education requirement to maintain it, unlike some state trade licenses which may have their own separate renewal cycles.</p>', 1, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'codes-regulations-and-epa-608-certification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Record-Keeping and Leak Rate Requirements for Larger Systems', 'record-keeping-and-leak-rate-requirements-for-larger-systems', '<h3>At a glance</h3>
<ul><li>Systems with 50+ lbs of charge require detailed service records.</li><li>Records must be kept 3 years and shown on request.</li><li>Leak thresholds: 10% comfort, 20% commercial, 30% industrial.</li><li>Exceeding the threshold triggers mandatory repair within 30 days.</li></ul>
<h3>The full picture</h3>
<p>Systems containing 50 pounds or more of refrigerant charge are subject to specific EPA record-keeping requirements. For each service event involving refrigerant addition, recovery, or leak repair, required records include the date of service, the type and quantity of refrigerant added or removed, the findings of any leak inspection performed, the name and certification number of the technician performing the work, and the equipment''s location. These records must be retained for 3 years and made available for inspection if requested.</p><p>Beyond record-keeping, systems over 50 pounds are subject to an annualized leak rate threshold that determines whether a mandatory repair requirement is triggered. The thresholds differ by application, reflecting different technical and economic realities across sectors:</p><table><thead><tr><th>Sector</th><th>Annual Leak Rate Threshold</th></tr></thead><tbody><tr><td>Comfort cooling (chillers, large building AC)</td><td>10%</td></tr><tr><td>Commercial refrigeration</td><td>20%</td></tr><tr><td>Industrial process refrigeration</td><td>30%</td></tr></tbody></table><p>If a system''s calculated annual leak rate exceeds its applicable threshold, the owner is required to repair the leak(s) within 30 days of discovery (with limited allowances for extension under specific documented circumstances, such as parts availability or the need for a retrofit/retirement plan). Technicians should understand that these thresholds and the mandatory repair clock apply specifically to systems at or above the 50-pound charge level — smaller systems are not subject to this specific leak rate/repair-timeline mechanism, though good practice (and other provisions) still call for prompt leak repair regardless of system size.</p>', 2, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'codes-regulations-and-epa-608-certification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Recovery, Recycling, and Reclaiming: Critical Definitions', 'recovery-recycling-and-reclaiming-critical-definitions', '<h3>At a glance</h3>
<ul><li>Recovery: removing refrigerant into a container, no cleaning implied.</li><li>Recycling: on-site cleaning for reuse by the same owner.</li><li>Reclaiming: off-site processing to AHRI 700 purity for resale.</li><li>Exams often test mixing up these three precise definitions.</li></ul>
<h3>The full picture</h3>
<p>The EPA 608 exam places heavy emphasis on precisely distinguishing three terms that are often used loosely in casual shop conversation but have specific regulatory definitions:</p><ul><li><strong>Recovery</strong> is simply removing refrigerant from a system, in any condition, and storing it in an external container, without necessarily testing or processing it in any way. Recovery is the minimum required action any time refrigerant must be removed from equipment for service, repair, or disposal.</li><li><strong>Recycling</strong> is reducing contaminants in recovered refrigerant through oil separation and single or multiple passes through devices that reduce moisture, acidity, and particulate matter, typically using equipment on-site at the job or in a shop, with the refrigerant then reused in the same system or other equipment owned by the same person/owner without meeting the full purity standard required for resale.</li><li><strong>Reclaiming</strong> is processing recovered refrigerant to the purity level specified in AHRI Standard 700 (verified by chemical analysis), typically performed at an off-site reclamation facility, after which the refrigerant may be sold to a new owner as if it were virgin material.</li></ul><p>A common exam-style trick is testing whether the student understands that recovery alone does not imply any cleaning or testing occurred, that recycling is a lower/less rigorous standard intended for reuse by the same owner rather than resale, and that reclaiming specifically references the AHRI 700 purity standard and is generally an off-site process, not something performed with a standard job-site recovery machine.</p>', 3, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'codes-regulations-and-epa-608-certification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Recovery Equipment Standards and A2L Refrigerant Requirements', 'recovery-equipment-standards-and-a2l-refrigerant-requirement', '<h3>At a glance</h3>
<ul><li>Recovery machines must be AHRI 700/740 certified for performance.</li><li>A1-rated recovery machines aren''t automatically safe for A2L use.</li><li>A2L service needs specifically rated recovery machines, gauges, hoses.</li><li>Lacking A2L-rated tools can block legal service of new systems.</li></ul>
<h3>The full picture</h3>
<p>Recovery equipment used by technicians must be certified to AHRI Standard 700/740 performance requirements, which verify that the equipment can adequately evacuate refrigerant from a system to the required levels. This certification requirement is separate from a technician''s own EPA 608 personal certification — both the technician and the recovery machine must meet their respective requirements.</p><p>A significant and relatively recent jobsite issue involves A2L-rated refrigerants, a mildly flammable refrigerant class (ASHRAE safety classification A2L) that includes R-32 and R-454B, now widely used in new residential and light commercial equipment as the industry transitions away from higher-GWP refrigerants. Standard recovery machines designed and certified for A1 (non-flammable) refrigerants are not automatically safe or approved for use with A2L refrigerants — recovery equipment used on A2L systems must itself be specifically rated and certified for A2L refrigerant service, incorporating design features appropriate to a mildly flammable refrigerant (such as spark-resistant components and appropriate electrical design). As A2L equipment has rolled out broadly through 2025-2026, technicians and shops without A2L-rated recovery machines and A2L-rated gauges/hoses have found themselves unable to legally or safely service the growing installed base of A2L systems, making this an increasingly common practical and purchasing consideration for service companies.</p>', 4, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'codes-regulations-and-epa-608-certification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'The Broader Regulatory Backdrop: The AIM Act and Sector GWP Limits', 'the-broader-regulatory-backdrop-the-aim-act-and-sector-gwp-l', '<h3>At a glance</h3>
<ul><li>AIM Act phases down HFC production via shrinking allowances.</li><li>Baseline is set against 2011–2013 average production/consumption.</li><li>Sector GWP limits (~150–300) phase in for new equipment 2025–2027.</li><li>Drives the industry shift toward A2L, HFO, and lower-GWP options.</li></ul>
<h3>The full picture</h3>
<p>As introduced in Module 4, the American Innovation and Manufacturing (AIM) Act authorizes the EPA to phase down the production and consumption of HFC refrigerants in the United States through a system of allowances that step down over time against a baseline set relative to 2011-2013 average production and consumption levels (commonly referenced as the 2012 baseline period). This phasedown is the primary driver behind the industry-wide shift toward lower-GWP refrigerants such as A2L blends (R-32, R-454B) and other alternatives in new equipment, and it is also why reclaimed refrigerant supply and cost have become more significant considerations for service companies, since allowances constrain how much new HFC production and import can occur going forward.</p><p>Layered on top of the general phasedown, the AIM Act also authorizes sector-specific technology transition rules that set maximum allowable GWP limits for equipment in defined sectors, phasing in between 2025 and 2027. For many retail food refrigeration and industrial process refrigeration applications, these rules establish GWP limits roughly in the 150-300 range for equipment manufactured after the applicable phase-in date, effectively barring many traditional high-GWP HFC refrigerants from use in new equipment in those sectors going forward. Technicians do not need to memorize every sector-specific date and number for the 608 exam, but should understand this regulatory direction as context for why new equipment increasingly uses A2L, HFO, or other lower-GWP refrigerants, and why proper refrigerant identification and handling are only becoming more important, not less.</p>', 5, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'codes-regulations-and-epa-608-certification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Safety Codes, State Programs, and Exam Preparation Tips', 'safety-codes-state-programs-and-exam-preparation-tips', '<h3>At a glance</h3>
<ul><li>ASHRAE 15 and UL 60335-2-40 cover safety and A2L equipment rules.</li><li>Local codes and OSHA''s General Duty Clause also apply broadly.</li><li>States like California (CARB) can impose stricter requirements.</li><li>Know cert types, the 50-lb threshold, leak rates, and 30-day rule.</li></ul>
<h3>The full picture</h3>
<p>Beyond EPA 608 itself, technicians should be aware that several other codes and standards govern safe installation and service, even though the 608 exam focuses primarily on federal refrigerant handling regulations. ASHRAE Standard 15 is the safety code addressing refrigeration systems broadly, covering topics like machinery room ventilation, refrigerant quantity limits by occupancy classification, and required safety devices. UL 60335-2-40 addresses safety requirements specific to electrical heat pumps, air conditioners, and dehumidifiers, including provisions relevant to A2L (mildly flammable) refrigerant equipment. Local mechanical and building codes govern installation specifics (clearances, ventilation, permitting) and can vary significantly by jurisdiction, so technicians must know and follow local code in addition to federal rules. The OSHA General Duty Clause requires employers to provide a workplace free from recognized hazards, which applies broadly to refrigerant handling, confined space work (some mechanical/machinery rooms), and electrical safety even where no specific OSHA standard addresses the exact hazard.</p><p>Some states impose refrigerant management requirements stricter than the federal EPA program. California''s Air Resources Board (CARB) Refrigerant Management Program is a leading example, imposing its own leak inspection frequency, reporting, and repair requirements on large refrigeration and AC systems in the state, in some cases with lower charge thresholds or stricter timelines than the federal program. Technicians working in states with such programs must comply with both the federal EPA 608 requirements and the applicable state program — state rules can add requirements but cannot lower the federal floor.</p><p>For exam preparation specifically: memorize the four certification types and exactly what appliance category and pressure level each covers; know the 50-pound threshold and its associated record retention period (3 years) and the three sector-specific leak rate percentages (10% comfort cooling, 20% commercial refrigeration, 30% industrial process refrigeration) along with the 30-day mandatory repair window; and be ready for carefully worded questions distinguishing recovery, recycling, and reclaiming, since exam writers frequently construct answer choices that swap these definitions to test precise understanding rather than general familiarity. Also expect questions on required practices such as using nitrogen (never oxygen or compressed air) for pressure testing, the prohibition on knowingly venting refrigerant during maintenance/repair/disposal, and the general venting prohibition''s few narrow exceptions (such as small releases during normal, necessary purging that are not knowing/intentional venting to atmosphere for disposal purposes).</p>', 6, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'codes-regulations-and-epa-608-certification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Practice', 'practice', '<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of codes, regulations & epa 608 certification you only <em>think</em> you know.</p>
<div data-interactive="hvacr-classify" data-set="recovery"></div>', 7, TRUE, 8
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'codes-regulations-and-epa-608-certification'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Key terms', 'key-terms', '<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>
<div data-interactive="hvacr-flashcards" data-module="codes-certification"></div>', 8, TRUE, 5
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'codes-regulations-and-epa-608-certification'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 18. Course completion
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Course completion', 'course-completion',
       'The cumulative final exam across all 17 subjects, and your certificate once everything is finished.',
       18, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = 'refrigeration-hvacr'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'The final exam', 'the-final-exam', '<p>Each of the 17 subjects ends with its own knowledge check. The <strong>final exam</strong> is different: it is a single cumulative paper drawn from every subject in the course, and it sits on the category rather than on any one subject.</p>
<h3>How it is scored</h3>
<ul>
<li><strong>34 questions</strong>, two from each subject.</li>
<li><strong>80% to pass</strong>, the same bar as every other quiz in the portal.</li>
<li><strong>Unlimited retakes</strong>, and your best score is the one that is kept.</li>
<li>Once you have passed, passing again cannot un-pass you.</li>
</ul>
<h3>What it does and does not gate</h3>
<p>A capstone exam is a measure, not a lock: it does <em>not</em> gate the completion of the individual subjects. Each subject completes on its own lessons and its own knowledge check. The final exam is what the certificate on the next page is waiting for.</p>
<p>Work through the subjects first. The exam draws on all of them, so taking it early mostly tells you which subjects you have not read yet.</p>
<p><a href="/admin/learn/refrigeration-hvacr/quiz">Open the final exam →</a></p>', 0, TRUE, 4
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'course-completion'
ON CONFLICT (module_id, slug) DO NOTHING;

INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, 'Your certificate', 'your-certificate', '<p>Finish every subject and pass the final exam, and your certificate appears below with your name and the date you completed it. Until then it shows exactly what is still outstanding.</p>
<div data-interactive="hvacr-certificate"></div>', 1, TRUE, 3
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = 'refrigeration-hvacr'
WHERE m.slug = 'course-completion'
ON CONFLICT (module_id, slug) DO NOTHING;


-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM learn_modules m JOIN learn_categories c ON c.id = m.category_id
--   WHERE c.slug = 'refrigeration-hvacr';                                  -- expect 18
-- SELECT COUNT(*) FROM learn_lessons l JOIN learn_modules m ON m.id = l.module_id
--   JOIN learn_categories c ON c.id = m.category_id WHERE c.slug = 'refrigeration-hvacr';   -- expect 155
-- SELECT COUNT(*) FROM learn_lessons l JOIN learn_modules m ON m.id = l.module_id
--   JOIN learn_categories c ON c.id = m.category_id
--   WHERE c.slug = 'refrigeration-hvacr' AND l.content LIKE '%data-interactive%';           -- expect 38
