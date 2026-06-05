# IAT Training Portal — Project Proposal

**Author:** Jacob Younk  
**Date:** June 2026  
**Status:** Proposal / Pre-Development  
**Codename:** IAT Learn

---

## 1. Executive Summary

This document proposes the design and phased development of an internal training and documentation platform for Innovative Air Technologies — a full replacement for the company's current Trainual subscription. Built on the same proven stack as the IAT Forms Portal (Next.js 14, Supabase, Tailwind CSS), this system would give IAT permanent ownership of its training infrastructure with no recurring per-seat licensing, no feature gating, and the ability to build exactly what the organization needs.

The proposed MVP covers the full feature surface required to justify a Trainual cutover: per-user accounts, rich content authoring, quizzes with scoring, learning paths, progress tracking, gamification, and reporting. Development is organized into three 4–6 week phases with a working demo deliverable after Phase 1.

---

## 2. Problem Statement

IAT currently uses Trainual for:
- Documenting company processes, roles, and policies
- Onboarding new employees
- Ongoing training for specific job functions
- Compliance and acknowledgment tracking

**Pain points with the current vendor:**
- Monthly subscription cost with per-seat pricing that scales against headcount
- Feature set is fixed — we get what they build, not what we need
- Content and user data are locked to a third-party platform
- No integration with IAT's internal tooling (forms portal, operations systems)
- Vendor dependency: price increases, plan changes, or discontinuation are outside our control

---

## 3. Goals & Success Criteria

### Must-have for Trainual cutover
- [ ] Every active Trainual subject/topic can be recreated in the new system
- [ ] All current users can be migrated and immediately productive
- [ ] Completion rates, quiz scores, and assignment status are visible to managers
- [ ] System is mobile-friendly and accessible on the shop floor
- [ ] Admin can invite, assign, and deactivate users without developer involvement

### Definition of success
The platform is considered launch-ready when a new employee can be invited, assigned a learning path, complete all steps and quizzes, and a manager can pull a completion report — without any manual developer intervention.

---

## 4. Feature Scope

### Phase 1 — Foundation (Weeks 1–6)
Core user system and content browsing. Goal: working demo with real content.

- Supabase Auth: email invite flow, password reset, session management
- User profiles: display name, department, role (admin / manager / employee)
- Department management
- Content hierarchy: Subjects → Topics → Steps
- Rich text step editor (Tiptap): headings, lists, bold/italic, images, embeds, code blocks
- Video embed support (YouTube, Vimeo, direct upload)
- Step file attachments (Supabase Storage)
- Basic progress: mark step as complete, track completion per user
- Employee-facing subject browser with search and category filtering

### Phase 2 — Learning Engine (Weeks 7–12)
Quizzes, paths, and assigned training.

- Quiz builder: multiple choice, true/false, short answer
- Pass score thresholds, max attempts, show correct answers toggle
- Learning paths: ordered sequences of subjects with an optional due date
- Path assignment: assign to individual users, departments, or roles
- Assignment dashboard: employee sees their assigned paths and due dates
- Manager view: see completion status for their direct reports
- Email notifications: assignment alerts, overdue reminders (via Resend)

### Phase 3 — Gamification & Reports (Weeks 13–18)
The layer that drives engagement and gives leadership visibility.

- Points system: earn points for completing steps, passing quizzes, hitting streaks
- Badges: milestone awards (First Completion, Perfect Score, 7-Day Streak, etc.)
- Leaderboard: company-wide and department-scoped
- Reporting dashboard:
  - Completion rate by subject / department / individual
  - Quiz score distribution
  - Time-to-complete averages
  - Active vs. inactive users
  - Overdue assignment list
- CSV export for all reports
- Admin notification digest (weekly summary email)

### Post-launch / Future
- Mobile app (React Native or PWA push notifications)
- AI-assisted content suggestions (Claude API)
- Integration with IAT Forms Portal (e.g., complete a form as part of a training step)
- SCORM import (migrate legacy content from other LMS platforms)
- E-signature acknowledgment on policy documents

---

## 5. Data Model

All tables live in Supabase (Postgres). The service role key is used by the Next.js backend; the anon key governs what authenticated employees can read/write via RLS.

---

### 5.1 Users & Organization

