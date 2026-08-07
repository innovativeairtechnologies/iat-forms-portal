-- ─────────────────────────────────────────────────────────────────────────────
-- 086_hvacr_course_quizzes.sql — knowledge checks for the HVAC/R course
--
-- GENERATED FILE. Do not hand-edit — run:
--     node scripts/gen-hvacr-course.mjs
--
-- One PUBLISHED quiz per subject (8 questions each), plus a category capstone
-- of 34 questions — two drawn from each subject — as the final exam.
--
-- Published on insert, which is safe in exactly one direction: a subject with a
-- published quiz completes only when its lessons are read AND the quiz is
-- passed (subjectIsComplete, lib/learn-quiz.ts). Because the whole course is
-- new, nobody has prior progress that publishing could retroactively
-- un-complete — the hazard that rule exists to prevent.
--
-- The capstone is category-scoped and therefore gates nothing, by design.
--
-- pass_pct is left at the table default (80).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Safety Fundamentals ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals'), 'Safety Fundamentals — knowledge check', '8 questions covering safety fundamentals. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"safety","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why is a torch or open flame never used to heat a sealed refrigerant cylinder?', 'Heating a sealed pressure vessel directly with a flame causes internal pressure to rise rapidly and unpredictably, risking a violent rupture or explosion.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It wastes fuel and is inefficient', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It discolors the cylinder coating', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Pressure inside the sealed vessel rises rapidly with temperature and can cause a violent rupture', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It voids the manufacturer''s warranty only', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician needs to enter a walk-in cooler mechanical room after a suspected refrigerant leak. What is the primary hazard to check for before entry?', 'Refrigerant leaks in confined or enclosed spaces displace breathable air, which can lower oxygen levels below the safe threshold with little or no warning odor.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Excess humidity', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reduced oxygen concentration (asphyxiation risk)', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Excess carbon monoxide from the compressor only', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Static electricity buildup', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which ASHRAE 34 classification describes R-32 and R-454B?', 'R-32 and R-454B are classified A2L: lower toxicity with mild flammability and a low burning velocity, which is why they require new leak-detection and ignition-source precautions.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A1 (nonflammable, lower toxicity)', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A2L (mildly flammable, lower toxicity)', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A3 (highly flammable, lower toxicity)', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'B2L (mildly flammable, higher toxicity)', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the correct order of steps in a proper lockout/tagout procedure?', 'Proper LOTO requires shutdown, isolation, applying the lock/tag, releasing any stored energy, and then verifying a zero energy state with a meter before work begins.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Apply lock and tag, then shut down equipment, then verify zero energy', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Shut down equipment, isolate energy source, apply lock/tag, release stored energy, verify zero energy state', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Verify zero energy, shut down equipment, isolate energy source', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Notify no one, isolate energy, begin work immediately', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'During brazing on an occupied job site, what is the primary purpose of purging the copper tubing with dry nitrogen?', 'Nitrogen purging displaces oxygen inside the tubing during brazing, preventing internal oxide scale formation and reducing the atmosphere available to support combustion.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To cool the joint faster after brazing', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To prevent internal oxidation (scale) and reduce combustible atmosphere inside the tubing', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To pressure test the system simultaneously', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To add refrigerant charge while brazing', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A recovery cylinder''s hydrostatic test stamp shows a date that has passed. What is the correct action?', 'A cylinder past its hydrostatic test date has not been verified safe to hold pressure and must not be filled until it passes retesting or requalification.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Fill it as normal since the cylinder still looks fine', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Do not fill the cylinder; it must be requalified/retested before use', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Fill it to only 50% capacity to compensate', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Use it only for low-pressure refrigerants', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What distinguishes an A2L refrigerant''s flammability hazard from an A3 refrigerant like propane (R-290)?', 'A2L refrigerants are mildly flammable with a low burning velocity, making them significantly less hazardous to ignite and propagate flame than highly flammable A3 refrigerants such as propane, though A2L still requires flammability precautions.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A2L refrigerants are completely nonflammable under all conditions', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A2L refrigerants have a low burning velocity and higher ignition energy requirements than the highly flammable A3 class', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A3 refrigerants are always less hazardous during service', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'There is no meaningful difference in service precautions', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Under OSHA''s General Duty Clause, an employer''s obligation applies:', 'The General Duty Clause requires employers to provide a workplace free from recognized serious hazards even when no specific OSHA standard directly addresses that particular hazard.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only to hazards explicitly listed in a specific OSHA standard', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only in states with their own OSHA-approved plans', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To recognized hazards likely to cause death or serious harm, even without a specific standard covering that hazard', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only to hazards reported by a union representative', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'safety-fundamentals')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 2. Thermodynamics Fundamentals ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals'), 'Thermodynamics Fundamentals — knowledge check', '8 questions covering thermodynamics fundamentals. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"thermodynamics","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A thermostat reads 68°F. What is this temperature in Celsius?', 'C = (68 - 32) x 5/9 = 36 x 5/9 = 20°C. (Correct answer is 20.0°C, option index 1.)', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '15.0°C', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '20.0°C', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '18.7°C', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '24.4°C', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the fundamental difference between heat and temperature?', 'Temperature is an intensity measurement (how hot/cold), while heat is energy transferred between bodies due to a temperature difference, and it depends on both temperature difference and mass/specific heat.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'They are the same physical quantity measured in different units', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Temperature measures the intensity of molecular motion; heat is thermal energy in transit due to a temperature difference', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Heat only exists in solids; temperature only applies to gases', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Temperature depends on mass; heat does not', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Water boiling at 212°F at sea level absorbs heat while remaining at a constant temperature. What type of heat is this?', 'Heat absorbed during a phase change at constant temperature (like boiling) is latent heat, as opposed to sensible heat, which changes temperature.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Sensible heat', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Latent heat', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Specific heat', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Radiant heat', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'The evaporator saturation pressure corresponds to 35°F on the P-T chart. The measured suction line temperature at the same location is 47°F. What is the superheat?', 'Superheat = actual temperature - saturation temperature = 47°F - 35°F = 12°F.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '82°F', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '12°F', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '35°F', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '47°F', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Condenser head pressure corresponds to a saturation temperature of 118°F. The liquid line temperature measured at the condenser outlet is 105°F. What is the subcooling?', 'Subcooling = saturation temperature - actual liquid temperature = 118°F - 105°F = 13°F.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '13°F', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '223°F', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '105°F', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '0°F, subcooling cannot be calculated this way', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which statement correctly describes the pressure-temperature relationship for a pure refrigerant?', 'For a pure substance, each pressure corresponds to exactly one saturation temperature; raising pressure raises the saturation temperature, which is the basis of the P-T chart.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Pressure and saturation temperature are unrelated variables', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'At a given pressure, there is exactly one saturation temperature at which liquid and vapor coexist in equilibrium', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Saturation temperature decreases as pressure increases', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The relationship only applies to refrigerant blends, not pure substances', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician feels heat from a hot rooftop condensing unit casing without touching it. Which heat transfer mode is primarily responsible?', 'Radiation transfers heat via electromagnetic waves and requires no direct contact or fluid medium, which is why heat can be felt without touching the hot surface.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Conduction', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Convection', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Radiation', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Latent heat transfer', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why does a vapor-compression refrigeration system require mechanical work (the compressor) to move heat from a cold space to a warmer environment?', 'The second law of thermodynamics states heat only flows spontaneously from high to low temperature; moving heat the opposite way (cold space to warm outdoors) requires external work input from the compressor.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because refrigerant naturally flows from warm to cold on its own and work is only needed for airflow', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because heat does not spontaneously flow from a lower to a higher temperature; external work is required to force it in that direction', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because compressors are only needed to filter the refrigerant', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because latent heat does not apply to mechanical refrigeration systems', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'thermodynamics-fundamentals')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 3. The Basic Refrigeration Cycle ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle'), 'The Basic Refrigeration Cycle — knowledge check', '8 questions covering the basic refrigeration cycle. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"refrigeration-cycle","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the correct order of the four main processes in the vapor-compression refrigeration cycle?', 'The refrigerant is compressed, then condensed, then expanded through the metering device, then evaporated, before returning to the compressor to repeat the cycle.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Evaporation, compression, condensation, metering/expansion', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Compression, condensation, metering/expansion, evaporation', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Condensation, evaporation, compression, metering/expansion', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Metering/expansion, evaporation, compression, condensation', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'At the evaporator inlet (immediately after the metering device), what is the typical phase of the refrigerant?', 'The abrupt pressure drop across the metering device causes a portion of the liquid to flash into vapor, so the evaporator inlet contains a liquid/vapor mixture.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Fully superheated vapor', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Subcooled liquid only', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A liquid/vapor mixture', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Solid', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which component separates the high side from the low side on the discharge/return path?', 'The compressor raises pressure (low side to high side boundary) and the metering device drops pressure (high side to low side boundary), together defining the two pressure regions.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The compressor and the metering device mark the two boundaries between high side and low side', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The evaporator alone', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The condenser fan motor', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The liquid line filter drier', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'On a pressure-enthalpy (P-H) diagram, what does the horizontal line segment during evaporation represent?', 'Evaporation occurs at constant (low) pressure while enthalpy increases as the refrigerant absorbs heat; this horizontal span represents the system''s refrigeration effect.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A sharp pressure drop with no change in enthalpy', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Constant pressure with increasing enthalpy as heat is absorbed, representing refrigeration effect', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Constant enthalpy with increasing pressure', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A vertical rise representing compressor work', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why does heat flow from indoor air into the evaporator coil during normal cooling operation?', 'The metering device drops the refrigerant pressure and thus its saturation temperature below room temperature, so heat naturally flows from the warmer air into the colder refrigerant.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because the refrigerant is chemically attracted to heat', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because the metering device lowers the refrigerant''s saturation temperature below the indoor air temperature, and heat flows from higher to lower temperature', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because the compressor pulls heat directly through the suction line', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because indoor air is always cooler than the refrigerant', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'In heat pump (reverse cycle) heating mode, which statement is correct?', 'In heating mode, the reversing valve redirects flow so the outdoor coil absorbs heat from outside air (acting as the evaporator) while the indoor coil rejects heat indoors (acting as the condenser).', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The outdoor coil becomes the condenser and the indoor coil becomes the evaporator', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The outdoor coil becomes the evaporator and the indoor coil becomes the condenser', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The compressor is bypassed entirely during heating mode', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A separate refrigerant is used for heating mode only', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What primarily distinguishes absorption refrigeration from mechanical vapor-compression refrigeration?', 'Absorption systems use a heat source combined with an absorbent fluid pair (such as ammonia-water) to drive the refrigeration cycle, largely eliminating the need for a mechanical compressor.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Absorption refrigeration does not use refrigerant at all', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Absorption refrigeration uses a heat source and absorbent fluid pair to drive the cycle instead of a mechanically driven compressor', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Absorption refrigeration only works with A2L refrigerants', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Absorption refrigeration cannot produce cooling, only heating', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Immediately after the compressor discharge port, what best describes the refrigerant''s condition?', 'The compressor discharges refrigerant as high-pressure, high-temperature superheated vapor, which then flows to the condenser to reject heat.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low-pressure, cold, subcooled liquid', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'High-pressure, hot, superheated vapor', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low-pressure, cold liquid/vapor mixture', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'High-pressure, cold subcooled liquid', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'the-basic-refrigeration-cycle')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 4. Refrigerants: Properties, Classification & Regulation ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation'), 'Refrigerants: Properties, Classification & Regulation — knowledge check', '8 questions covering refrigerants: properties, classification & regulation. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"refrigerants-regulations","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which refrigerant series designation is reserved for zeotropic blends such as R-410A and R-407C?', 'The R-4xx series under ASHRAE 34 is reserved for zeotropic blends, mixtures that do not behave as a single substance and exhibit temperature glide.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-1xx series', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-2xx series', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-4xx series', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-1xxx series', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A refrigerant is rated A2L under ASHRAE 34. What does this tell you?', 'A2L combines Class A (lower toxicity) with Class 2L (mildly flammable, low burning velocity); it says nothing directly about GWP, which is a separate metric.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It is highly toxic and nonflammable', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It has lower toxicity and is mildly flammable with a low burning velocity', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It has higher toxicity and is highly flammable', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It has zero global warming potential', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A refrigerant has a GWP of 1,810 and an ODP of 0.05. Which refrigerant generation does this best describe?', 'A nonzero but relatively low ODP combined with a high GWP is characteristic of an HCFC like R-22, which still contains chlorine but at lower ozone impact than older CFCs.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A CFC', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'An HCFC (e.g., R-22)', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A pure HFO', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A natural refrigerant like CO2', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'As of January 1, 2025, the EPA Technology Transitions rule requires newly manufactured residential and light commercial AC/heat pump equipment in the U.S. to use refrigerant with a GWP no higher than:', 'The Technology Transitions rule sets a GWP limit of 700 or lower for new residential and light commercial AC and heat pump equipment manufactured starting January 1, 2025, favoring refrigerants like R-454B and R-32.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '150', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '300', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '700', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '2,088', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which of the following best explains why R-454B has become the primary replacement for R-410A in new U.S. residential equipment?', 'R-454B''s GWP of roughly 466 satisfies the EPA''s sub-700 GWP requirement for new equipment, while its A2L classification requires specific safety design and handling but is manageable at the mild flammability level.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-454B has a higher GWP than R-410A but better cooling performance', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-454B has a GWP (~466) well below the 700 limit and is compatible with equipment designed for A2L safety requirements', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-454B is a nonflammable A1 refrigerant with no special handling requirements', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-454B has zero ozone depletion potential but no GWP advantage over R-410A', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'The AIM Act''s HFC phasedown allocates a shrinking pool of production/import allowances measured against what reference point?', 'The AIM Act''s HFC phasedown schedule steps down allowances against a 2012 baseline, consistent with the Kigali Amendment framework.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A 2005 baseline', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A 2012 baseline', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A 1987 baseline (Montreal Protocol signing)', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'No fixed baseline; it is set annually with no reference year', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the key difference between ODP and GWP as environmental metrics?', 'ODP quantifies ozone layer destruction potential (indexed to R-11), while GWP quantifies relative atmospheric warming contribution over a time horizon (indexed to CO2); a refrigerant can have zero ODP and still have a high GWP.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'ODP measures contribution to atmospheric warming; GWP measures ozone layer damage', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'ODP measures a substance''s potential to destroy stratospheric ozone; GWP measures its relative contribution to atmospheric warming over time', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'They measure the exact same environmental effect using different units', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'ODP only applies to HFCs; GWP only applies to CFCs', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why do the AIM Act phasedown and EPA Technology Transitions rule together explain the recent rise of A2L refrigerants in field equipment?', 'The GWP limits imposed by these regulations rule out most high-GWP A1 HFCs for new equipment, and the practical, scalable low-GWP alternatives (R-32, R-454B, etc.) happen to be mildly flammable A2L refrigerants, driving new safety practices industry-wide.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A2L refrigerants were mandated specifically because they are flammable', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low-GWP limits effectively exclude most legacy high-GWP A1 HFCs from new equipment, and the best available low-GWP substitutes at scale happen to carry the mildly flammable A2L classification', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A2L refrigerants have no relationship to GWP regulations; their adoption is coincidental', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The AIM Act specifically bans all A1 refrigerants regardless of GWP', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerants-properties-classification-and-regulation')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 5. Compressors ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors'), 'Compressors — knowledge check', '8 questions covering compressors. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"compressors","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the primary function of the compressor in a refrigeration system?', 'The compressor''s job is to compress low-pressure, low-temperature vapor from the evaporator into high-pressure, high-temperature vapor that can reject heat at the condenser above ambient temperature.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reject heat to ambient air', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Raise the pressure and temperature of refrigerant vapor so it can reject heat at the condenser', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Meter refrigerant flow into the evaporator', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Boil liquid refrigerant to absorb heat', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which compressor type uses two interleaving spiral elements, one fixed and one orbiting, to trap and compress refrigerant vapor?', 'The scroll design uses a fixed scroll and an orbiting scroll whose interleaving spirals form shrinking compression pockets.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reciprocating', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Rotary', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Scroll', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Screw', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician needs to service worn suction and discharge valves in the field without replacing the entire compressor. Which construction allows this?', 'Semi-hermetic compressors have bolted heads and valve plates that can be removed for field service, unlike welded hermetic shells.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Hermetic', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Semi-hermetic', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Open drive with a welded shell', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Fully hermetic scroll', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A system operating on R-410A has a suction pressure of 70 psig and a discharge pressure of 350 psig at sea level (atmospheric pressure is about 14.7 psi). What is the approximate compression ratio?', 'Converting to absolute pressures: 84.7 psia suction and 364.7 psia discharge gives a ratio of about 4.3:1.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '2.1:1', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '3.0:1', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '4.3:1', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '5.0:1', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A compressor short cycles repeatedly on a cold day, and each start produces a loud knocking sound. Oil is milky and foaming heavily in the sight glass. What is the most likely cause?', 'Milky, foaming oil combined with a knock on startup is the classic signature of a flooded start caused by refrigerant migration, usually from a failed or missing crankcase heater.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Overcharged condenser', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A failed crankcase heater allowing refrigerant migration and a flooded start', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A dirty condenser coil', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'TXV superheat set too high', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which failure mode is most directly caused by liquid refrigerant or oil entering the cylinder while the compressor is already running (not at startup)?', 'Slugging specifically refers to liquid entering the cylinder during operation, distinct from a flooded start which occurs at startup.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Slugging', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Short cycling', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Electrical burnout', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Flooded start', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician measures compressor winding resistance and finds one winding reads infinite resistance, while a megohm test shows good insulation resistance to ground. What does this indicate?', 'Infinite resistance across a winding indicates an open circuit in that winding; a good megohm reading rules out a ground fault.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A grounded winding', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'An open winding (internal open circuit), with no ground fault', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Normal operation', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A locked rotor condition', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which application would most likely require a two-stage (booster) compression system rather than a single-stage compressor?', 'Very low evaporator temperatures create a compression ratio too high for efficient single-stage operation, so two-stage/booster compression is used.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A residential 3-ton split AC system at a 45°F evaporator temperature', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A low-temperature freezer application requiring a -30°F evaporator temperature', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A water-cooled chiller producing 44°F leaving water', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A rooftop package unit for a retail store', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'compressors')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 6. Condensers ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers'), 'Condensers — knowledge check', '8 questions covering condensers. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"condensers","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What happens in the condensing zone of a condenser?', 'The condensing zone is where the phase change from vapor to liquid occurs at essentially constant temperature and pressure as latent heat is released.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Refrigerant vapor is cooled below saturation temperature', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Refrigerant changes phase from vapor to liquid at roughly constant pressure and temperature while releasing latent heat', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Refrigerant absorbs heat from the conditioned space', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Liquid refrigerant is metered into the evaporator', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'On a 95°F design day, a standard-efficiency air-cooled condenser is operating properly. Using the rule of thumb that condensing temperature runs about 25 to 30°F above ambient for standard equipment, what condensing temperature would you expect?', 'Adding 25 to 30°F to a 95°F ambient gives an expected condensing temperature of roughly 120 to 125°F.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'About 100 to 105°F', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'About 120 to 125°F', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'About 140 to 145°F', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'About 160 to 165°F', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which head pressure control method purposely floods a portion of the condenser coil with liquid refrigerant to maintain adequate head pressure in cold weather?', 'Flooded condenser (or receiver) control backs liquid refrigerant into the coil, reducing effective condensing surface and raising head pressure.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Fan cycling control', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Variable-speed fan control', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Flooded condenser/receiver head pressure control', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Evaporative condenser sump control', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician finds head pressure abnormally high on an air-cooled system. After shutting the system down and letting pressures equalize for several hours, the standing pressure is higher than the saturation pressure corresponding to ambient temperature on a P-T chart. This most strongly suggests:', 'With pure refrigerant, standing pressure after equalizing should match the P-T chart value at ambient temperature; a higher reading indicates trapped non-condensable gas adding its own partial pressure.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A dirty condenser coil', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Non-condensables (air) trapped in the system', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low refrigerant charge', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A failed condenser fan motor', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Liquid line pressure reads 250 psig on an R-410A system (saturation temperature about 95°F at that pressure), and the liquid line temperature at the condenser outlet measures 82°F. What is the subcooling?', 'Subcooling = saturation temperature minus actual liquid line temperature = 95 - 82 = 13°F.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '8°F', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '13°F', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '18°F', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '82°F', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A dirty, airflow-restricted air-cooled condenser coil would most likely cause which combination of symptoms?', 'Restricted airflow reduces heat rejection, driving head pressure and discharge temperature up and forcing the compressor to draw more current.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low head pressure and low discharge temperature', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'High head pressure, high discharge temperature, and increased compressor amp draw', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low suction pressure only, with normal head pressure', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'No measurable change in system performance', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which condenser type typically achieves the lowest condensing temperature relative to outdoor dry-bulb temperature because heat rejection is driven closer to the wet-bulb temperature?', 'Evaporative condensers rely on water evaporation, which is governed by wet-bulb temperature, typically lower than dry-bulb, allowing for lower and more stable condensing temperatures.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Air-cooled fin-and-tube condenser', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Shell-and-tube water-cooled condenser without a tower', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Evaporative condenser', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Static plate condenser', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A system''s subcooling reads well above the manufacturer''s target (25°F when 10°F is specified), while head pressure is also high. What does this most likely indicate?', 'Excess subcooling combined with high head pressure commonly signals an overcharge or a restriction backing liquid up in the condenser.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low refrigerant charge', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Overcharge of refrigerant or a restriction downstream of the condenser, such as a partially blocked liquid line filter drier', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A failed crankcase heater', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A TXV bulb that has come loose from the suction line', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'condensers')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 7. Metering / Expansion Devices ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices'), 'Metering / Expansion Devices — knowledge check', '8 questions covering metering / expansion devices. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"metering-devices","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What are the two primary functions of a metering device?', 'The metering device both establishes the system''s pressure differential and regulates how much refrigerant flows into the evaporator.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reject heat and absorb heat', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Create a pressure drop between the high and low sides and control refrigerant flow rate into the evaporator', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Compress vapor and separate oil', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Store refrigerant and filter contaminants', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which metering device has no moving parts and relies on a fixed tube length and diameter to restrict flow, making the refrigerant charge amount especially critical?', 'A capillary tube is a fixed-length, fixed-bore tube with no moving parts, so its performance depends heavily on having exactly the correct refrigerant charge.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'TXV', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'EEV', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Capillary tube', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Piston valve with a check valve', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'In a TXV, a rising suction line (bulb) temperature at the evaporator outlet under increased load causes which sequence of events?', 'A warmer suction line raises bulb pressure, which pushes the diaphragm to open the valve wider, increasing flow to match the added load and stabilizing superheat.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Bulb pressure decreases, the valve closes, and superheat rises further', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Bulb pressure increases, the valve opens wider, more refrigerant flows, and superheat is stabilized', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Spring pressure automatically increases to compensate', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The valve immediately closes to prevent flooding', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'An evaporator coil has multiple distributor circuits and a long refrigerant path, creating significant coil pressure drop. Which TXV configuration should be used?', 'An externally equalized TXV senses pressure directly at the evaporator outlet, compensating for the coil''s internal pressure drop, which an internally equalized valve cannot do accurately.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Internally equalized TXV', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Externally equalized TXV', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Fixed orifice with no equalization', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'EEV without a pressure sensor', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'How does an electronic expansion valve (EEV) primarily differ from a mechanical TXV in maintaining superheat?', 'EEVs replace the mechanical sensing and actuation of a TXV with electronic sensors and a stepper-motor-driven needle valve.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It uses a wax-filled bulb instead of a spring', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It uses a stepper motor controlled by an electronic controller and sensors rather than a mechanical bulb-diaphragm-spring assembly', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It only works on capillary tube systems', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It cannot modulate flow, only on/off', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician finds frost extending well up the suction line onto the compressor shell along with low superheat, and suspects the metering device. This pattern is most consistent with:', 'Frost migrating up the suction line combined with low superheat is a classic sign of liquid floodback caused by an overfeeding metering device.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Underfeeding due to a clogged filter drier', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Overfeeding of the evaporator, such as a TXV stuck open or a bulb not sensing correctly', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Non-condensables in the condenser', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A properly operating TXV at low load', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'At the evaporator outlet, suction pressure reads 118 psig, corresponding to a saturation temperature of 40°F on the R-410A P-T chart. The actual suction line temperature at that same point measures 50°F. What is the superheat, and is the TXV likely feeding correctly against a target of 8 to 12°F?', 'Superheat equals actual temperature minus saturation temperature: 50 - 40 = 10°F, which falls within the 8 to 12°F target range.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '90°F superheat; badly underfeeding', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '10°F superheat; feeding correctly within the target range', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '40°F superheat; overfeeding', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '-10°F superheat; flooding', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'An evaporator coil is only partially frosted (frost on the first few feet, the remainder warm and dry), suction pressure is lower than normal, and superheat measures 28°F against a 10°F target. What does this indicate?', 'A partially frosted, starved-looking coil combined with high superheat and low suction pressure points to underfeeding from a restriction or insufficient charge.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'An overfeeding TXV', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Underfeeding due to a restriction such as a clogged drier, low charge, or a throttled/faulty TXV', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A properly functioning capillary tube', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Excess subcooling at the condenser', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'metering-expansion-devices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 8. Evaporators & Heat Load ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load'), 'Evaporators & Heat Load — knowledge check', '8 questions covering evaporators & heat load. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"evaporators","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why does lowering the evaporator saturation pressure lower the boiling temperature of the refrigerant inside the coil?', 'A refrigerant''s boiling (saturation) temperature at any moment is set by its pressure; reducing pressure lowers the corresponding saturation temperature.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Refrigerant boiling point is unrelated to pressure', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Saturation temperature is a direct function of pressure, so lower pressure yields a lower boiling/saturation temperature', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Lower pressure increases the refrigerant''s latent heat only', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The compressor runs slower at low pressure', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which evaporator arrangement keeps the coil completely full of liquid refrigerant using a surge drum to separate liquid from vapor, rather than fully vaporizing the refrigerant with superheat inside the coil?', 'A flooded evaporator stays full of liquid at all times, with a surge drum separating vapor from recirculating liquid, unlike a DX coil which controls outlet superheat directly.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Direct expansion (DX)', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Flooded evaporator', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Plate-and-frame condenser', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Capillary tube evaporator', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A produce cooler is designed with a low evaporator TD (about 10°F) rather than a high TD (20°F). What is the main benefit of this design choice for storing fresh produce?', 'A low TD coil runs warmer relative to the box, removing less moisture from the air and reducing dehydration of humidity-sensitive produce.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Faster pull-down of product temperature', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A warmer, larger coil that removes less moisture from the air, reducing product dehydration and weight loss', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Lower initial equipment cost', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Elimination of the need for a defrost cycle', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Removing moisture (water vapor) from air at the evaporator coil, causing condensation or frost, is an example of which type of heat removal?', 'Condensing moisture out of the air is a phase-change process, which is latent heat removal, distinct from sensible cooling of dry-bulb temperature.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Sensible heat removal', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Latent heat removal', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Superheat removal', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Subcooling', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician notices heavy frost forming on an air conditioning evaporator coil (an application that should never frost under normal conditions), along with low suction pressure and low airflow across the coil. What does this frost pattern most likely indicate?', 'Frost on an AC coil signals an abnormally low coil surface temperature, usually from restricted airflow or low refrigerant charge, not normal operation.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Normal high-humidity operation', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A restriction/low-airflow or low-charge condition dropping coil surface temperature below freezing', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Excess refrigerant charge', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A properly functioning defrost cycle', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which defrost method routes hot compressor discharge gas directly through the evaporator coil to melt accumulated frost, and is commonly used on low-temperature freezer applications?', 'Hot gas defrost circulates hot compressor discharge gas through the coil, providing enough heat to melt frost even in freezer applications too cold for off-cycle defrost.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Off-cycle defrost', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Hot gas defrost', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Water defrost', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Natural convection defrost', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A walk-in cooler technician is called because the box ''won''t hold temperature,'' but refrigerant charge, superheat, and subcooling all check out normal. Employees report the dock door has been propped open frequently during a busy receiving day. What is the most likely explanation?', 'Normal refrigerant readings point away from a mechanical fault; frequent door openings and incoming warm product create additional infiltration and product heat load beyond the system''s steady-state design capacity.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Compressor valve failure', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Increased infiltration and product load temporarily exceeding the system''s design capacity', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Non-condensables in the condenser', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A TXV bulb that has lost its charge', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which of the following is considered a ''respiration load'' in refrigeration heat load concepts?', 'Respiration load specifically refers to the ongoing heat produced by living produce as it respires, even while held in cold storage.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Heat generated by evaporator fan motors', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Heat generated by living fruits and vegetables continuing to respire in storage', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Heat conducted through insulated walls', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Heat added by defrost heaters', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'evaporators-and-heat-load')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 9. Refrigerant System Components ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components'), 'Refrigerant System Components — knowledge check', '8 questions covering refrigerant system components. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"system-components","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the primary purpose of a liquid line filter-drier?', 'The filter-drier''s desiccant and screen remove moisture, acid byproducts, and solid contaminants that could damage the system or metering device.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Increase subcooling', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Remove moisture, acid, and particulates from refrigerant', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Store extra liquid refrigerant', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Separate oil from discharge gas', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician measures a 12°F temperature drop across a liquid line filter-drier. What does this indicate?', 'A temperature drop greater than about 3°F across a drier indicates a significant pressure drop caused by restriction, meaning the drier core is clogged and needs replacement.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The drier is functioning normally', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The system is overcharged', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The drier is restricted and should be replaced', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The receiver is undersized', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why is a suction accumulator especially important on heat pump systems?', 'Heat pumps experience reversing valve operation and variable loads (especially during defrost) that increase the risk of liquid refrigerant returning to the compressor, which the accumulator manages.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It increases compressor displacement', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It reduces electrical resistance in the compressor windings', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It protects against liquid floodback during defrost and variable load conditions', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It replaces the need for a filter-drier', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the function of the king valve on a receiver?', 'The king valve is a manually operated shutoff at the receiver outlet, closed during a pump-down procedure to trap refrigerant in the receiver and condenser.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To regulate high-side pressure automatically', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To act as a manual shutoff for isolating the receiver, typically used during pump-down', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To filter refrigerant entering the receiver', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To bypass the metering device', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician observes a system''s evaporator losing efficiency over time along with reduced compressor lubrication, despite adequate refrigerant charge. Which component''s malfunction is most likely responsible?', 'A failed or poorly returning oil separator allows oil to accumulate in the evaporator and suction line, reducing heat transfer and eventually starving the compressor of lubrication.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Sight glass', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Oil separator', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Check valve', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'King valve', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'In a heat pump system, why are check valves installed around the metering devices?', 'Check valves let refrigerant bypass whichever metering device is not needed for the current mode (heating or cooling), while forcing flow through the correct metering device.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To prevent oil migration only', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To allow refrigerant to bypass the inactive metering device depending on flow direction from the reversing valve', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To act as the primary pressure-reducing device', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To indicate moisture content', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Persistent bubbles are visible in a system''s liquid line sight glass under stable operating conditions. What is the most likely cause?', 'Continuous flash gas in the sight glass under stable conditions typically points to low charge or a restriction (such as a clogged drier) starving the liquid line of full liquid flow.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Excessive subcooling', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low refrigerant charge or a restriction upstream', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Overcharge of refrigerant', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A failed accumulator bleed hole', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why must a filter-drier used in a heat pump''s liquid line typically be bidirectional?', 'Heat pumps reverse refrigerant flow direction between heating and cooling, so the drier must filter effectively regardless of which way refrigerant is flowing through it.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because heat pumps operate at higher pressures', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because refrigerant flow direction reverses between heating and cooling modes', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because bidirectional driers remove more moisture', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Because standard driers cannot fit in heat pump lines', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'refrigerant-system-components')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 10. Electrical Fundamentals for HVAC/R ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r'), 'Electrical Fundamentals for HVAC/R — knowledge check', '8 questions covering electrical fundamentals for hvac/r. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"electrical-fundamentals","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A 24V control transformer secondary circuit has a total resistance of 60 ohms. Using Ohm''s law, what is the current draw?', 'I = E / R = 24V / 60 ohms = 0.4 amps.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '0.4 amps', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '1.44 amps', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '24 amps', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '60 amps', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'In a series circuit, if one safety switch opens, what happens to the rest of the circuit on that same rung?', 'In a series circuit there is only one path for current, so an open anywhere in that path breaks the entire circuit for every component on it.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only the switch itself loses power', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Current continues to flow around the open switch', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The entire series path is broken and all components on it stop receiving power', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Voltage doubles across the remaining components', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the main functional difference between a PSC motor and an ECM motor?', 'ECM motors use an internal electronic module to drive a brushless DC motor at variable speeds with higher efficiency, while PSC motors are fixed-speed AC induction motors using a run capacitor.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PSC motors run on DC power while ECM motors run on AC power', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'ECM motors offer variable speed and higher efficiency via an electronic control module, while PSC motors run at a fixed speed', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'ECM motors require a run capacitor while PSC motors do not', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PSC motors cannot be used for blower applications', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A single-phase compressor hums loudly, draws high amperage, and trips on overload but never starts. What is the most likely cause?', 'A shorted capacitor fails to provide the phase shift needed for starting torque, causing the motor to hum, draw excessive current, and trip on overload without starting.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'An open run capacitor', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A shorted run capacitor', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A welded contactor', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low control voltage', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'On a ladder diagram, the high-pressure and low-pressure controls are wired in series in the rung feeding the compressor contactor coil. What does this mean for operation?', 'Because the safeties are in series with the contactor coil, opening either one breaks the circuit to the coil and de-energizes the contactor, stopping the compressor.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Either safety opening will stop the compressor regardless of thermostat demand', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Both safeties must open simultaneously to stop the compressor', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The safeties only affect the condenser fan, not the compressor', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The thermostat overrides the safety controls', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician wants to measure the resistance of a compressor''s run winding. What is the correct procedure?', 'Resistance measurements must be taken on a de-energized, isolated component; measuring resistance on a live or still-connected circuit can produce false readings and is unsafe.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Measure resistance while the compressor is running', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'De-energize the circuit and isolate the winding before measuring resistance', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Measure voltage across the winding while powered', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Use the capacitance setting on the meter', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A three-phase compressor loses one incoming power leg but continues attempting to run on the remaining two phases. What condition is this, and what is the typical result?', 'Single-phasing occurs when one phase of a three-phase supply is lost; the motor tries to keep running on the remaining phases, causing excessive current draw and overheating.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Single-phasing; the motor overheats and draws excessive current on the remaining phases', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Short cycling; the compressor cycles on and off rapidly', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Voltage imbalance; no effect on the motor', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Locked rotor; the motor draws less current than normal', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A residential compressor will not shut off even after the thermostat is satisfied and the contactor coil is confirmed de-energized. What is the most likely cause?', 'If the contactor coil is de-energized but the load still runs, the contactor''s power contacts have likely welded shut from arcing, keeping the circuit closed regardless of coil state.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'An open run capacitor', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Welded (stuck-closed) contactor points', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A tripped circuit breaker', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low 24V control voltage', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'electrical-fundamentals-for-hvac-r')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 11. Controls & Safety Devices ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices'), 'Controls & Safety Devices — knowledge check', '8 questions covering controls & safety devices. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"controls-safety-devices","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the primary functional difference between a mechanical thermostat and an electronic thermostat?', 'Mechanical thermostats rely on a physical element like a bimetal strip or bellows to move contacts, while electronic thermostats use a sensor and microprocessor for more precise, feature-rich control.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Mechanical thermostats cannot control cooling equipment', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Electronic thermostats use a microprocessor and electronic sensor for tighter control and added features, while mechanical thermostats use a physical temperature-sensitive element to directly operate contacts', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Electronic thermostats always switch line voltage directly', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Mechanical thermostats require Wi-Fi connectivity', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A low-pressure control is being used for evaporator freeze protection. What condition causes it to stop the compressor?', 'In freeze protection service, the LPC opens when suction pressure (and corresponding evaporator temperature) drops low enough to risk icing the coil, stopping the compressor before that occurs.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Discharge pressure rising above set point', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Suction pressure dropping below a set point corresponding to a coil temperature near or below freezing', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Ambient temperature exceeding a set point', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Oil pressure differential dropping below set point', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why are many high-pressure controls designed as manual-reset only, rather than automatic reset?', 'Manual reset prevents the system from repeatedly restarting into the same high-pressure fault condition, which could otherwise cause compressor damage or a safety hazard.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Manual reset controls are cheaper to manufacture', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To force a technician to identify and correct the root cause before the compressor is allowed to restart', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Automatic reset controls are not compatible with dual-pressure control housings', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Manual reset is required by refrigerant handling regulations only', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A commercial refrigeration system uses demand defrost instead of time-temperature defrost. What is the main advantage of this approach?', 'Demand defrost initiates cycles based on actual detected frost buildup rather than a fixed timer, avoiding unnecessary defrost cycles and improving efficiency.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It eliminates the need for a defrost termination sensor', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It defrosts only when frost accumulation actually warrants it, saving energy compared to a fixed schedule', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It requires electric heating elements instead of hot gas', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It removes the need for a defrost timer entirely in all cases', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'An air-source heat pump enters defrost mode by reversing its cycle. What happens to the outdoor and indoor coils during this process?', 'Reverse cycle defrost switches the system into cooling mode momentarily, sending hot discharge gas to the outdoor coil to melt frost, while the indoor coil temporarily functions as an evaporator.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Both coils act as evaporators simultaneously', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The outdoor coil temporarily acts as the condenser (receiving hot discharge gas) while the indoor coil acts as an evaporator', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The indoor coil is bypassed entirely during defrost', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The reversing valve is not involved in defrost operation', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A large reciprocating compressor with a separate oil pump shuts down shortly after starting, and the technician suspects the oil pressure safety switch tripped. What condition would cause this trip?', 'The oil pressure safety switch monitors the differential between oil pump discharge and crankcase pressure, tripping if adequate lubrication pressure isn''t established within its time delay.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Suction pressure rising too quickly', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Discharge pressure exceeding the HPC set point', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Inadequate oil pump differential pressure not established within the time delay after start', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Ambient temperature dropping below freezing', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'In a pump-down control scheme, what happens immediately after the thermostat is satisfied and de-energizes the liquid line solenoid valve?', 'After the solenoid closes, the compressor keeps running momentarily to pump remaining low-side refrigerant into the receiver/condenser, until falling suction pressure opens the low-pressure control and stops the compressor.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The compressor stops instantly with no further pressure change', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The compressor continues running briefly, drawing down low-side pressure until the low-pressure control opens on falling pressure', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The high-pressure control immediately trips', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The liquid line solenoid reopens automatically', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician finds a compressor''s internal overload has tripped repeatedly, and after investigation determines the condenser fan motor failed, causing high head pressure and high current draw. Which safety device would you also expect to have been activated or nearing activation in this scenario, and why?', 'A failed condenser fan reduces the condenser''s ability to reject heat, causing discharge (high-side) pressure to climb, which would trip or approach tripping the high-pressure control in addition to overloading the compressor motor.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The low-pressure control, because suction pressure would drop sharply', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The high-pressure control, because a failed condenser fan reduces heat rejection and raises discharge pressure', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The oil pressure safety switch, because oil pump pressure is unrelated to condenser airflow', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The freeze stat, because coil icing would occur', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'controls-and-safety-devices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 12. Psychrometrics & Dehumidification ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification'), 'Psychrometrics & Dehumidification — knowledge check', '8 questions covering psychrometrics & dehumidification. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"psychrometrics-dehumidification","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A room is at 75°F and 55% RH. If the air temperature drops to 65°F with no moisture added or removed, what happens to the relative humidity?', 'RH depends on temperature; as air cools with the same humidity ratio, the air''s moisture-holding capacity drops, so the same absolute moisture content represents a higher percentage of saturation, raising RH.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It stays exactly the same because moisture content is unchanged', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It increases because cooler air can hold less moisture at the same absolute moisture content', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It decreases because cooler air holds more moisture', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It becomes impossible to determine without a hygrometer', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'On a psychrometric chart, which axis or feature directly represents the humidity ratio (absolute moisture content) of the air?', 'Humidity ratio (grains or pounds of moisture per pound of dry air) is plotted on the vertical axis, usually on the right side of a standard psychrometric chart.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The horizontal dry-bulb temperature axis', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The diagonal wet-bulb lines only', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The vertical axis, typically on the right side of the chart', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The saturation curve''s slope', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A cooling coil''s process line on a psychrometric chart moves horizontally to the left before eventually curving down and following the saturation curve. What does the horizontal (leftward) portion represent?', 'While entering air is still warmer than its dew point, cooling only lowers dry-bulb temperature (sensible cooling) with no change in humidity ratio, so the point moves straight left until it reaches the saturation curve.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Latent cooling only, with no temperature change', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Sensible cooling only, occurring before the air reaches its dew point', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reheat occurring at the coil face', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Condensate re-evaporating back into the airstream', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A dehumidifier''s cooling coil is running with a suction pressure that keeps the coil surface temperature just barely above the entering air''s dew point. What is the most likely practical result?', 'Condensation (and thus dehumidification) only occurs when the coil surface is below the entering air''s dew point; if the coil stays above dew point, cooling is essentially all sensible and moisture removal is negligible.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Excellent moisture removal with minimal temperature drop', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The unit will ice over rapidly due to excess condensation', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Little to no dehumidification, even though the air leaving the unit may feel cooler', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The compressor will short-cycle on high pressure', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A comfort air conditioner is rated with an SHR of 0.75 at design conditions. What does this tell a technician about the unit''s cooling capacity?', 'Sensible Heat Ratio is the fraction of total cooling capacity devoted to sensible heat removal; an SHR of 0.75 means three-quarters of the capacity lowers temperature and one-quarter removes moisture.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '75% of total capacity is latent (moisture removal) and 25% is sensible', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The unit removes no latent heat at all', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '75% of total capacity is sensible (temperature reduction) and 25% is latent (moisture removal)', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The unit is only 75% efficient compared to its rated tonnage', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A customer wants to dehumidify a 38°F cold storage anteroom down to a very low humidity ratio. Which technology is generally the better fit, and why?', 'At low entering air temperatures, DX coils are prone to frosting and lose latent capacity; desiccant systems remove moisture via adsorption, which works effectively at low temperatures and can reach very low humidity ratios that DX coils cannot practically achieve.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Refrigerant DX dehumidifier, because DX units are always cheaper to operate', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Desiccant dehumidifier, because adsorption does not depend on cooling air below its dew point and avoids coil frosting at low temperatures', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Neither technology can function below 40°F', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A larger compressor DX unit, because bigger compressors avoid frost formation regardless of entering air temperature', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'In a rotary desiccant dehumidification wheel, what is the purpose of the reactivation (regeneration) airstream?', 'The reactivation airstream is heated and passed through a separate segment of the rotating wheel to drive absorbed water vapor back out of the desiccant, regenerating its capacity before that segment rotates back into the process airstream.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To pre-cool the process air before it contacts the desiccant', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To heat the desiccant segment and drive off absorbed moisture so that portion of the wheel can adsorb moisture again', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To humidify the process air on the opposite side of the wheel', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To lubricate the wheel''s rotating mechanism', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A building''s air conditioning system is cycling on and off quickly, satisfying the thermostat''s temperature setpoint, but the space still feels sticky and humid. What psychrometric explanation best fits this complaint?', 'An oversized or short-cycling AC system can satisfy the temperature setpoint quickly without running long enough to remove sufficient moisture, leaving RH high even though the space feels temperature-comfortable at first glance; this is a classic case for adding dedicated dehumidification.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The dry-bulb temperature is too low, causing a false humidity reading', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Short run times prevent the coil from spending enough time cooling air below its dew point, so sensible cooling is satisfied but latent (moisture) removal is inadequate', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The thermostat is measuring dew point instead of dry-bulb temperature', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Relative humidity cannot be affected by an air conditioner under any circumstances', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'psychrometrics-and-dehumidification')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 13. System Types & Applications ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications'), 'System Types & Applications — knowledge check', '8 questions covering system types & applications. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"system-types-applications","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why do most household refrigerators use a capillary tube instead of a thermostatic expansion valve (TXV) as the metering device?', 'Domestic refrigerators run a narrow, predictable load and temperature range, so a simple, inexpensive fixed-restriction capillary tube provides adequate performance without the cost and complexity of a TXV.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Capillary tubes provide better superheat control across varying load conditions', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Capillary tubes are simple, low-cost, and adequate for a small, factory-sealed, fixed-charge system with a relatively narrow operating range', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'TXVs cannot be used with hydrocarbon refrigerants', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Household refrigerators do not require any metering device', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A supermarket''s low-temperature rack system fails. What is the most likely operational consequence compared to a failure in a single stand-alone reach-in freezer?', 'In a multiplex rack system, many fixtures are served by a shared bank of compressors; a rack-level failure can take down cooling to every case connected to that rack, unlike an independent stand-alone unit.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only one display case loses cooling, identical to a stand-alone unit failure', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Every frozen food fixture connected to that rack loses cooling simultaneously, since multiple cases share the centralized compressor rack', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only the medium-temperature cases are affected', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The failure has no impact on refrigeration because racks have unlimited redundancy by design', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which statement best describes how comfort air conditioning relates to other refrigeration applications?', 'Comfort air conditioning uses the same compressor-condenser-metering device-evaporator cycle as any refrigeration system; what sets it apart is the target evaporator/supply-air temperature range and the dual focus on sensible cooling and humidity (latent) control for occupant comfort.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It uses a fundamentally different thermodynamic cycle than food refrigeration', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It is a vapor-compression refrigeration application distinguished mainly by its target temperature range and its emphasis on both sensible and latent performance for comfort', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It never involves an evaporator or condenser', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It is only classified as refrigeration when a heat pump reversing valve is present', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A heat pump is operating in heating mode on a cold, humid day. Frost begins accumulating on the outdoor coil. What is the correct sequence of events during a defrost cycle to address this?', 'During defrost, the reversing valve shifts the system to cooling-mode refrigerant flow so hot discharge gas heats the outdoor coil and melts frost, while the outdoor fan is cycled off to speed melting; the system then reverts to heating mode once defrost terminates.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The compressor shuts off completely and the outdoor fan runs continuously until frost melts naturally', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The reversing valve temporarily switches to send hot discharge gas to the outdoor coil while the outdoor fan cycles off, melting the frost, then the system returns to normal heating operation', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The indoor blower reverses direction to blow warm air outdoors and melt the frost', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Auxiliary electric heat is used to physically heat the outdoor coil enclosure', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A heat pump''s manufacturer specifies a balance point of 25°F for a particular home. What does this mean for system operation when outdoor temperature drops to 15°F?', 'Below the balance point, the heat pump''s declining heating capacity can no longer match the building''s heat loss, so supplemental (auxiliary) heat, such as electric strips or a backup furnace, must make up the shortfall.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The heat pump will provide 100% of the required heating with no assistance, since it always outperforms its rated balance point in practice', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The heat pump''s capacity alone is insufficient to meet the building''s heat loss at that temperature, so supplemental heat is needed to maintain the indoor setpoint', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The heat pump will automatically switch to cooling mode below the balance point', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The balance point only applies to cooling mode, not heating mode', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A large office building''s engineer is choosing between an air-cooled and a water-cooled chiller for a new central plant. Which factor most directly favors the water-cooled option?', 'Because cooling towers reject heat largely through evaporation, water-cooled chillers can operate against a lower effective condensing temperature (closer to outdoor wet-bulb rather than dry-bulb), generally making them more efficient than air-cooled chillers, particularly in hot climates, at the cost of added tower maintenance.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Water-cooled chillers eliminate the need for any water treatment or maintenance', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Water-cooled chillers can condense closer to the outdoor wet-bulb temperature via a cooling tower, generally yielding higher efficiency than air-cooled units, especially in hot climates', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Air-cooled chillers cannot be used with air handling units', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Water-cooled chillers never require a cooling tower', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why is ammonia (R-717) widely used in large industrial refrigeration systems despite its toxicity?', 'Ammonia is valued in industrial refrigeration for its high efficiency, low cost, and zero-GWP/zero-ODP natural refrigerant status; its toxicity and mild flammability are managed through specialized detection, ventilation, and certified technician training rather than being a reason to avoid it.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It is the only refrigerant capable of reaching sub-zero temperatures', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It offers high thermodynamic efficiency and low cost as a natural, zero-GWP refrigerant, and its strong odor aids leak detection, though it requires specialized safety controls and trained technicians', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Ammonia systems require no special training because the refrigerant is completely non-toxic', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It is used specifically because it has the highest global warming potential of common refrigerants', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A supermarket wants to eliminate HFC refrigerants from its low-temperature freezer racks. Which technology described in this module is specifically associated with this goal, and why does it require special component considerations?', 'Transcritical CO2 booster systems are increasingly used to remove HFCs from supermarket refrigeration entirely, but because CO2 operates at significantly higher system pressures than traditional refrigerants, components and service practices must be rated and adapted for those higher pressures.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Standard R-404A rack systems, because R-404A is HFC-free', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Transcritical CO2 (R-744) booster systems, because CO2 operates at much higher pressures than traditional refrigerants, requiring appropriately rated components', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Domestic capillary-tube systems, because they use no compressor', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Air-cooled chillers, because they eliminate cooling towers', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'system-types-and-applications')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 14. Installation Practices ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices'), 'Installation Practices — knowledge check', '8 questions covering installation practices. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"installation-practices","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why is a dry nitrogen purge used inside copper tubing during brazing?', 'Without displacing oxygen, the heat of brazing oxidizes the copper''s interior, creating scale that later flakes off and contaminates filter driers, metering devices, and compressor components.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To cool the joint faster after brazing', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To prevent oxygen from forming oxide scale on the inside of the pipe', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To increase the melting point of the brazing alloy', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To pressure test the joint while it is being made', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which filler metal is appropriate for a copper-to-copper refrigerant line joint in an AC/refrigeration system?', 'Silver-based brazing alloys melt at high temperature (roughly 1190-1400°F) and produce a strong, leak-tight joint able to withstand refrigerant system pressures; soft solder cannot reliably hold system pressure.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '50/50 tin-lead plumbing solder', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PVC solvent cement', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A silver-based brazing alloy such as a BCuP-series or Sil-Fos rod', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Aluminum welding wire', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'During a standing nitrogen pressure test, the gauge shows a pressure drop overnight while ambient temperature also dropped. What should the technician conclude?', 'Gas pressure varies with temperature; a drop that correlates with falling ambient temperature is expected, whereas an unexplained drop beyond what temperature accounts for indicates a leak.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The system definitely has a leak and must be repaired immediately', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A pressure drop that correlates with a temperature drop can be normal and does not by itself indicate a leak', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The nitrogen has degraded and needs to be replaced', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The test is invalid and must be restarted using refrigerant instead of nitrogen', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why can''t a standard single-stage vacuum pump and a compound gauge alone reliably dehydrate a system?', 'Compound gauges typically read only to about 29.9 in. Hg, far short of the deep vacuum (measured in microns via a micron gauge) needed to boil off trapped moisture.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'They can''t reach a low enough vacuum level to boil off residual moisture, which requires deep vacuum measured in microns', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'They introduce too much oil into the system', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'They only work on systems under 5 tons', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Compound gauges read in microns and are too precise', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician needs to charge a large amount of refrigerant into a system quickly before initial startup, with the compressor off. What is the appropriate method?', 'Liquid charging into the high side with the compressor off allows fast, full charging without risking liquid slugging the compressor; liquid must never be fed into an operating compressor''s suction.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Charge vapor into the suction (low) side with the compressor running', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Charge liquid refrigerant into the high side with the compressor off', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Vent nitrogen while adding refrigerant simultaneously', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Charge liquid refrigerant directly into the suction line while the compressor runs', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which leak detection method is best suited for finding a slow, intermittent leak that has been present for weeks, after the system has been running normally?', 'UV dye circulates with the oil charge over time and accumulates visibly at a leak site, making it effective for finding slow or intermittent leaks that may not show clear symptoms at any single inspection.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Bubble solution only', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Standing nitrogen pressure test', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'UV dye that has circulated with the system oil, viewed under a UV lamp', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Listening for a hissing sound', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why should a long vertical suction line riser sometimes be sized one size smaller than a level run of the same capacity?', 'A smaller riser increases vapor velocity, which is necessary to physically lift entrained oil droplets up a vertical run back toward the compressor; too low a velocity leaves oil stranded in the riser.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To reduce material cost', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To increase refrigerant velocity so entrained oil can be carried upward against gravity', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To reduce noise at the compressor', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Smaller pipe always reduces pressure drop', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the primary danger of using compressed shop air instead of nitrogen to pressure test a refrigeration system?', 'Oxygen combined with refrigerant oil under pressure is a recognized explosion hazard, and compressed shop air also introduces moisture and contaminants; dry nitrogen is the correct test medium.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Shop air is too expensive compared to nitrogen', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Oxygen in shop air mixed with refrigerant oil under pressure can create an explosion hazard, and it introduces moisture/oil contamination', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Shop air cannot reach high enough pressures', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Shop air will trigger a false leak detector reading', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'installation-practices')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 15. Troubleshooting & Diagnostics ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics'), 'Troubleshooting & Diagnostics — knowledge check', '8 questions covering troubleshooting & diagnostics. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"troubleshooting-diagnostics","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is the correct first step in a systematic troubleshooting approach?', 'Gathering information first (what, when, what changed) focuses the investigation and often reveals clues that save time before any testing begins.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Immediately connect manifold gauges to check pressures', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Replace the part most commonly associated with the complaint', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Gather information from the customer about the complaint and any recent changes', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Perform a full electrical safety lockout', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician measures suction pressure and looks up the corresponding saturation temperature on a PT chart. What does this saturation temperature represent?', 'A PT chart shows the fixed relationship between pressure and the boiling/condensing point (saturation temperature) for a specific refrigerant at that pressure.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The actual temperature of the refrigerant vapor at the compressor inlet', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The temperature at which the refrigerant boils/condenses at that specific pressure', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The ambient outdoor air temperature', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The target supply air temperature for the space', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'On a system with a fixed-orifice metering device, superheat is measured high while subcooling is normal. Airflow across both coils has been confirmed normal. What is the most likely cause?', 'High superheat with normal subcooling, once airflow is ruled out, points to too little refrigerant reaching/vaporizing in the evaporator, consistent with undercharge or a restriction.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Overcharge', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Undercharge or a restriction upstream of the evaporator', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Failed condenser fan motor', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Non-condensables in the high side only', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'On a TXV-equipped system, why is subcooling a more reliable charge indicator than superheat?', 'Because a TXV modulates to maintain its designed superheat, superheat readings stay relatively stable even as charge varies, making subcooling the better charge-verification metric on TXV systems.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'TXV systems don''t have measurable superheat', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The TXV actively regulates superheat to a target value, so superheat stays fairly constant regardless of charge level, while subcooling reflects charge more directly', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Subcooling is easier to measure with a clamp meter', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Superheat only applies to fixed-orifice systems and is undefined on TXV systems', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A rooftop unit exhibits high head pressure, but suction pressure and superheat are otherwise normal. What should the technician check first?', 'High head pressure with otherwise normal low-side readings is classically caused by poor heat rejection at the condenser — a dirty coil, failed fan, or restricted airflow.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The evaporator filter', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The condenser coil for dirt/blockage and confirm the condenser fan is operating correctly', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The thermostat batteries', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The low-pressure safety switch', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A compressor is making unusual mechanical noise and the evaporator coil shows signs of liquid refrigerant not fully vaporizing. What condition should the technician suspect?', 'Liquid refrigerant reaching and entering the compressor (flooding/slugging) causes noise and risks mechanical damage, and is often linked to overcharge or a malfunctioning/oversized metering device.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Normal operation at low load', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Flooding/liquid slugging, potentially from overcharge or a metering device issue', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A clean, well-maintained condenser coil', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'An overly restrictive filter drier', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why must gauge manifold hoses be purged of air before connecting to a refrigerant system?', 'Air trapped in hoses introduces non-condensable gas into the system, skewing pressure readings and reducing heat transfer efficiency once it enters the refrigerant circuit.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To make the hoses easier to disconnect later', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To prevent air/moisture (non-condensables) from entering the system and affecting pressure readings and performance', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Purging hoses has no real diagnostic purpose, it''s just tradition', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To increase the accuracy of the clamp meter', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which practice is a safety violation when using diagnostic tools on an operating system?', 'Safety controls like high- and low-pressure switches exist to prevent catastrophic failure or hazardous conditions; bypassing them to keep equipment running is unsafe and improper practice.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Wearing safety glasses when connecting gauges', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Discharging a capacitor safely before handling it', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Bypassing a high-pressure safety switch to keep a unit running during diagnosis', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Using a micron gauge to check vacuum depth', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'troubleshooting-and-diagnostics')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 16. Preventive Maintenance ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance'), 'Preventive Maintenance — knowledge check', '8 questions covering preventive maintenance. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"maintenance","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which of the following best explains why preventive maintenance reduces long-term operating cost, even though it has an upfront service cost?', 'Small inefficiencies and developing faults quietly raise energy use and risk of failure; catching them early through PM is cheaper than the energy waste or emergency repair that results from ignoring them.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM eliminates the need for any future repairs entirely', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM catches efficiency losses (dirty coils, low charge, worn belts) and developing failures early, before they cause higher energy use or emergency breakdowns', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM is required by all manufacturers regardless of benefit', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM primarily benefits the technician''s invoicing, not the customer', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'During a PM visit on a walk-in cooler, the technician notices frost accumulation is not fully clearing during the defrost cycle. What should be checked?', 'Incomplete frost clearing during defrost points to a problem within the defrost system itself — timer/controller, heater, or termination/limit control — rather than unrelated components.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The thermostat batteries only', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The defrost timer/controller, defrost heater function, and termination/limit controls', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The building''s electrical service size', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The condenser fan motor capacitor only', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why might PM checklists differ for equipment in a coastal, high-salinity environment versus a dry inland environment?', 'Environmental conditions like salt air accelerate specific failure modes (coil corrosion), so an effective PM program adjusts checklist frequency and focus to the installation''s actual environment.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM checklists should never vary by environment', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Coastal environments accelerate coil corrosion, so more frequent coil inspection/protection may be warranted', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Salt air improves refrigerant performance', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Inland environments require more frequent condensate drain cleaning than coastal ones in all cases', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician notices a slight oily residue at a braze joint on a rooftop unit''s suction line during a routine PM visit. What does this most likely indicate?', 'Refrigerant oil is miscible with refrigerant and leaks alongside it; oily residue at a joint is a classic visual indicator of a slow leak at that location.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Normal condensation with no concern', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A slow refrigerant leak, since oil travels with refrigerant and leaves a visible trace at the leak point', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A defective condenser fan motor', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'An overcharged system with no leak', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Why is it important to record specific readings (pressures, temperatures, amp draws) during a PM visit rather than just noting ''system OK''?', 'A documented baseline allows future visits to identify gradual trends (e.g., slowly rising amp draw) that would be invisible without historical comparison data.', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Detailed readings are legally required for every service call regardless of system size', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Recorded readings create a baseline that lets future technicians detect gradual degradation over time by comparison', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Detailed readings are only useful for billing purposes', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Readings have no diagnostic value if the system currently seems fine', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'What is a key seasonal PM consideration specific to heat pumps that is less relevant to straight air conditioning systems?', 'Heat pumps rely on a reversing valve and a functioning defrost cycle for effective heating operation, which is worth specifically verifying before cold weather arrives, unlike straight cooling-only equipment.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Filter replacement', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Verifying reversing valve operation and defrost cycle function ahead of the heating season', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Cleaning the condensate drain', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Torquing electrical connections', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'How does consistent PM support regulatory refrigerant emissions compliance?', 'Early leak detection through PM keeps annual leak rates below regulatory thresholds, avoiding the mandatory repair triggers and refrigerant waste associated with undetected, growing leaks.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM has no connection to emissions regulations', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM catches small leaks early through inspection and charge verification, preventing them from growing into threshold-exceeding leak rates that trigger mandatory repair requirements', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM is only about improving comfort, not emissions', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Emissions compliance is solely the manufacturer''s responsibility', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'During PM on a reach-in refrigerated display case, a technician finds a torn door gasket. What operational effect is this most likely to cause?', 'A torn gasket allows warm, moist ambient air to infiltrate the cabinet, increasing the load on the evaporator coil, accelerating frost buildup, and increasing compressor run time and energy use.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reduced infiltration load and less coil frosting', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Increased infiltration of warm, humid air, leading to greater coil icing and increased run time/energy use', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Improved cabinet temperature stability', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'No measurable effect on system performance', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'preventive-maintenance')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── 17. Codes, Regulations & EPA 608 Certification ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'module', (SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification'), 'Codes, Regulations & EPA 608 Certification — knowledge check', '8 questions covering codes, regulations & epa 608 certification. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","module":"codes-certification","question_count":8}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A technician will primarily service residential split-system air conditioners using R-410A. Which EPA 608 certification type is required at minimum?', 'R-410A systems are classified as high-pressure appliances under Type II, which requires passing a practical exam component and covers that pressure category regardless of charge size.', 0
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Type I', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Type II', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Type III', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'No certification is required for R-410A systems', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which appliance category does Type III EPA 608 certification cover?', 'Type III certification specifically covers low-pressure appliances, primarily low-pressure chillers using refrigerants like R-11 and R-113.', 1
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Household refrigerators under 5 pounds of charge', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'High-pressure split systems like R-22 and R-404A equipment', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low-pressure chillers using refrigerants such as R-11 and R-113', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only A2L refrigerant systems', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A commercial refrigeration system contains 60 pounds of refrigerant charge. Its annualized leak rate is calculated at 18%. What is the regulatory outcome?', 'Commercial refrigeration systems over 50 pounds have a 20% annual leak rate threshold; an 18% leak rate is below that threshold, so mandatory repair is not yet triggered, though continued monitoring is still warranted.', 2
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Mandatory repair is triggered because 18% exceeds the 10% comfort cooling threshold', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'No mandatory repair is triggered because 18% is below the 20% commercial refrigeration threshold for systems over 50 pounds', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Mandatory repair is triggered regardless of leak rate because the system is over 50 pounds', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The system must be immediately decommissioned', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'For a large comfort-cooling chiller with over 50 pounds of charge that exceeds its applicable leak rate threshold, what is the required repair timeline once the leak is discovered?', 'Once a system over 50 pounds exceeds its sector''s leak rate threshold, EPA regulations require repair within 30 days of discovery, with limited allowances for documented extensions.', 3
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '7 days', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '30 days', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '90 days', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'One year, at the next scheduled PM visit', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A shop technician uses a job-site recovery machine to remove refrigerant from a system, then runs it through an on-site moisture and acid filter for reuse in the same customer''s other equipment. What has the technician performed?', 'Reducing contaminants for reuse in the same owner''s equipment, without verifying full AHRI 700 resale purity, is the definition of recycling, not reclaiming (which requires AHRI 700 verification, typically off-site).', 4
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reclaiming, since AHRI 700 purity was achieved', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Recycling, since contaminants were reduced for reuse in equipment under the same ownership without meeting resale purity standards', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Recovery only, with no further processing', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Venting, which is prohibited', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A shop that has only standard A1-rated recovery machines takes on a service call for a new residential system charged with R-454B. What is the correct action?', 'R-454B is an A2L (mildly flammable) refrigerant, and standard A1-rated recovery equipment is not approved for A2L service; A2L-specific recovery equipment and accessories are required.', 5
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Use the standard A1 recovery machine since all recovery machines are interchangeable across refrigerant types', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Use A2L-rated recovery equipment, gauges, and hoses specifically certified for A2L refrigerant service', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Vent the refrigerant to atmosphere instead of recovering it, since it''s a small residential system', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Use the A1 machine but run it at a lower vacuum level to compensate', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'Which statement correctly distinguishes recovery from reclaiming?', 'Recovery is the basic act of removing refrigerant without necessarily testing or cleaning it, whereas reclaiming is the more rigorous, typically off-site process of restoring refrigerant to AHRI 700 purity for resale.', 6
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Recovery and reclaiming are the same process performed at different locations', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Recovery is simply removing refrigerant from equipment without necessarily testing it, while reclaiming processes refrigerant to AHRI 700 purity, typically off-site, for resale', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Recovery requires AHRI 700 purity testing, while reclaiming does not', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reclaiming can only be performed using a standard job-site recovery machine', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, 'A facility in California operates a large commercial refrigeration system. Which statement about applicable requirements is correct?', 'California''s CARB program is a state-level example of requirements that can be stricter than and layered on top of federal EPA rules; state programs can add requirements but cannot lower the federal floor.', 7
FROM learn_quizzes z WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only the federal EPA 608 program applies; California has no additional requirements', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'California''s CARB Refrigerant Management Program may impose stricter leak inspection, reporting, and repair requirements in addition to federal EPA rules', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'State programs replace federal EPA requirements entirely wherever they exist', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'CARB requirements only apply to residential air conditioning, not commercial refrigeration', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'module' AND z.scope_id = ((SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = 'refrigeration-hvacr' WHERE mm.slug = 'codes-regulations-and-epa-608-certification')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── Capstone: the final exam ──

INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT 'category', (SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'), 'Refrigeration & HVAC/R — final exam', '34 cumulative questions, two from each of the 17 subjects. 80% to pass, unlimited retakes, best score kept.', TRUE, '{"source":"hvacr-course-seed","scope":"capstone","question_count":34}'::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Safety Fundamentals) Why is a torch or open flame never used to heat a sealed refrigerant cylinder?', 'Heating a sealed pressure vessel directly with a flame causes internal pressure to rise rapidly and unpredictably, risking a violent rupture or explosion.', 0
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It wastes fuel and is inefficient', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It discolors the cylinder coating', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Pressure inside the sealed vessel rises rapidly with temperature and can cause a violent rupture', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It voids the manufacturer''s warranty only', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 0
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Safety Fundamentals) A technician needs to enter a walk-in cooler mechanical room after a suspected refrigerant leak. What is the primary hazard to check for before entry?', 'Refrigerant leaks in confined or enclosed spaces displace breathable air, which can lower oxygen levels below the safe threshold with little or no warning odor.', 1
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Excess humidity', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reduced oxygen concentration (asphyxiation risk)', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Excess carbon monoxide from the compressor only', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Static electricity buildup', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Thermodynamics Fundamentals) A thermostat reads 68°F. What is this temperature in Celsius?', 'C = (68 - 32) x 5/9 = 36 x 5/9 = 20°C. (Correct answer is 20.0°C, option index 1.)', 2
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '15.0°C', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '20.0°C', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '18.7°C', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '24.4°C', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 2
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Thermodynamics Fundamentals) What is the fundamental difference between heat and temperature?', 'Temperature is an intensity measurement (how hot/cold), while heat is energy transferred between bodies due to a temperature difference, and it depends on both temperature difference and mass/specific heat.', 3
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'They are the same physical quantity measured in different units', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Temperature measures the intensity of molecular motion; heat is thermal energy in transit due to a temperature difference', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Heat only exists in solids; temperature only applies to gases', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Temperature depends on mass; heat does not', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 3
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(The Basic Refrigeration Cycle) What is the correct order of the four main processes in the vapor-compression refrigeration cycle?', 'The refrigerant is compressed, then condensed, then expanded through the metering device, then evaporated, before returning to the compressor to repeat the cycle.', 4
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 4
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Evaporation, compression, condensation, metering/expansion', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Compression, condensation, metering/expansion, evaporation', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Condensation, evaporation, compression, metering/expansion', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Metering/expansion, evaporation, compression, condensation', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 4
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(The Basic Refrigeration Cycle) At the evaporator inlet (immediately after the metering device), what is the typical phase of the refrigerant?', 'The abrupt pressure drop across the metering device causes a portion of the liquid to flash into vapor, so the evaporator inlet contains a liquid/vapor mixture.', 5
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 5
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Fully superheated vapor', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Subcooled liquid only', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A liquid/vapor mixture', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Solid', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 5
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Refrigerants: Properties, Classification & Regulation) Which refrigerant series designation is reserved for zeotropic blends such as R-410A and R-407C?', 'The R-4xx series under ASHRAE 34 is reserved for zeotropic blends, mixtures that do not behave as a single substance and exhibit temperature glide.', 6
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 6
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-1xx series', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-2xx series', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-4xx series', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'R-1xxx series', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 6
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Refrigerants: Properties, Classification & Regulation) A refrigerant is rated A2L under ASHRAE 34. What does this tell you?', 'A2L combines Class A (lower toxicity) with Class 2L (mildly flammable, low burning velocity); it says nothing directly about GWP, which is a separate metric.', 7
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 7
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It is highly toxic and nonflammable', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It has lower toxicity and is mildly flammable with a low burning velocity', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It has higher toxicity and is highly flammable', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It has zero global warming potential', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 7
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Compressors) What is the primary function of the compressor in a refrigeration system?', 'The compressor''s job is to compress low-pressure, low-temperature vapor from the evaporator into high-pressure, high-temperature vapor that can reject heat at the condenser above ambient temperature.', 8
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 8
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reject heat to ambient air', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 8
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Raise the pressure and temperature of refrigerant vapor so it can reject heat at the condenser', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 8
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Meter refrigerant flow into the evaporator', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 8
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Boil liquid refrigerant to absorb heat', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 8
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Compressors) Which compressor type uses two interleaving spiral elements, one fixed and one orbiting, to trap and compress refrigerant vapor?', 'The scroll design uses a fixed scroll and an orbiting scroll whose interleaving spirals form shrinking compression pockets.', 9
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 9
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reciprocating', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 9
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Rotary', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 9
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Scroll', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 9
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Screw', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 9
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Condensers) What happens in the condensing zone of a condenser?', 'The condensing zone is where the phase change from vapor to liquid occurs at essentially constant temperature and pressure as latent heat is released.', 10
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 10
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Refrigerant vapor is cooled below saturation temperature', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 10
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Refrigerant changes phase from vapor to liquid at roughly constant pressure and temperature while releasing latent heat', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 10
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Refrigerant absorbs heat from the conditioned space', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 10
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Liquid refrigerant is metered into the evaporator', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 10
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Condensers) On a 95°F design day, a standard-efficiency air-cooled condenser is operating properly. Using the rule of thumb that condensing temperature runs about 25 to 30°F above ambient for standard equipment, what condensing temperature would you expect?', 'Adding 25 to 30°F to a 95°F ambient gives an expected condensing temperature of roughly 120 to 125°F.', 11
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 11
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'About 100 to 105°F', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 11
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'About 120 to 125°F', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 11
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'About 140 to 145°F', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 11
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'About 160 to 165°F', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 11
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Metering / Expansion Devices) What are the two primary functions of a metering device?', 'The metering device both establishes the system''s pressure differential and regulates how much refrigerant flows into the evaporator.', 12
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 12
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Reject heat and absorb heat', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 12
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Create a pressure drop between the high and low sides and control refrigerant flow rate into the evaporator', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 12
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Compress vapor and separate oil', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 12
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Store refrigerant and filter contaminants', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 12
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Metering / Expansion Devices) Which metering device has no moving parts and relies on a fixed tube length and diameter to restrict flow, making the refrigerant charge amount especially critical?', 'A capillary tube is a fixed-length, fixed-bore tube with no moving parts, so its performance depends heavily on having exactly the correct refrigerant charge.', 13
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 13
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'TXV', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 13
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'EEV', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 13
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Capillary tube', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 13
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Piston valve with a check valve', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 13
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Evaporators & Heat Load) Why does lowering the evaporator saturation pressure lower the boiling temperature of the refrigerant inside the coil?', 'A refrigerant''s boiling (saturation) temperature at any moment is set by its pressure; reducing pressure lowers the corresponding saturation temperature.', 14
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 14
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Refrigerant boiling point is unrelated to pressure', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 14
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Saturation temperature is a direct function of pressure, so lower pressure yields a lower boiling/saturation temperature', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 14
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Lower pressure increases the refrigerant''s latent heat only', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 14
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The compressor runs slower at low pressure', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 14
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Evaporators & Heat Load) Which evaporator arrangement keeps the coil completely full of liquid refrigerant using a surge drum to separate liquid from vapor, rather than fully vaporizing the refrigerant with superheat inside the coil?', 'A flooded evaporator stays full of liquid at all times, with a surge drum separating vapor from recirculating liquid, unlike a DX coil which controls outlet superheat directly.', 15
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 15
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Direct expansion (DX)', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 15
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Flooded evaporator', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 15
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Plate-and-frame condenser', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 15
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Capillary tube evaporator', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 15
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Refrigerant System Components) What is the primary purpose of a liquid line filter-drier?', 'The filter-drier''s desiccant and screen remove moisture, acid byproducts, and solid contaminants that could damage the system or metering device.', 16
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 16
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Increase subcooling', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 16
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Remove moisture, acid, and particulates from refrigerant', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 16
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Store extra liquid refrigerant', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 16
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Separate oil from discharge gas', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 16
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Refrigerant System Components) A technician measures a 12°F temperature drop across a liquid line filter-drier. What does this indicate?', 'A temperature drop greater than about 3°F across a drier indicates a significant pressure drop caused by restriction, meaning the drier core is clogged and needs replacement.', 17
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 17
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The drier is functioning normally', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 17
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The system is overcharged', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 17
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The drier is restricted and should be replaced', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 17
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The receiver is undersized', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 17
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Electrical Fundamentals for HVAC/R) A 24V control transformer secondary circuit has a total resistance of 60 ohms. Using Ohm''s law, what is the current draw?', 'I = E / R = 24V / 60 ohms = 0.4 amps.', 18
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 18
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '0.4 amps', TRUE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 18
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '1.44 amps', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 18
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '24 amps', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 18
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '60 amps', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 18
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Electrical Fundamentals for HVAC/R) In a series circuit, if one safety switch opens, what happens to the rest of the circuit on that same rung?', 'In a series circuit there is only one path for current, so an open anywhere in that path breaks the entire circuit for every component on it.', 19
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 19
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only the switch itself loses power', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 19
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Current continues to flow around the open switch', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 19
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The entire series path is broken and all components on it stop receiving power', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 19
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Voltage doubles across the remaining components', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 19
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Controls & Safety Devices) What is the primary functional difference between a mechanical thermostat and an electronic thermostat?', 'Mechanical thermostats rely on a physical element like a bimetal strip or bellows to move contacts, while electronic thermostats use a sensor and microprocessor for more precise, feature-rich control.', 20
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 20
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Mechanical thermostats cannot control cooling equipment', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 20
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Electronic thermostats use a microprocessor and electronic sensor for tighter control and added features, while mechanical thermostats use a physical temperature-sensitive element to directly operate contacts', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 20
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Electronic thermostats always switch line voltage directly', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 20
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Mechanical thermostats require Wi-Fi connectivity', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 20
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Controls & Safety Devices) A low-pressure control is being used for evaporator freeze protection. What condition causes it to stop the compressor?', 'In freeze protection service, the LPC opens when suction pressure (and corresponding evaporator temperature) drops low enough to risk icing the coil, stopping the compressor before that occurs.', 21
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 21
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Discharge pressure rising above set point', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 21
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Suction pressure dropping below a set point corresponding to a coil temperature near or below freezing', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 21
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Ambient temperature exceeding a set point', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 21
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Oil pressure differential dropping below set point', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 21
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Psychrometrics & Dehumidification) A room is at 75°F and 55% RH. If the air temperature drops to 65°F with no moisture added or removed, what happens to the relative humidity?', 'RH depends on temperature; as air cools with the same humidity ratio, the air''s moisture-holding capacity drops, so the same absolute moisture content represents a higher percentage of saturation, raising RH.', 22
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 22
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It stays exactly the same because moisture content is unchanged', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 22
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It increases because cooler air can hold less moisture at the same absolute moisture content', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 22
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It decreases because cooler air holds more moisture', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 22
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'It becomes impossible to determine without a hygrometer', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 22
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Psychrometrics & Dehumidification) On a psychrometric chart, which axis or feature directly represents the humidity ratio (absolute moisture content) of the air?', 'Humidity ratio (grains or pounds of moisture per pound of dry air) is plotted on the vertical axis, usually on the right side of a standard psychrometric chart.', 23
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 23
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The horizontal dry-bulb temperature axis', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 23
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The diagonal wet-bulb lines only', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 23
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The vertical axis, typically on the right side of the chart', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 23
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The saturation curve''s slope', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 23
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(System Types & Applications) Why do most household refrigerators use a capillary tube instead of a thermostatic expansion valve (TXV) as the metering device?', 'Domestic refrigerators run a narrow, predictable load and temperature range, so a simple, inexpensive fixed-restriction capillary tube provides adequate performance without the cost and complexity of a TXV.', 24
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 24
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Capillary tubes provide better superheat control across varying load conditions', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 24
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Capillary tubes are simple, low-cost, and adequate for a small, factory-sealed, fixed-charge system with a relatively narrow operating range', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 24
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'TXVs cannot be used with hydrocarbon refrigerants', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 24
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Household refrigerators do not require any metering device', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 24
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(System Types & Applications) A supermarket''s low-temperature rack system fails. What is the most likely operational consequence compared to a failure in a single stand-alone reach-in freezer?', 'In a multiplex rack system, many fixtures are served by a shared bank of compressors; a rack-level failure can take down cooling to every case connected to that rack, unlike an independent stand-alone unit.', 25
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 25
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only one display case loses cooling, identical to a stand-alone unit failure', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 25
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Every frozen food fixture connected to that rack loses cooling simultaneously, since multiple cases share the centralized compressor rack', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 25
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only the medium-temperature cases are affected', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 25
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The failure has no impact on refrigeration because racks have unlimited redundancy by design', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 25
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Installation Practices) Why is a dry nitrogen purge used inside copper tubing during brazing?', 'Without displacing oxygen, the heat of brazing oxidizes the copper''s interior, creating scale that later flakes off and contaminates filter driers, metering devices, and compressor components.', 26
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 26
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To cool the joint faster after brazing', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 26
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To prevent oxygen from forming oxide scale on the inside of the pipe', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 26
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To increase the melting point of the brazing alloy', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 26
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'To pressure test the joint while it is being made', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 26
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Installation Practices) Which filler metal is appropriate for a copper-to-copper refrigerant line joint in an AC/refrigeration system?', 'Silver-based brazing alloys melt at high temperature (roughly 1190-1400°F) and produce a strong, leak-tight joint able to withstand refrigerant system pressures; soft solder cannot reliably hold system pressure.', 27
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 27
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, '50/50 tin-lead plumbing solder', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 27
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PVC solvent cement', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 27
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'A silver-based brazing alloy such as a BCuP-series or Sil-Fos rod', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 27
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Aluminum welding wire', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 27
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Troubleshooting & Diagnostics) What is the correct first step in a systematic troubleshooting approach?', 'Gathering information first (what, when, what changed) focuses the investigation and often reveals clues that save time before any testing begins.', 28
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 28
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Immediately connect manifold gauges to check pressures', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 28
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Replace the part most commonly associated with the complaint', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 28
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Gather information from the customer about the complaint and any recent changes', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 28
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Perform a full electrical safety lockout', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 28
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Troubleshooting & Diagnostics) A technician measures suction pressure and looks up the corresponding saturation temperature on a PT chart. What does this saturation temperature represent?', 'A PT chart shows the fixed relationship between pressure and the boiling/condensing point (saturation temperature) for a specific refrigerant at that pressure.', 29
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 29
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The actual temperature of the refrigerant vapor at the compressor inlet', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 29
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The temperature at which the refrigerant boils/condenses at that specific pressure', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 29
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The ambient outdoor air temperature', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 29
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The target supply air temperature for the space', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 29
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Preventive Maintenance) Which of the following best explains why preventive maintenance reduces long-term operating cost, even though it has an upfront service cost?', 'Small inefficiencies and developing faults quietly raise energy use and risk of failure; catching them early through PM is cheaper than the energy waste or emergency repair that results from ignoring them.', 30
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 30
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM eliminates the need for any future repairs entirely', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 30
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM catches efficiency losses (dirty coils, low charge, worn belts) and developing failures early, before they cause higher energy use or emergency breakdowns', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 30
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM is required by all manufacturers regardless of benefit', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 30
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'PM primarily benefits the technician''s invoicing, not the customer', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 30
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Preventive Maintenance) During a PM visit on a walk-in cooler, the technician notices frost accumulation is not fully clearing during the defrost cycle. What should be checked?', 'Incomplete frost clearing during defrost points to a problem within the defrost system itself — timer/controller, heater, or termination/limit control — rather than unrelated components.', 31
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 31
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The thermostat batteries only', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 31
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The defrost timer/controller, defrost heater function, and termination/limit controls', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 31
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The building''s electrical service size', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 31
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'The condenser fan motor capacitor only', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 31
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Codes, Regulations & EPA 608 Certification) A technician will primarily service residential split-system air conditioners using R-410A. Which EPA 608 certification type is required at minimum?', 'R-410A systems are classified as high-pressure appliances under Type II, which requires passing a practical exam component and covers that pressure category regardless of charge size.', 32
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 32
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Type I', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 32
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Type II', TRUE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 32
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Type III', FALSE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 32
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'No certification is required for R-410A systems', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 32
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );
INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, '(Codes, Regulations & EPA 608 Certification) Which appliance category does Type III EPA 608 certification cover?', 'Type III certification specifically covers low-pressure appliances, primarily low-pressure chillers using refrigerants like R-11 and R-113.', 33
FROM learn_quizzes z WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr'))
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = 33
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Household refrigerators under 5 pounds of charge', FALSE, 0
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 33
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 0
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'High-pressure split systems like R-22 and R-404A equipment', FALSE, 1
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 33
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 1
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Low-pressure chillers using refrigerants such as R-11 and R-113', TRUE, 2
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 33
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 2
  );
INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, 'Only A2L refrigerant systems', FALSE, 3
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = 'category' AND z.scope_id = ((SELECT cc.id FROM learn_categories cc WHERE cc.slug = 'refrigeration-hvacr')) AND qq.display_order = 33
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = 3
  );


-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM learn_quizzes z
--   WHERE z.generated_meta->>'source' = 'hvacr-course-seed';            -- expect 18
-- SELECT COUNT(*) FROM learn_quiz_questions qq JOIN learn_quizzes z ON z.id = qq.quiz_id
--   WHERE z.generated_meta->>'source' = 'hvacr-course-seed';            -- expect 170
-- Every question must have exactly one correct option:
-- SELECT qq.id FROM learn_quiz_questions qq JOIN learn_quizzes z ON z.id = qq.quiz_id
--   JOIN learn_quiz_options o ON o.question_id = qq.id
--   WHERE z.generated_meta->>'source' = 'hvacr-course-seed'
--   GROUP BY qq.id HAVING COUNT(*) FILTER (WHERE o.is_correct) <> 1;    -- expect 0 rows