```sql
-- Departments
CREATE TABLE departments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- User profiles (extends Supabase auth.users)
-- One row per auth user; id matches auth.users.id
CREATE TABLE user_profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text,
  department_id   uuid REFERENCES departments(id),
  role            text NOT NULL DEFAULT 'employee'  -- 'admin' | 'manager' | 'employee'
                  CHECK (role IN ('admin', 'manager', 'employee')),
  avatar_url      text,
  points          integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  hired_at        date,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Invitations (track pending invites before user accepts)
CREATE TABLE invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'employee',
  department_id   uuid REFERENCES departments(id),
  invited_by      uuid REFERENCES user_profiles(id),
  accepted_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at      timestamptz DEFAULT now()
);
```

---

### 5.2 Content Hierarchy

```sql
-- Subjects (top-level containers — equivalent to Trainual Subjects)
CREATE TABLE subjects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  cover_image_url text,
  icon            text,               -- maps to lucide icon name
  category        text,               -- e.g. 'HR', 'Safety', 'Operations'
  sort_order      integer DEFAULT 0,
  is_published    boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES user_profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Topics (chapters within a subject)
CREATE TABLE topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  sort_order      integer DEFAULT 0,
  is_published    boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Steps (individual lessons within a topic)
CREATE TABLE steps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id            uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title               text NOT NULL,
  content             jsonb,           -- Tiptap JSON document
  video_url           text,            -- YouTube/Vimeo embed or direct URL
  estimated_minutes   integer,
  sort_order          integer DEFAULT 0,
  is_published        boolean NOT NULL DEFAULT false,
  requires_quiz       boolean NOT NULL DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- File attachments on steps
CREATE TABLE step_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id     uuid NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  file_type   text,
  file_size   integer,
  created_at  timestamptz DEFAULT now()
);
```

---

### 5.3 Quizzes

```sql
-- Quiz tied to a step (one quiz per step max)
CREATE TABLE quizzes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id             uuid NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  title               text,
  pass_score          integer NOT NULL DEFAULT 80,  -- percentage 0-100
  max_attempts        integer,                       -- null = unlimited
  show_answers_after  boolean NOT NULL DEFAULT true,
  randomize_questions boolean NOT NULL DEFAULT false,
  created_at          timestamptz DEFAULT now()
);

-- Questions within a quiz
CREATE TABLE quiz_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text  text NOT NULL,
  question_type  text NOT NULL DEFAULT 'multiple_choice'
                 CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  explanation    text,   -- shown after answer is revealed
  points         integer NOT NULL DEFAULT 1,
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

-- Answer options for multiple_choice and true_false questions
CREATE TABLE quiz_question_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct  boolean NOT NULL DEFAULT false,
  sort_order  integer DEFAULT 0
);
```

---

### 5.4 Learning Paths

```sql
-- A curated ordered sequence of subjects
CREATE TABLE paths (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  cover_image_url text,
  is_published    boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES user_profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Subjects within a path (ordered)
CREATE TABLE path_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id     uuid NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  sort_order  integer DEFAULT 0,
  UNIQUE (path_id, subject_id)
);

-- Assignment of a path to a user, department, or role
CREATE TABLE path_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id         uuid NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  assignee_type   text NOT NULL CHECK (assignee_type IN ('user', 'department', 'role')),
  assignee_id     text NOT NULL,   -- user_profile id | department id | role string
  due_date        date,
  assigned_by     uuid REFERENCES user_profiles(id),
  created_at      timestamptz DEFAULT now()
);
```

---

### 5.5 Progress Tracking

```sql
-- Step-level progress per user
CREATE TABLE user_step_progress (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  step_id             uuid NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'not_started'
                      CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completed_at        timestamptz,
  time_spent_seconds  integer DEFAULT 0,
  UNIQUE (user_id, step_id)
);

-- Quiz attempt records
CREATE TABLE user_quiz_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  quiz_id       uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  score         integer NOT NULL,   -- percentage 0-100
  passed        boolean NOT NULL,
  started_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);

-- Individual answers within an attempt
CREATE TABLE user_quiz_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id   uuid NOT NULL REFERENCES user_quiz_attempts(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES quiz_questions(id),
  option_id    uuid REFERENCES quiz_question_options(id),  -- null for short_answer
  answer_text  text,                                        -- used for short_answer
  is_correct   boolean
);
```

---

### 5.6 Gamification

```sql
-- Badge definitions
CREATE TABLE badges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  icon            text,         -- lucide icon name or image URL
  criteria_type   text NOT NULL -- 'steps_completed' | 'quizzes_passed' | 'streak_days'
                                -- | 'subject_completed' | 'path_completed' | 'perfect_score'
                  CHECK (criteria_type IN (
                    'steps_completed', 'quizzes_passed', 'streak_days',
                    'subject_completed', 'path_completed', 'perfect_score', 'manual'
                  )),
  criteria_value  integer,       -- threshold (e.g. 10 for "complete 10 steps")
  criteria_ref_id uuid,          -- optional: specific subject/path id this badge is for
  points_awarded  integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Badges earned by users
CREATE TABLE user_badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  badge_id    uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

-- Immutable points ledger (append-only)
CREATE TABLE user_points_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  points        integer NOT NULL,   -- positive = earn, negative = correction
  reason        text NOT NULL,      -- human-readable: "Completed: Safety Orientation"
  event_type    text NOT NULL,      -- 'step_completed' | 'quiz_passed' | 'badge_earned' | 'path_completed'
  reference_id  uuid,               -- the step/quiz/badge/path that triggered it
  created_at    timestamptz DEFAULT now()
);

-- Login streaks (updated on each login/activity)
CREATE TABLE user_streaks (
  user_id       uuid PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  current_days  integer NOT NULL DEFAULT 0,
  longest_days  integer NOT NULL DEFAULT 0,
  last_activity date
);
```

---

### 5.7 Notifications

```sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type            text NOT NULL,   -- 'assignment' | 'overdue' | 'badge_earned' | 'digest'
  title           text NOT NULL,
  message         text,
  is_read         boolean NOT NULL DEFAULT false,
  reference_type  text,            -- 'path' | 'subject' | 'badge'
  reference_id    uuid,
  created_at      timestamptz DEFAULT now()
);
```

---

### 5.8 Table Summary

| Table | Rows at 50 users | Notes |
|---|---|---|
| `departments` | ~10 | Static |
| `user_profiles` | ~50 | One per employee |
| `invitations` | ~20 | Pruned regularly |
| `subjects` | ~30–100 | All IAT docs |
| `topics` | ~100–400 | |
| `steps` | ~300–1200 | |
| `step_attachments` | Varies | Supabase Storage |
| `quizzes` | ~100–400 | |
| `quiz_questions` | ~500–2000 | |
| `quiz_question_options` | ~2000–8000 | |
| `paths` | ~10–30 | |
| `path_items` | ~50–200 | |
| `path_assignments` | ~100–500 | |
| `user_step_progress` | ~15,000 | users × steps |
| `user_quiz_attempts` | ~5,000 | |
| `user_quiz_answers` | ~30,000 | |
| `badges` | ~20–50 | |
| `user_badges` | ~500–2000 | |
| `user_points_log` | ~20,000 | Append-only |
| `user_streaks` | ~50 | One per user |
| `notifications` | ~5,000 | Pruned |

All well within Supabase's free/pro tier limits.

---

## 6. Architecture Plan

### Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | Same as forms portal |
| Language | TypeScript | Same as forms portal |
| Styling | Tailwind CSS | Same as forms portal |
| Database | Supabase (Postgres) | Same as forms portal |
| Auth | Supabase Auth | Built-in, handles invites/reset/sessions |
| Storage | Supabase Storage | File attachments, cover images, avatars |
| Email | Resend | Same as forms portal |
| Rich Text | Tiptap | Best-in-class headless editor for React |
| Animations | Framer Motion | Same as forms portal |
| Drag & Drop | @hello-pangea/dnd | Same as forms portal (path/content ordering) |
| Charts | Recharts | Lightweight, composable, Tailwind-friendly |

### New dependencies vs. forms portal
```
tiptap/react, tiptap/starter-kit, tiptap/extension-*   — content editor
recharts                                                 — reporting charts
react-player                                             — video embeds
date-fns                                                 — already installed
```

---

### App Structure

```
app/
  (public)/
    page.tsx                        → Login / landing
    auth/
      callback/route.ts             → Supabase auth callback
      invite/page.tsx               → Accept invitation

  (employee)/
    layout.tsx                      → Auth guard, employee nav
    dashboard/page.tsx              → My assignments, progress, recent activity
    learn/
      page.tsx                      → Subject browser
      [subjectSlug]/page.tsx        → Subject overview + topic list
      [subjectSlug]/[topicSlug]/
        [stepSlug]/page.tsx         → Step content + quiz
        [stepSlug]/quiz/page.tsx    → Quiz experience
    paths/page.tsx                  → My assigned learning paths
    leaderboard/page.tsx            → Points + badges
    profile/page.tsx                → My profile, badge showcase

  (admin)/
    layout.tsx                      → Auth guard, role check, admin nav
    dashboard/page.tsx              → Admin overview: completions, active users
    users/
      page.tsx                      → User list, invite, deactivate
      [id]/page.tsx                 → User detail: progress, badges, history
    content/
      page.tsx                      → Subject list
      new/page.tsx                  → New subject
      [subjectId]/
        page.tsx                    → Subject editor (topics list)
        topics/[topicId]/
          page.tsx                  → Topic editor (steps list)
          steps/[stepId]/page.tsx   → Step editor (Tiptap + quiz builder)
    paths/
      page.tsx                      → Path list
      new/page.tsx                  → Path builder
      [pathId]/page.tsx             → Path editor + assignment
    reports/
      page.tsx                      → Overview charts
      completions/page.tsx          → Per-subject completion rates
      users/page.tsx                → Per-user progress table
      quizzes/page.tsx              → Quiz score analysis
    gamification/
      page.tsx                      → Badge management
      leaderboard/page.tsx          → Admin leaderboard view
    departments/page.tsx            → Department management

  api/
    auth/                           → Session, invite endpoints
    content/                        → CRUD for subjects/topics/steps
    progress/                       → Mark step complete, quiz submit
    quiz/[id]/attempt/route.ts      → Start and score quiz attempts
    paths/                          → CRUD + assignment
    users/                          → Admin user management
    reports/                        → Aggregated report data
    upload/route.ts                 → File attachments (same as forms portal)
    notifications/route.ts          → Mark read, list

components/
  editor/
    TiptapEditor.tsx                → Full editor (admin)
    TiptapRenderer.tsx              → Read-only render (employee)
  quiz/
    QuizBuilder.tsx                 → Admin quiz builder
    QuizPlayer.tsx                  → Employee quiz experience
    QuizResults.tsx                 → Score + answer reveal
  progress/
    ProgressBar.tsx
    SubjectProgress.tsx
    PathProgress.tsx
  gamification/
    PointsBadge.tsx
    BadgeGrid.tsx
    Leaderboard.tsx
  charts/
    CompletionChart.tsx
    ScoreDistribution.tsx
    ActivityHeatmap.tsx
  admin/
    Sidebar.tsx
    UserTable.tsx
    ContentTree.tsx
  employee/
    SubjectCard.tsx
    StepNav.tsx
    AssignmentCard.tsx

lib/
  supabase.ts                       → Public client + all types
  supabase-admin.ts                 → Service role client
  auth.ts                           → Session helpers, role checks
  points.ts                         → Points award logic (server-side)
  badges.ts                         → Badge evaluation engine
  resend.ts                         → Email templates
  utils.ts
```

---

### RLS Policy Strategy

| Table | anon | authenticated employee | manager | admin |
|---|---|---|---|---|
| `subjects`, `topics`, `steps` | none | read published only | read all | full |
| `quizzes`, `quiz_questions`, `quiz_question_options` | none | read published | read all | full |
| `user_step_progress` | none | own rows only | dept rows (read) | full |
| `user_quiz_attempts/answers` | none | own rows only | dept rows (read) | full |
| `user_profiles` | none | own row (read/update) | dept rows (read) | full |
| `path_assignments` | none | own assignments (read) | read all | full |
| `notifications` | none | own rows | own rows | full |
| `badges`, `user_badges` | none | read all | read all | full |
| `user_points_log` | none | own rows (read) | dept rows (read) | full |

All writes to sensitive tables (progress, points, quiz scoring) go through the service role via API routes — never directly from the client.

---

### Points Award Logic (server-side only)

All point awards are processed in API route handlers using the service role key, then appended to `user_points_log` and summed back to `user_profiles.points`. This prevents client-side manipulation.

| Event | Points |
|---|---|
| Complete a step | 10 |
| Pass a quiz (first attempt) | 25 |
| Pass a quiz (retry) | 10 |
| Perfect quiz score | 50 (bonus) |
| Complete a topic (all steps) | 15 (bonus) |
| Complete a subject (all topics) | 50 (bonus) |
| Complete a learning path | 100 (bonus) |
| 7-day activity streak | 30 (bonus) |
| 30-day activity streak | 150 (bonus) |

Badge evaluation runs after every point award event via a `checkBadges(userId)` call in `lib/badges.ts`.

---

## 7. Phased Roadmap

### Phase 1 — Foundation (Weeks 1–6)
**Goal: Real content browsable by real users**

| Week | Work |
|---|---|
| 1 | Supabase Auth setup, user profile system, invite flow, RLS skeleton |
| 2 | Department management, admin user table, role-based routing |
| 3 | Subject/topic/step data model, admin content tree UI |
| 4 | Tiptap step editor (rich text + image + video embed) |
| 5 | Employee subject browser, step reader, mark-complete |
| 6 | Basic progress tracking, employee dashboard, file attachments |

**Deliverable:** Admin can create content. Employees can browse and complete steps. Progress is tracked.

---

### Phase 2 — Learning Engine (Weeks 7–12)
**Goal: Assigned training with accountability**

| Week | Work |
|---|---|
| 7 | Quiz builder (questions, options, settings) |
| 8 | Quiz player (employee-facing experience + scoring) |
| 9 | Quiz results, retry logic, answer reveal |
| 10 | Learning paths (builder, ordering, publish) |
| 11 | Path assignment (user / dept / role), due dates |
| 12 | Assignment dashboard (employee view), manager team view, overdue emails |

**Deliverable:** Employees can be assigned paths with due dates. Managers can see team completion status.

---

### Phase 3 — Gamification & Reports (Weeks 13–18)
**Goal: Leadership buys in, Trainual subscription cancelled**

| Week | Work |
|---|---|
| 13 | Points engine, points log, award events |
| 14 | Badge definitions, badge evaluation engine, user badge grid |
| 15 | Leaderboard (company-wide + department) |
| 16 | Reports: completion rate charts, per-user tables, CSV export |
| 17 | Reports: quiz score distribution, overdue list, time-to-complete |
| 18 | Polish, mobile testing, admin digest email, content migration tooling |

**Deliverable:** Full system ready for Trainual cutover.

---

## 8. Economic Case

### Trainual Cost Estimate
Trainual pricing (as of 2026) runs approximately:
- **Build plan:** ~$300/month for up to 25 users
- **Train plan:** ~$500/month for up to 50 users  
- Enterprise tiers are negotiated

For a 50-person company: **~$6,000/year minimum**, likely more with annual increases.

### Build Cost
Development time: approximately **18 weeks** at a senior developer pace (likely longer at a part-time/after-hours pace). No external infrastructure costs beyond what the Forms Portal already uses (Supabase pro, Resend, Vercel).

### Break-even
At $6,000/year in Trainual savings, the build investment breaks even within the first year of ownership. Every subsequent year is pure savings.

### Hidden value
- **No per-seat pricing:** IAT could grow to 200 employees with zero incremental cost
- **No feature gating:** every feature described here is in the system, not locked to a higher plan
- **Integration potential:** link training completion to forms portal workflows, operations systems, or future HR tooling
- **Data ownership:** all content and completion records are IAT's forever, in a Postgres database we control

---

## 9. Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Content migration is labor-intensive | High | Medium | Build CSV/JSON import tool in Phase 3; plan 1–2 weeks of manual migration time |
| Tiptap learning curve slows Phase 1 | Medium | Low | Tiptap has excellent docs; start with the starter-kit extension set and expand |
| Scope creep extends timeline | High | Medium | Hard cutoff at Phase 3 feature list; defer SCORM, mobile app, AI features to post-launch |
| Low adoption if launch isn't timed right | Medium | High | Coordinate cutover with a company all-hands; assign paths on day one to drive immediate engagement |
| Supabase Auth adds complexity vs. current cookie auth | Low | Low | Supabase Auth is well-documented and has Next.js SSR helpers; patterns are established |
| Boss doesn't see value until Phase 3 | Medium | Medium | Phase 1 demo with real content is the best counter; run Forms Portal and Learn side-by-side as proof |

---

## 10. Next Steps

When ready to begin:

1. **Confirm Trainual pricing** — pull the actual invoice to establish the ROI number for the boss conversation
2. **Audit Trainual content** — count subjects, topics, and steps to size the migration effort
3. **Stand up a separate repo** (`iat-learn`) — this is a distinct product from the forms portal, though it shares the same Supabase project
4. **Start with Phase 1, Week 1** — Supabase Auth + user profiles is the foundation everything else builds on

---

*This document is a living proposal. Architecture decisions may be revised as implementation begins.*
