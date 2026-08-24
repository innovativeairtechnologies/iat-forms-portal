# Changelog

Notable changes to the IAT Forms Portal, newest first. Dates are deploy dates.

**Editions.** Changes ship most days, so the reporting unit is a week. An *edition*
is one Monday-to-Sunday work week named after its Monday — the entries below dated
17–23 August are **Edition 8.17.26**. Nothing here is tagged by hand: an entry's
edition is derived from its date, so the whole history is already addressable and
nothing can drift out of step. The weekly report covers exactly one edition. An
occasional *interim* update can cover a few days between Mondays; it is labeled and
filed as an interim, and never replaces the edition it sits inside.

## 2026-08-24 — Customers can give us a room's volume instead of measuring it

The quote request asked for length, width and height. Plenty of people know their building as
"about thirty thousand cubic feet" and would have to go and measure to answer that, so the survey
now offers a **Volume** option beside **Dimensions** and lets them answer the question they can
actually answer.

**Volume on its own is not enough to size a system, and the form says so.** Moisture comes through
the walls, ceiling and floor, so the calculation needs their *area* — and two rooms of the same
volume can have very different amounts of wall. Volume mode therefore also asks for the ceiling
height, which almost everyone knows without measuring, and assumes a square floor from there. That
gets the volume and the floor area exactly right and leaves only the shape of the footprint
assumed.

A square is the shape with the least wall, so a long narrow building has more wall than we assume
and its real figure will be higher. Rather than bury that, the form shows the customer the
footprint it assumed and tells them to enter dimensions if they know them; the PDF prints the
figures marked as assumed, and the desk sees "Dimensions (assumed)" on the request. In practice
this moves a typical estimate by a fraction of a percent — but a tight cold room leans on it
harder, which is exactly when someone needs to notice the wording rather than trust a number.

## 2026-08-24 — The quote request now records how leaky the building is

**Building tightness is printed on the survey PDF.** Step 5 of the quote request asks whether the
building is tight, average or loose. That is not a label — it sets the air-leakage term of the
moisture load outright, and a loose building leaks exactly six times what a tight one does. On a
typical 50 × 40 ft room that is the difference between about 1.8 and 7.6 pounds of water an hour.
Until today the customer's answer appeared nowhere on the document they keep; it showed up only as
small print inside one of the breakdown bars. The construction and envelope table now carries it,
with the leak rate written out beside it, so the assumption travels with the survey instead of
living only in our database.

**The desk can now see what produced each number.** On a submitted survey, every bar in the
estimated breakdown gets a line underneath saying what it was calculated from — "loose
construction, 1.5 cu.ft/hr per sq.ft", "vapor barrier credited", how many minutes an hour the doors
stood open. Previously only the magnitude was stored, so a figure that looked wrong could not be
questioned without re-entering the whole survey by hand. Surveys taken before today have no such
line and are unchanged.

**Nothing the customer sees on screen has changed.** The moisture-load figures are still withheld
from the person filling in the form, as decided on 18 August. This is about what reaches the PDF
and our own desk.

## 2026-08-24 — "Waiting on Customer", and tickets that chase themselves

**A ticket can now be marked Waiting on Customer.** Use it when the ball is genuinely in their
court and you cannot move until they answer. It shows as its own state in the queue, and it stops
the daily nudge you would otherwise get about a ticket you are correctly blocked on.

**From there the ticket chases itself.** After a week of silence the customer is emailed a reminder
that names the date the ticket will close. Six days later they get a final "closing tomorrow"
warning. If they still have not replied, on day 14 the ticket moves to Resolved on its own.

**It stops at Resolved, on purpose — it does not close itself.** Closing a ticket needs an owner and
your closing notes, and no automatic process can write those. So the last step comes back to you:
whoever owns the ticket gets an email saying it has been resolved, that the customer has been
chased twice and is not expecting anything further, and that it still needs a proper close with
notes. The link takes you straight to it.

**If the customer replies at any point, everything stops.** The ticket goes back to In Progress with
its owner intact, and the clock resets — including if you later park it a second time.

## 2026-08-24 — You now choose whether the customer sees your closing notes

**Closing notes are no longer sent to the customer automatically.** Until today, resolving or
closing a ticket emailed whatever the engineer wrote straight to the customer, word for word, with
no way to stop it. That made an internal field customer-facing without saying so: closing notes are
where the real diagnosis goes, and they can carry a commercial note or a frank assessment that is
right for us and wrong for the person who raised the ticket.

**Closing a ticket now asks first.** A dialog appears showing which address the email is going to,
and offers two choices. The default is a **confirmation only** — it tells the customer their ticket
is closed and invites them to come back if the problem returns or they have questions, and nothing
else. If you do want them to see your notes, pick the second option and it shows you exactly what
will be sent before it goes.

The notes themselves are still required, and still go on the ticket. The resolution reason is
treated the same way — it is an internal reporting phrase, so it only goes out alongside the notes.
Every close records which choice was made, so "did they see what I wrote?" has an answer later.

## 2026-08-24 — A ticket now needs an owner before it can be finished

**Tickets can no longer be resolved or closed while unassigned.** A few had been finished with
nobody's name on them, and that cannot be recovered afterwards: the record shows the status changed
and who clicked, but an owner that was never set is simply missing — so "who handled this?" has no
answer. The Owner field is now required on the way into resolved or closed, marked with a `*`, and
the Update button explains itself rather than just refusing.

**Queue actions no longer fail in silence.** Resolving from the ticket list quietly did nothing:
the server requires closing remarks, the list has nowhere to write them, and the refusal was being
thrown away — so the row just stayed as it was, with no message. Refusals now appear at the top of
the list, naming the tickets and the reason, and point you at the ticket itself.

**The "Reopened by a customer" figure on the dashboard was counting our own staff.** Moving a
ticket back out of closed looks identical in the record whether a customer prompted it or one of us
did, so the card was reporting our own triage as customer dissatisfaction. It now counts only
reopens that came from a customer replying through the status page. The reopen figures in the
Tickets report are unchanged and still count both, which is deliberate — that report is asking
whether we called things done too early, and a staff reopen answers that question too.

## 2026-08-24 — Friday's 6pm report did not send, and why

The first run of the new Monday/Wednesday/Friday schedule was due at 6pm on Friday. It never
arrived, and neither did that afternoon's daily digest.

**The cause was our own deployment activity, not the reports.** Ten releases went out between
4:09pm and 7:21pm Friday — straight through every scheduled job's slot. A release landing while a
job is due makes that run disappear with no error and no record. The evidence is clean: the one job
scheduled earlier in the day, away from the releases, ran normally; and over the weekend, with no
releases at all, every job ran on both days.

**Two changes came out of it.** The reports now leave a record of every attempt and why it did or
did not send, so a missed run can be diagnosed in seconds rather than by inference. And there is now
a documented rule: no releases within twenty minutes either side of a scheduled job.

Friday's content was not lost — it was delivered as a Word document covering 19 to 21 August.
Today's 6pm report covers 22 to 24 August as normal.

## 2026-08-21 — Morning ticket alerts on the dashboard, and a tools report

**Two alert cards now open the admin dashboard.** *My Tickets* shows what is yours and waiting —
open, aging, overdue, and any quote requests assigned to you. *Ticket Alerts* shows what nobody
owns or what has gone quiet: unassigned tickets, anything overdue company-wide, tickets a customer
has reopened this week, and unclaimed quote requests. Every line links straight into the queue.

They are separate cards on purpose. Merging them would give you a number where "3 overdue" could
mean yours or the company's, and a number you cannot act on is worse than no number.

**Tools & Inventory joins the Reports section** — what is checked out and to whom, what is past its
due date, and how long each item has been off the shelf, longest first. Right now six of seven
tools are out, the longest for thirty days.

## 2026-08-21 — Quote requests join the daily digest

The daily digest already covered tickets newly assigned to you, plus your aging and overdue ones.
It now does the same for quote requests: newly assigned to you, yours that are getting old, and —
across the whole company rather than just yours — **any request nobody has claimed**.

Unclaimed is company-wide on purpose. A request with no owner belongs to nobody, so a strictly
personal digest is exactly the one that would never mention it, and an unclaimed quote request is a
customer waiting on a number.

## 2026-08-21 — The leadership update now goes out three times a week

Monday, Wednesday and Friday at 6pm Eastern, instead of Mondays at 5pm. Each edition covers only
the days since the previous one — Monday picks up the weekend, Wednesday covers Tuesday and
Wednesday, Friday covers Thursday and Friday — so the three together cover every day once and
nothing is reported twice.

It goes to Lee, Kacy and Crystal.

## 2026-08-21 — Four more reports

Reports now covers **Quote Requests**, **Sales Pipeline**, **Installed Base** and **Portal
Adoption** alongside Support Tickets. Each opens as a summary with its detail collapsed, and each
exports the whole underlying table to CSV.

- **Quote Requests** — what people are asking us to solve, how quickly we pick it up, and whether
  anything is sitting unclaimed.
- **Sales Pipeline** — quoted value, weighted forecast, by rep, by project type, and by the month
  each deal is expected to land.
- **Installed Base** — what is out there, what is still covered, and a call list of units coming off
  warranty in the next 90 days.
- **Portal Adoption** — who uses the portal, who has an account but has never signed in, and how the
  move to Microsoft sign-in is progressing.

Reporting stays restricted to full admins and can be granted to a role from Permissions.

## 2026-08-21 — Plainer headings in the quote request

Wording only, no behavior change.

- Step 2 asks "What is the application" rather than "What are we protecting?"
- Step 3 is "Target conditions"
- Step 5 is "Space construction", and asks you to tell us about your building materials
- The panel on the right is "Typical Conditions"

Also corrected the spelling of "mold" everywhere it appeared — the cannabis, food, museum,
restoration and plastics descriptions all carried the British spelling.

## 2026-08-21 — Reports, assignment emails, and a limit on reopening old tickets

**There is a Reports section now**, in the left navigation between the working sections and
System. Support Tickets is the first report: how many came in and went out, whether the backlog is
growing, how long tickets actually take to close, how often they come back, which customers
generate the most, and which equipment models keep appearing. Anything over 30, 90 or 365 days, or
all time, and the whole table exports to CSV for a spreadsheet.

Reporting is restricted to full admins to begin with. It can be granted to a specific role from
Permissions without a code change.

**Assigning a ticket now emails the person you assigned it to.** Assignment used to be silent: a
ticket landed in someone's name and the only way they found out was opening the queue and looking.
Assigning to yourself sends nothing, and the shared support mailbox is deliberately left out of it.

**A customer replying to a closed ticket reopens it, and we hear about it.** Until now that reply
landed in the thread and the ticket stayed closed, so it was invisible in every queue view. It now
goes back to Open, keeps its owner, and sends an alert that says it was reopened rather than that
somebody wrote in.

**Closed conversations end after 30 days.** Past that a customer is asked to open a new ticket
rather than add to an old one, with a link to do it. A fault that returns two months later is a new
fault, and burying it under an old diagnosis helps nobody. Inside the window nothing changes.

## 2026-08-21 — The ticket queue opens on your own work

**You now land on My Tickets**, showing what is still active — open, in progress, and anything a
customer says is fixed but nobody has formally closed. An Active / Closed switch sits beside the
search box, each side carrying its own count, so you can see whether you have closed tickets
without leaving the view and step across when you want them.

Previously the queue opened on Open, which today holds none of the fourteen live tickets — so it
opened on an empty screen.

Accounts with no matching staff record land on All instead, and do not see a My Tickets tab.

## 2026-08-21 — Ticket queue: My Tickets, Unassigned, and links that land on the ticket

**"My Tickets" and "Unassigned" are now tabs in the ticket queue**, beside All, Open, In Progress,
Resolved and Closed. My Tickets shows everything assigned to you whatever its status, so nothing of
yours is ever hidden behind a status rule; sort by Status to push the closed ones down. Unassigned
shows the tickets nobody has picked up, which is the queue worth watching.

**A customer-reply alert now opens that ticket.** Clicking through from the email used to drop you
on the whole queue, defaulted to Open, and leave you to find the ticket you had just been told
about. Every other ticket alert already linked straight to the ticket; this one was the exception.
It works from a signed-out inbox too, arriving on the ticket after you sign in.

**The picture in the quote request only magnifies again.** The turn-it-in-3D behavior is withdrawn
pending a clearer idea of what it should do.

## 2026-08-21 — Sharper pictures, and you turn them by dragging

Three corrections to this morning's illustration work.

**The pictures are sharp now.** They were being resized down and re-compressed a second time on
their way to the page, on top of the compression they already had, which showed up as softness and
was worst at full magnification — exactly where detail matters. They are now served as built. The
room illustration carries about four times the pixels it needs even when enlarged.

**Hovering no longer moves the picture.** It only enlarges. To turn it, press and drag: the room
rotates on both axes and stays where you leave it until you move away. Moving the pointer across a
picture you have not clicked on does nothing, which is the way round it should have been.

**The width measurement is no longer clipped.** The figure above the picture was running off the
top edge and losing the top of its digits. Both the top and bottom measurements now have room to
spare.

## 2026-08-21 — The quote request draws your room as you describe it

The illustration in the right-hand panel now does more than sit there.

**Hover it and it enlarges**, and tilts slightly in 3D as you move the pointer, so you can look
into the corners of the room rather than squinting at a thumbnail. That works on every step from
the application onward.

**Type your dimensions on step 4 and they appear on the picture**, live, as you type. Length runs
along the bottom, width along the top and height up the left side, each one appearing as soon as
you fill that box in. It is the same drawing convention the quote PDF uses, so the two read the
same way.

**The picture and its dimensions now print in the quote PDF too**, in place of the abstract box
that used to stand in for the room on the space page. Applications with no illustration, and any
case where the picture cannot be fetched, still get the drawn box exactly as before.

**Step 7 explains why people matter.** The question about headcount and activity now sits beside
an illustration of the two ways a person adds water to a room, breathing and perspiring. People
are the load customers most often assume is negligible.

Also corrected three British spellings that reached the customer PDF: "vapour barrier", "vapour
retarder classes" and "fibreglass".

## 2026-08-21 — The quote request shows you the room you are describing

Pick your application on step 2 of the quote request and a cutaway illustration of that kind of
space now appears in the panel on the right, under Typical Industry Conditions. It stays there for
the rest of the survey, so there is always a picture of the room on screen while you answer
questions about its walls, its doors and what happens inside it.

Twenty-eight of the twenty-nine applications have a picture. Each one was paired by looking at the
artwork rather than by matching names, because the two vocabularies had drifted: the survey says
"battery / lithium dry room" where the illustration is filed as "battery", and a name-based match
would have quietly shown some people the wrong room. Indoor pool has no illustration in the set, so
that one shows no picture at all, which is the right answer until a pool render exists.

The caption says it is a typical layout rather than a drawing of their site, so nobody reads it as a
proposal.

## 2026-08-21 — Plainer wording in every email the portal sends

Yesterday’s wording pass covered the quote request, the support forms and the customer portal, but
it missed most of the outgoing email. Long dashes are now gone from ticket confirmations,
status-change notices, resolved-ticket follow-ups, portal invitations, warranty decisions, and the
reminder and escalation mail that goes to staff. Twenty-six lines in all.

They were missed because the first pass worked from a hand-written list of three files when there
were eleven. The gap showed up in the send log rather than in any check, which is the lesson worth
keeping: check the list against the folder, not against memory.

## 2026-08-21 — Support ticket: the AI analysis refreshes when answers change

Now that any step is reachable, someone can jump back, change an answer, and return to the AI Quick
Analysis — which used to keep showing the suggestions from the original answers. A finished analysis
is now invalidated the moment a diagnostic answer changes, so it regenerates against the new answers
the next time they land on that step. Deliberately lazy: it re-runs once on return, not on every
keystroke, and edits to the contact fields (name/email/phone/company) don't trigger it — those don't
change the diagnosis, so no AI call is wasted. Implemented with a signature of the non-contact fields.

## 2026-08-21 — Support ticket: the progress steps are clickable

The equipment support form's header shows a circle per step (Contact, Equipment, Problem … Analysis).
They were display-only, so changing or re-checking an earlier answer meant clicking Back down the whole
stack. Every step you've already reached is now a button — click its circle to jump straight there,
backward or forward, among the steps you've visited. Steps not yet reached stay locked, so required
fields still can't be skipped. A `maxStep` high-water mark tracks how far you've gotten.

## 2026-08-21 — Support ticket: the Contact step's email and phone fields line up

On step 1 of the equipment support form, Email and Phone share a two-up row, but only Phone carried a
helper line — and since a field's hint renders *above* its input, Phone's input sat lower than
Email's, so the two boxes didn't line up. Email now carries a matching one-liner ("we'll send your
ticket confirmation and status updates here"), which both evens the row and says something useful.

## 2026-08-20 — A picture library for the quote request and what comes after

Eighty-six room renders are now hosted and ready to be referenced by name: a photo-real view of each
room type, a cut-out version of the same room with no background, and labelled layers that can sit
over a cut-out to point out doors, people, dimensions and product.

They are held outside the codebase and reduced from 275 MB to 8.5 MB, which keeps pages fast and
leaves room in our storage plan for the photos customers attach to tickets. The originals stay in
SharePoint.

Nothing uses them yet. This is the groundwork so that a later build can say **show this picture when
someone picks that room** without any further plumbing.

**Known limits, so nobody is surprised later:** the labelled layers line up on 16 of the 37 rooms.
The rest were exported trimmed to their edges, so a layer would sit slightly out of place — those
rooms need re-exporting before they can carry one. Only two rooms have layers drawn so far, and one
of those two is a trimmed one.

## 2026-08-20 — The wall pictures enlarge outward instead of over each other

Hovering a wall build-up on the quote request magnifies it, but the first and last were growing
inward across their neighbours. They now spread outward from the row.

## 2026-08-20 — A customer reply now reaches the person who owns the ticket

When a customer wrote back, the alert went to the shared support mailbox and nowhere else.
Everyone could see it and nobody owned it, which is how a reply sits for a day with three people
each assuming somebody else has it.

Now it goes to two places: the shared mailbox, as before, and the inbox of whoever the ticket is
assigned to. Both, not either — the mailbox keeps the record and covers unassigned tickets, and
the owner gets the nudge that makes it their job. An unassigned ticket still alerts the desk
exactly as it did.

Replying from the customer portal used to send **no alert at all**. The note landed in the thread
and nobody was told it existed, so the same action was either seen or invisible depending on which
door the customer came in through. That path now alerts too.

The same rule applies when a customer marks their own ticket as resolved, from either door. That
claim starts a verification someone has to do, so it goes to the owner as well as the desk.

Two details worth stating. A deactivated person stops receiving customer messages the moment they
are deactivated, even on tickets they still own. And a reply sent with only a file attached now
says so, instead of arriving as an empty quote that reads like a bug.

## 2026-08-20 — Staff alert emails can send from their own domain

Alerts to the team — a new ticket, a customer reply, the daily digest, a form submission, a
time-off request — were being quarantined as spam before anyone saw them. Customer replies sat
unanswered because nobody knew they had arrived.

The cause was not the mail itself, which is signed and authenticates correctly. It was the route it
takes coming back into our own tenant: the envelope sender is stripped along the way, so by the time
our filtering sees the message there is nothing left to verify it with. All it can tell is that
something claims to be from our domain and cannot prove it, which reads as impersonation. Our
filtering will not let anyone add their own domain to an allow list, and rightly so — that is
exactly the hole an attacker would want. So there was no setting that could fix it.

Staff-bound mail can now send from its own subdomain instead, set through `RESEND_FROM_INTERNAL`. A
domain that is not ours-claiming-to-be-ours is not impersonation, so the verdict does not apply, and
it can be allow-listed the ordinary way — the same shape as the other outside services that already
send us mail.

Mail to customers is deliberately unchanged and still comes from the main domain, where it works and
where the familiar name is worth more than the routing.

With the variable unset nothing changes at all, so this was safe to ship ahead of the DNS.

## 2026-08-20 — One colour scheme across the whole quote request

The quote request used five accent colours, a different one per step, so the same kind of note
appeared blue on one screen and red on the next. It now uses two, everywhere: blue for ordinary
information, and the amber badge for the one thing on a step worth stopping at.

The reds and purples are gone from the step headings, the notes and the selectable buttons. Red
now appears only where it should: a required-field marker, an error, and the hover on Remove.

**Look up site conditions** is now green, so the eye lands on it. It is the soft green rather
than the solid one, since Continue is the main button on that step and two solid greens would
compete.

That lookup also no longer names the survey service it reads. The elevation still comes from the
same place; a customer filling in a quote request does not need the name of a federal dataset.

## 2026-08-20 — Plainer wording across everything a customer reads

The customer-facing wording has been rewritten to a plainer punctuation style. Long dashes are
gone from every description, hint, button, confirmation screen and outgoing email, replaced with
ordinary sentences, commas and colons. Around 160 pieces of copy across the quote request, the
support forms, the status page, the customer portal, the quote PDF and the notification emails.

Every one was rewritten by hand rather than swapped by a script: a long dash does three different
jobs in a sentence, and a blanket find-and-replace would have produced run-on sentences in some
places and clipped ones in others. Nothing about what the words say has changed.

Internal notes and developer comments were left alone. Nobody outside sees them.

**Also fixed:** the dew point on the target-condition step was showing a dozen decimal places
(49.05563453465). It reads as a whole number again. That crept in with the Celsius work, which
replaced the rounding step without putting one back.

## 2026-08-20 — The building-tightness question is back, with both envelope details tucked away

**“How tight is the building?” is being asked again.** It was hidden a day earlier while the
calculation quietly kept using it — every quote was priced at *average* leakage as an assumption
nobody had confirmed. Asking the question closes that gap: the figure behind a quote is now one
the customer actually chose.

It sits with **“Is there a vapor barrier?”** behind a single **Advanced** button under the floor
material. Both have sensible defaults and both are the questions people are least certain about,
so the step now reads as three material choices rather than five questions. If either has been
answered already, the section opens by itself so nothing a customer chose is ever hidden from them.

Tightness also drops its **“Not sure”** option, matching the rest of the form. It changes no
numbers — that option always used the same leakage rate as *Average*.

## 2026-08-20 — The portal greets you by your name, not your login

**Nobody is greeted by an email address any more.** The home page said "Good afternoon, Jacob" to
one person and "Good afternoon, first.last" to the next, and the difference was invisible from
the outside: whoever set up each account typed something different into the name box, and the
portal printed it back verbatim. Names are now cleaned up wherever the portal shows them —
`first.last` reads as "First Last", a lowercase single name gets its capital letter, and an email
address that slipped into a name field is trimmed down to the person behind it.

Names that were typed properly are left completely alone, including the ones with real punctuation
in them — "Robert A. Smith" stays as written, and capitalization inside a surname is never
flattened. The cleanup happens at the moment of display rather than by rewriting records, so a
rushed invite can't reintroduce the problem months from now.

The same rule covers the profile menu, the Learn greeting, the employee home and board, ticket
note authors, audit entries and the sign-in trail — anywhere a person's name appears.

## 2026-08-20 — Quote request: Celsius, wall pictures, and fewer ways to answer "I don’t know"

**Temperatures can be entered in Celsius.** A small °F/°C control sits on the temperature box and
switches the whole survey, including dew point and wet bulb where those are the unit chosen.
Everything is still stored and quoted in Fahrenheit — switching is a way of reading and typing,
not a change to the numbers, and flipping back and forth never alters what was entered.

**Step 5 opens with three pictures** — Good, Better and Best wall build-ups, left to right, and
hovering over one enlarges it to twice the size so the labels on the drawing can actually be read.
The envelope questions are the ones customers guess at most; a picture to point at gets a better
answer than a longer explanation.

**“Not sure” is gone** from the vapor barrier question, the pre-filter, and where the unit goes.
Cabinet construction drops **“Painted galvanized”** and **“Let IAT recommend”**, and regeneration
air source drops **“Let IAT recommend”** as well. That completes a pass across the whole form:
every remaining choice is an answer, not a way of declining to give one. Where a customer genuinely
does not know, the sensible option is already the default.

**Where the unit goes** is now just Indoor or Outdoor. Rooftop and mezzanine are each already
one or the other as far as the equipment is concerned, and the free-text note on the same step
covers anything unusual about the spot.

Also: spellings across the form and its documents are now consistently American — "vapor" rather
than "vapor", and the same for a handful of others.

## 2026-08-20 — The quote request says who the weather came from, not which edition

The design conditions on a quote request were labeled with the ASHRAE edition year and the
range of years the readings were taken over — "ASHRAE 2025 … 2004-2023 observations". Neither
told a customer anything they could act on, and both invited the wrong question: is this data
from 2025, or for 2025, and why does it mention 2004?

The customer now sees the source and the weather station, and nothing else: *ASHRAE 0.4% design,
monroe walton county ap, ga, usa — 16 miles away.* The station and the distance are the parts
worth arguing with, and those stay.

**The edition is still recorded**, on the internal view of the request. Design figures do move
between editions, so when a quote and a later engineering check disagree, that is the line that
explains it. It simply is not the customer’s problem.

The **Look up site conditions** button has also moved under the project location, where it used
to sit under the elevation box. It reads the location and fills several things, so sitting under
elevation made it look like an elevation-only control — which is all it was when it was built.

Also fixed: the attribution line on the customer PDF was printing stray spaces around its commas.

## 2026-08-20 — The daily management digest is finally actually sending

The daily digest — the afternoon email giving each manager their new, ageing and overdue
tickets — **has never once arrived since it was built.** A missing password was found and fixed
on 17 August, and that was a real problem, but it was not the only one. The digest still did not
send on any day afterwards, and nothing anywhere said so.

Scheduled jobs on our hosting run late — measured this week at between fourteen and forty-two
minutes past their time. The digest would only send if it started inside a ten-minute window, so
it missed every single day, including on its best day. It has now been given a window wide enough
to absorb that, and it still cannot send twice in a day.

It should arrive around 4:30pm from today, and continue to at the same time through the winter
clock change.

**Three people are still held back from receiving it** — Jacob Younker, Tyler Bell and Jo Evans —
a hold put in place on 17 August so the format could be reviewed before it went to everyone.
Crystal, Kacy and Lee receive it. Removing the hold is a one-line change whenever you want it.

The same failure was worth learning from: a scheduled job that quietly does nothing looks exactly
like a scheduled job with nothing to do. Both this and the weekly report now say so in their logs
when they come up empty.

## 2026-08-20 — The weekly report can no longer fail silently

The Monday leadership report is written by Claude from this changelog, and it asks for the
result as structured data. If the reply came back even slightly malformed, the whole report
was abandoned and **no email went out at all** — a failure that looks exactly like a quiet
week. The engineering half had the opposite problem: it failed softly and vanished, which is
how last night’s update went out with page one and no page two, and nothing anywhere said so.

Both halves now retry, and a report that arrives with a missing half says so in the log rather
than shipping quietly. The report was also being cut off partway through when a stretch had an
unusually large number of entries; it now has room for roughly twice as much and recognizes
that particular failure instead of retrying blindly into it.

Nothing changes about what the report says or who receives it.

## 2026-08-19 — The quote request now designs against your weather, not a placeholder

Step 1 already looked up your elevation from the location you type. It now also fills
the **outdoor design conditions** — the summer temperature and moisture the equipment
has to work against — from the nearest weather station to the site.

**This changes the numbers a quote request produces, and it should.** Every survey ever
submitted was costed against 95°F and 55% relative humidity — a placeholder that shipped in
the template and that the room questionnaire never asked about. Ventilation and infiltration
load are calculated from it.

That placeholder is a very wet condition, and it was wrong by different amounts in different
places rather than by a constant anyone could have allowed for. Against the real design
conditions it overstated the moisture load in most of the country — by about 10% in Atlanta,
30% in Phoenix, and by more than 150% in Denver and Seattle, where the air is genuinely dry —
while understating it by around 7% on the Gulf coast. **Most quotes were therefore sized
against more moisture than the site actually sees**, and dry high-altitude jobs were the
furthest out.

The figures are **shown on the page**, not filled in quietly — the station, how far away
it is, and which ASHRAE edition it came from. A station can be thirty miles from the
site, and a customer who knows their plant runs wetter than the airport can only say so
if they can see what we assumed. The same attribution prints on the PDF and shows on the
admin view, so no one downstream has to guess whether a number was looked up or typed.

**Elevation is unchanged** and still comes from the US Geological Survey, which resolves
the actual site rather than the airport: Covington, GA is 745 ft, and its nearest station
is 29 miles away at 943 ft.

If the lookup fails, or there is no station within 100 miles, nothing is filled in and
the survey behaves exactly as it did before. A station from the wrong climate is the one
genuinely dangerous output here, because it looks identical to the right one.

## 2026-08-19 — Tonight's extra update covers two days, not the whole week

Tonight's 6pm update was going to send **Edition 8.17.26** — the full week of 17–23
August — five days before Monday sends that same edition again. Two documents, the same
name, the same claimed week, different contents, both landing in one inbox.

It now covers **18 and 19 August only**, and says so. It is an *interim* update, with its
own title, its own date range and its own attachment name
(`IAT-Portal-Interim-8.18.26-8.19.26.docx`). A supplement, not a substitute.

**Monday 24 August still sends the complete Edition 8.17.26**, including the two days
tonight already covered. The repetition is deliberate. Fifteen of that edition's
twenty-five entries are dated 17 August and have never been mailed to anyone, so trimming
Monday to avoid the overlap would not remove a duplicate — it would drop most of the week.
Saying two days twice is much the cheaper mistake.

The format is unchanged: page one for leadership, page two for engineering. The wording
adapts, because a two-day report that still said "this week" would be wrong in the
reader's hands.

The weekly job itself is untouched. Any run can now be pointed at a date range with
`?from=2026-08-18&to=2026-08-19` instead of an edition; passing both is refused rather
than quietly reconciled.

## 2026-08-19 — An extra update tonight, and the customer portal's blank screen explained

**A one-off update goes out at 6:00pm this evening**, rather than waiting for Monday.
It reads the same way as the Monday one — a short leadership read, then a longer
technical read. It covers 18 and 19 August only; see the entry above for why, and note
that Monday's regular update still goes out and still covers the full week.

It went out at 6:42pm rather than 6:00 — Vercel runs scheduled jobs on this project 14 to 42
minutes late, which is worth knowing before anyone schedules something to the minute. The
one-off entry has been removed now that it has fired.

**The customer portal's blank screen after signing in is fixed.** It was never an
outage. A login that is not yet connected to a company was being bounced back and
forth between two pages, and the browser gave up before drawing anything. It now says
plainly that the account is not linked yet. Two other pages had the same fault and
were fixed at the same time.

Separately, that portal's database had paused itself after a week of no activity — a
cost-saving behavior of the free plan. It has been restarted. Expect it to recur
until customers are actually using the portal, and note the symptom is always "I can't
log in" while every dashboard looks healthy.

## 2026-08-19 — Quote request: shell step trimmed, and two figures off the customer PDF

**Step 5 (the shell).** "Not sure" is gone from the walls, roof/ceiling and floor
dropdowns — the customer picks the closest real material instead.

**"How tight is the building?" is hidden** for now, and may come back. Worth knowing:
the calculation still assumes *average* leakage, which is the sensible middle, but it
is now an assumption rather than something the customer confirmed. It has been taken
off the PDF as well, so we no longer print a tightness nobody chose.

**Two figures removed from the customer PDF** — the "dry air needed" airflow in cfm,
and the envelope tightness. Consistent with taking the moisture-load figures off the
on-screen readout earlier this week: they read as a firm selection when they are a
planning estimate. Both are still calculated and still reach our desk.

## 2026-08-19 — Quote request: the progress bar is now a way to get around

The bar across the top of the quote request was decoration — it showed how far along
you were and nothing else. It now **labels every step** (About you, Application,
Target, Space, Shell, Openings, Inside, Unit, Review) and **each label is clickable**.

Two things this fixes. You can jump straight to the step you want to change instead
of pressing Back repeatedly to find it. And once you have changed it, you can jump
**straight back to Review** rather than clicking Continue through every step in
between — previously the bar would only take you as far as the step you were
standing on, so going back to fix one answer meant walking all the way forward again.

Steps you have not reached yet stay locked, since later questions are shaped by
earlier answers and skipping ahead would produce a survey that looks complete but
is not.

Labels are hidden on phones, where nine of them will not fit; the bar stays tappable.

## 2026-08-19 — Quote request: fewer questions, and the optional ones tucked away

Changes to the last two steps of the quote request, all at the owner's direction.

**Step 7 ("What's happening inside")** now asks two questions — how many people, and
what they are doing — with everything else behind an **Advanced** button beneath
them. Moisture from product or process, open water surface, and ventilation and
exhaust are all in there. Most rooms never need any of it, and the step used to open
with nine fields.

If a customer has already filled anything in that section, it opens automatically
when they return, so nothing they typed is ever hidden from them.

**Step 8 ("The unit")**:

- **Regeneration heat** no longer offers "Let IAT recommend" and defaults to
  **Electric**.
- The **natural gas** question is gone.
- **Package preference** is removed entirely.
- **Final filter** no longer offers "Not sure" and defaults to **Not required**.
- **Cooling** no longer offers "Not sure" and defaults to **Not required**.
- **Heating** no longer offers "Not sure". It already defaulted to **Not required**.

The two removed questions were also taken off the admin view and the PDF, rather than
leaving them to report a default nobody actually chose.

The people count and activity fields at the top of step 7 now line up properly; one
carried a "typical value" chip and the other a calculation note, which had been
pulling them out of alignment.

## 2026-08-19 — Jerry welcomes you to the Hub

Jerry now stands at the left of the Hub's green banner and greets you by name from a
speech bubble — *"Good morning, [your name]! I'm Jerry — have a look around and see
what's happening here at IAT."* The name is whoever is signed in.

The greeting itself has not moved or changed; it is the same line the Hub always
showed, now spoken by Jerry rather than sitting on its own. The old opener,
"Here's what's happening around IAT today," was removed because Jerry now says it,
leaving the day's actual facts — who is out, the next holiday — beneath the bubble.

Jerry is hidden on phones, where he would crowd out the greeting on a narrow screen.

## 2026-08-19 — The Hub's core value now matches the one in the staff meeting

The Hub has always featured a core value of the week, but it picked one on its own schedule —
so the value on the screen and the value being discussed in the Monday staff meeting were
rarely the same one. They now follow the same rotation, in the order leadership uses:
Clean is King, Innovative Thinking, Quality Matters, Solve Problems, Integrity Matters, Have
Fun, Golden Rule, Colossians 3:23, Teamwork.

Confirmed against the meeting: the week of **17 August is Innovative Thinking**, 24 August moves
to Quality Matters, and it carries on down the list from there. The value changes at midnight
Eastern on Monday, so it is already the new one when the meeting starts, and it holds all week.
The changeover follows the office clock through the daylight-saving switches rather than drifting
an hour in November.

**Each value now shows the company's own icon** — the commissioned artwork, one per value — as a
row of nine under the banner, with the current week's highlighted and the rest dimmed. Clicking
one magnifies it to three times the size alongside the full wording, without leaving the Hub or
opening a new page.

Two values were renamed to match how they are said in the meeting: "Integrity is Key" is now
"Integrity Matters", and "This Company is a Team" is now "Teamwork".

## 2026-08-18 — The quote request asks who you are first, and looks up your elevation

**"About you" is now step 1** of the quote request, not step 8. A customer previously answered
nine engineering questions before telling us their name, so anyone who gave up partway left us
nothing to follow up on.

**Project location and elevation moved onto that first screen.** They were buried mid-survey,
which mattered more than it looked: elevation is part of how grains and dew point are
calculated, so every number the form showed was being worked out at sea level until nearly the
end.

**The form can now fill in elevation from the location.** Type "Covington, GA" or a ZIP code,
press the button, and the elevation appears. It is looked up from US Geological Survey ground
survey data — not guessed by an AI, which for this field would produce confident wrong answers
in a number that feeds the rest of the calculation. Checked against known values while
building: Denver comes back 5,276 ft against an actual 5,280. The field stays editable, and if
the lookup cannot find somewhere it says so and changes nothing.

**The live figures panel is now "Typical Industry Conditions"** and shows grains and dew point
only. The estimated moisture load, the pints-per-day figure, the breakdown bars and the dry-air
airflow are no longer shown to customers — they read as a firm selection when they are a rough
planning estimate from partial information. The same figure was removed from the review page
summary.

Those numbers are still calculated and still arrive with every request, so nothing is lost on
our side. Note the downloadable PDF still contains them.

## 2026-08-18 — Ticket numbers carry the unit, and the ticket page opens up

**Ticket numbers now read `IAT-SSSS-NNNN`**, where `SSSS` is the last four characters
of the unit's serial number. Customers quote a serial on every support request now, so
putting it in the number means staff can tell which machine a ticket is about from a
list, an email subject, or a phone call, without opening anything.

The second half is a running count, and it is doing all the real work. A number built
only from the unit and the year would repeat the moment the same machine had a second
problem in the same calendar year — and because ticket numbers must be unique, that
repeat would not produce a duplicate, it would refuse the customer's submission
outright. The count never resets, so that cannot happen. It was also started above
every number already issued, so no new ticket can land on an old one.

Numbers therefore jump from the ~2950 range to just above 9000, because a test record
sitting at 9001 set the floor. Existing tickets keep the numbers they already have.

**Every card on the ticket page now opens and closes**, not just Intake details. All of
them are expanded when a ticket is opened, so nothing is hidden behind a fold on
arrival; collapse whichever ones you have finished with. That state is deliberately not
remembered — reopening a ticket gives you the whole thing again.

**Intake details moved to the top** of the page. It was previously folded shut at the
bottom, which meant the serial number and the diagnostic checklist — the things you
triage from — were the hardest things on the page to reach.

Pressing **Update Ticket** no longer risks folding the card shut on the fields you were
editing, and the button stays reachable even when the card is collapsed.

## 2026-08-18 — Closing the last open door into the database

Public form submissions could, until today, be written straight into the database
over Supabase's REST API using the anonymous key — skipping `/api/submit` entirely,
and with it the rate limiting, the server-side validation, and the check that refuses
submissions to draft forms. The anonymous key is not a secret; it ships inside the
JavaScript of every public page, so anyone who wanted it had it.

Two database policies allowed this, and migration `091` drops both. One of them was
broader than it looked: it applied to *every* logged-in account, not just anonymous
visitors, which meant customer logins could write submission rows too.

These policies were not an oversight — the old standalone ticketing app genuinely
needed them. That app was retired on 3 August, so nothing had needed them since.

Nothing changes for anyone using the portal. Every form in the app, including the
version embedded on external pages, already submits through `/api/submit`, which uses
a privileged server-side connection and is unaffected. This was verified both ways
against production before and after the change: an anonymous write is now rejected,
a legitimate one still succeeds, and the public form pages still load normally.

## 2026-08-18 — The weekly report gets an edition number

Changes ship most days, which made "what went out this week" hard to talk about and impossible to
reference later. Each work week is now an **edition**, named after the Monday that starts it — this
week is **Edition 8.17.26**, covering 17–23 August.

Nothing is tagged by hand. An entry's edition is a function of its date, so every changelog entry
ever written already has one, and there is no field that can fall out of step with reality.

The written form is `M.D.YY` with no leading zeros — `8.17.26`, and `9.7.26` for a single-digit
month or day. It is what people already say out loud and the shortest thing that still reads as a
date. A year-first spelling was built first and reversed on the owner's call.

The trade that comes with it, recorded so nobody rediscovers it as a bug: **editions do not sort
chronologically by name**, so in a folder of attachments `10.5.26` lands above `8.17.26`. Every
place an edition is written also carries the full date range, and files keep their own timestamps,
so this costs tidiness rather than information. Restyling is one function in `lib/edition.ts` and
nothing else.

**The report now covers a closed week rather than a rolling seven days.** That matters more than it
sounds: the old window was measured backwards from whenever the job happened to fire, so an entry
could appear in two consecutive reports or in none at all, and a report could never honestly claim
to *be* a given week. Sent on Monday evening, it now reports the edition that ended the night
before — and Monday's own work belongs to the edition just starting, so it lands in next week's
report instead of being counted twice.

Editions appear in the email subject, the document header and the attachment filename
(`IAT-Portal-Edition-8.17.26.docx`). Any past week can be rebuilt with `?edition=8.17.26` or
`?edition=2026-08-17`;
any date inside the week resolves to that week's Monday, so nobody has to work out which day it is
named after.

## 2026-08-17 — A support ticket can no longer go quiet, and closing one means saying why

Quote requests have been chased since last week. Support tickets never were — a ticket could sit
unassigned indefinitely, or sit assigned to someone who had forgotten it, and nothing noticed.
Three things now do.

**Nobody has picked it up.** Unassigned for 24 hours and the support desk is told. **Assigned but
nothing is happening.** No note for 24 hours and the owner is told — one email covering all of their
stalled tickets, not one per ticket. "Nothing happening" deliberately means *no note*, not *the
status has not moved*: a ticket someone is working leaves a trail, even "waiting on parts", and
keying on status would let a ticket sit in In Progress forever and count as alive.

**And if neither of those lands** — a shared mailbox can go unread, and an unassigned ticket has
nobody to nudge — Kacy and Crystal are emailed by name, with the unassigned quote requests folded
into the same message, because both need the identical decision: hand it to a person. Separate
copies each, not one email addressed to both; a message addressed to two people is a message
addressed to nobody. Assigning an owner stops all of it; anything still unassigned is raised again
in 48 hours.

**Closing now requires saying why.** Both Resolved and Closed need real closing notes from the
employee, and those notes go to the customer word for word. The resolution dropdown does not count —
it is fifteen fixed phrases chosen for reporting, and "Replacement part installed" tells the person
whose machine broke nothing about their machine.

**And the customer hears about it.** They already got a copy of any public reply; they now also
hear when the status changes, and get the closing notes when it ends. Internal notes still never
reach them — that line does not move.

**A customer marking their own ticket resolved still does not close it.** They now have to say what
changed, and the desk is emailed to go and verify. "It seems fine now" and "the fault is gone" are
different claims, and only one of them belongs in a service record.

Who gets told what, and when, is now one page: [docs/notifications.md](docs/notifications.md).

## 2026-08-17 — The weekly update becomes two reads, and moves to 5pm

It went out at noon on a Monday, summarizing a week that included a Monday morning which had barely
happened — so anything shipped that day missed the report it belonged in. It now sends at 5pm
Eastern, when the day it describes is actually over.

It also carries **two reads in one document**. Part 1 is unchanged: the two-minute, non-technical
summary for leadership. Part 2 is the engineering record of the same week — file and table names,
thresholds, root causes, and a closing section naming what shipped **unverified** or was left
deliberately undone.

They are generated by two separate model calls rather than two halves of one, because they serve
opposite registers and a single prompt asked to do both drifts into a middle voice that serves
neither. The technical half is also exempt from the validator that polices the leadership half —
that gate exists to catch engineering vocabulary, which is exactly what Part 2 is supposed to use.
If the second call fails, the document ships with Part 1 alone: a missing technical appendix must
never cost leadership the summary that has the deadline.

⚠️ **`LEADERSHIP_UPDATE_EMAIL` is empty in production**, so this has been sending to nobody. Set it
in Vercel or the improvement above changes nothing.

## 2026-08-17 — A quote request needs a way to reach you

Name, company, email **and phone** are now all required on the RFQ wizard. Only the first three
were, and phone was the one that mattered most in practice: pricing a job almost always needs a
question answered, and doing that by email costs a day per round trip.

Enforced in the wizard step by step and again in `POST /api/rfq`, which is public and
unauthenticated. The digit rule is the same loose one the support form uses — ten digits after
punctuation is stripped, checking that a number was really given rather than that it can be
dialled — so the two intakes cannot drift into disagreeing about what a phone number is.

## 2026-08-17 — PRELIMINARY actually reads as a stamp now

The diagonal watermark on every page of the quote-request PDF was set to 7% opacity. On a screen
that is a legible ghost; through a printer it is very nearly nothing, which is a problem for the one
mark on the document whose whole job is to stop a planning estimate being read as a commitment.

Raised to 10% — enough to register as a stamp, still faint enough that the body text sitting on top
of it stays comfortable and the dark pine bands swallow it rather than showing a smear. It is a
named constant now rather than a number buried in the render loop, so there is one place to nudge if
it is ever wrong again. Checked by generating the PDF and looking at it, not by reasoning about
opacity.

## 2026-08-17 — A customer can now write back on a quote request

Support tickets have had a message box on the status page since the confirmation emails started
saying *"do not reply"* — you cannot tell someone not to reply and then give them nowhere to write.
Quote requests had the same no-reply wording and no such box, so a customer with a correction had
the phone or nothing. Now they have the same write-back: reference plus the email they submitted
with, a message, and it lands on the request.

**Where it lands is the interesting part.** Sales notes on a quote request were built as a strictly
internal trail — the card above them says the customer never sees this — and a customer message
dropped into that same list would be indistinguishable from a colleague's note except by a name you
have to recognize. Someone skims, mistakes their words for ours, and replies as though the customer
cannot read what was said around it. So every entry now records **who wrote it**: customer messages
carry a badge and their own tint, and the "internal" promise moved off the heading and onto the box
you type into, which is the only place it is still true.

**Somebody hears about it.** The person who owns the request, or the shared desk if nobody owns it
yet — never both, because copying the desk on everything teaches the desk to filter the folder. The
message is quoted in full in that email; making someone click through to read two sentences is how
an alert becomes something people scroll past.

The same locks as the ticket version: the reference alone is guessable and the reference-plus-email
pair is not, the bot check fails **closed** here rather than open, and whether a note reads as
"customer" or "staff" is decided by which door it came through — never by anything the sender can
put in the request.

With a real message box behind it, the RFQ confirmation email's button goes back to reading
**"View your request & send a message"**. It was reworded this morning precisely because it was
promising something that did not exist.

## 2026-08-17 — Checking your status now works for quote requests, not just tickets

The "View your request & send a message" button in the RFQ confirmation email has been landing
customers on a page that told them their reference **did not exist**. Not a broken link, not a
bad reference — the page simply never looked in the right place.

`/support/status` resolved two kinds of reference: support tickets (`IAT-…`) and troubleshooting
checklists (`TSC-…`). Anything else fell through to the ticket lookup, which searched the tickets
table, found no `RFQ-…` row there, and answered — correctly, from where it was standing — *"No
ticket found matching that number and email."* The RFQ confirmation email has carried that link
since quote requests shipped on 14 August. Every customer who pressed it got that message.

There is now a third resolver, and the page routes on the reference prefix. A quote request also
reads as one: it moves **Received → In Review → Quoted** rather than being told an engineer is
working on a repair, it shows back the application and location we captured so the customer can
confirm we understood the job, and it does **not** offer the "add a message" box or the portal-access
invitation — both of those write to the tickets table, and offering them here would promise a reply
that could never arrive.

The lookup box also stopped lying about the format it wants. Its placeholder read `TKT-123456-789`,
a shape this system has never issued.

**The general rule this cost us:** any intake that emails a customer a reference number needs a
resolver on that page *in the same change*. The link and the lookup were each fine on their own;
they were pointed at different tables.

One knock-on: that email's button read *"View your request & send a message"*, and there is no
message box on a quote request — only support tickets have somewhere for a customer note to land.
Now that the link actually arrives somewhere, the button had to stop promising something the page
does not do. It reads **"Check your request status"**, and the closing line points anyone with a
question at their sales engineer rather than at an unmonitored mailbox. Giving quote requests a real
message box is the better fix and remains open.

## 2026-08-17 — A support ticket now has to say enough to act on

Three fields the support form asked for politely, it now requires: **company / organization**,
**phone number**, and a problem description of **at least 100 characters**.

The description floor is the substantive one. A ticket reading "unit not working" costs the desk a
full round trip — email the customer, wait, re-read — before anyone can even decide who should look
at it. The Problem step shows a live character count and says exactly how far short you are, because
a "Next" button that grays out with no explanation reads as a broken form rather than an unfinished
one. The phone check is deliberately loose — ten digits after punctuation is stripped — since it is
confirming a number was really given, not that it can be dialled.

All three are enforced twice: in the form, step by step, and again in `POST /api/tickets`, which is
a public unauthenticated endpoint and cannot trust that the browser did its job.

## 2026-08-17 — The serial number stops hiding at the bottom of the ticket

Opening a support ticket in the admin showed you the customer's name and company as a gray run-on
line under the ticket number, and the serial number of the actual unit **inside a collapsed section**
below the problem, the status editor and the contact card. The two things you need before reading
anything else were the two hardest to find.

Both now sit in a **Customer & Unit** strip directly under the ticket number: customer, organization,
phone, email, serial and model, each labeled, with the phone and email click-to-contact and the
serial linking straight into the equipment registry when we have the unit on file. The old Contact
card is gone rather than duplicated — it carried a subset of the same facts one screen further down.

The queue list gained the serial too, alongside the ticket number, since that is what the desk
actually searches on.

## 2026-08-17 — The quote-requests dashboard card gets its title back

The "My Quote Requests" card you can add to your dashboard was rendering with **no title and no
card border** — an anonymous block of text beginning "5 unassigned", sitting on a grid where every
other card is titled and framed. The data in it was correct; there was just no way to tell what it
belonged to.

Each card on that dashboard is responsible for drawing its own frame and heading, and this one had
been written without either. It was never caught because **no admin page in the quote-request
feature had ever been opened in a browser** — it was verified by compiling it and by querying the
database, both of which a missing wrapper passes cleanly. Found within a minute of someone actually
looking at it.

## 2026-08-17 — Being handed a quote request is no longer silent

Assigning a quote request to someone sent them nothing. The first thing an owner heard about work
that was already theirs was the 24-hour reminder telling them it had been sitting untouched — the
system's opening line was a complaint. Assigning now emails the new owner immediately, with the
customer, the project, the size of the job and a link straight to it.

Four judgement calls worth knowing about. **Assigning something to yourself sends nothing** — you
know what you just did, and mail people send themselves is the fastest way to teach them to ignore
the sender. **It fires only when the owner actually changes**, so re-saving the same person does
not re-send. **A mail failure never fails the assignment**, which is already saved by then — the
assignment is the record, the email is a courtesy, and losing the courtesy must not roll back the
record. And **assigning to someone with no working address is logged as a warning rather than
swallowed**, because the 24-hour reminder would hit the same dead end and the unassigned sweep
only covers rows nobody owns — that request would otherwise be chased by nobody at all.

## 2026-08-17 — Four security advisories closed, without the fix that breaks the build

`nanoid`, `js-yaml` and `brace-expansion` (all high) plus `dompurify` (moderate), all reaching us
indirectly through other packages. Closed by pinning safe versions.

**Two of the four could not be fixed the obvious way.** `brace-expansion` is installed twice on two
incompatible major versions, one for each version of `minimatch` in the tree; `nanoid` likewise, one
copy for `postcss` and another for the Word-document library. Pinning either package globally — the
fix a tool suggests — silently hands one consumer a version whose API it does not speak. Each was
pinned against its specific parent instead.

This repo has been bitten by exactly that before, and by the fact that **`npm audit` reports "0
vulnerabilities" either way**, so it cannot be used to tell a real fix from a broken one. Verified
instead by running both versions of the affected code and checking real results against expected
ones — fifteen checks, including that the Word-document generator still produces a valid document.

## 2026-08-17 — Scheduled jobs no longer need a twice-yearly reminder

Vercel Cron runs on UTC and does not shift for daylight saving, so every schedule drifts by an
hour twice a year. The fix — register the job at **both** UTC times and let the route discard
whichever one is wrong for the season — was already written down but never applied, because a
comment claimed the account tier capped `vercel.json` at two entries.

**That cap does not exist.** A third entry deployed fine this week, and multiple schedules for a
single path is the documented, supported pattern. What the belief actually cost was a manual edit
every November and March, on jobs where arriving an hour early is visible to the people receiving
them. Three comments asserting the limit have been corrected.

The daily admin digest and the weekly leadership update are now each registered twice, an hour
apart, with the season's wrong half discarded inside the route. The leadership update had **no**
wall-clock guard at all, so it could not have taken a second entry without mailing leadership
twice; it has one now, matched to the whole noon hour rather than a narrow band, because entries
a full hour apart let a wide window absorb a late invocation without ever admitting both.
Verified against Mondays either side of both changeovers: exactly one fires in every case, with
59 minutes of delay tolerance.

**Stalled quote requests are now chased in the morning.** The reminder sweep has its own slot at
the start of business instead of only riding the afternoon digest — a request that has sat
untouched gets surfaced at the top of the day rather than the end of it. The digest still calls
the same sweep, deliberately: the reminder stamps make the second run a no-op, so the duplication
costs two queries and buys chasing that survives either schedule breaking.

## 2026-08-17 — Session handoff record

Full business-continuity record of the session that built Request for Quote and everything that
fell out of it: [`docs/handoff/2026-08-17-session-handoff.md`](../docs/handoff/2026-08-17-session-handoff.md)
(repo root `docs/`, not this app's `docs/`).

Scope, a file-by-file change log with reasoning, every design decision including the ones
**rejected** so they don't get re-proposed, the gotchas found, an explicit verification table
naming what was **not** tested, open threads, and the minimum context to resume cold.

Read it before picking this feature up. The two things most likely to bite: an unmapped
`/admin/*` path is fail-**open**, and `if (CRON_SECRET && …)` is fail-**open** — both are
documented there with what they cost.

## 2026-08-17 — A weekly leadership update, generated from this file

Mondays at noon Eastern, `/api/cron/leadership-update` reads the last seven days of **this
changelog**, has Claude rewrite it for a non-technical reader, renders a one-page Word document
and emails it to `LEADERSHIP_UPDATE_EMAIL` (currently Lee Childers).

**Why the changelog is the source.** It is already written, already accurate, and already
updated on every deploy. Summarising git subjects instead would mean summarizing commit
messages, which describe code; changelog entries describe what changed for the business. It also
means the report cannot drift from reality — if nothing was written down, nothing is claimed.

**The model translates, it does not invent.** The prompt forbids anything not present in the
source, bans implementation vocabulary outright, caps each line at one sentence under 18 words,
holds the total to 14 lines, and repeats the standing rule about never naming a customer or a
competitor. The first version produced 553 words across 19 lines, every one over the cap and
thick with `endpoint`, `idempotency`, `401`, `bisection` — it wanted to explain the engineering.
Three bad/good examples plus a validation gate fixed it: any line over 20 words, containing more
than one sentence, or using banned vocabulary is quoted back for one rewrite. Naming the
offending lines works far better than restating the rules. **This week: 11 lines, 144 words, one
page, about 25 seconds to read.**

A quiet week still sends — silence is indistinguishable from a broken job, and this portal has
been bitten twice by exactly that. A second failed rewrite ships anyway and logs it: a wordy
update beats a silent Monday. `?dry=1` returns the summary without sending, to check the wording
before a Monday.

**The two-cron tier limit is gone.** This is the third registered cron and it deployed fine, so
the note in `admin-digest` about staying within two entries is stale. Worth revisiting: that
constraint is why the digest registers only its EDT schedule and needs a manual one-line flip at
each DST changeover. Adding the second entry back would make it self-correcting.

## 2026-08-17 — CRON_SECRET was never set, so no cron had ever run

Found while verifying the RFQ reminder sweep: **`CRON_SECRET` did not exist in Vercel
production.** Every cron route guards with `if (!CRON_SECRET || auth !== …)`, and Vercel only
attaches the bearer header when that variable exists — so every scheduled invocation 401'd.

`digest_runs` was **empty**. The daily admin digest has never sent, not once, since the day it
was built. Weekly PTO accrual (`/api/cron/accrue-pto`) had never run either.

> **Follow-up, 20 August.** Setting the secret was necessary but not sufficient: the digest still
> never landed, for a second and unrelated reason. See the 20 August entry — nothing below should
> be read as saying the daily digest started arriving.

The secret is now set (48 bytes of CSPRNG, base64url, Production only) and the project
redeployed so the functions pick it up. Verified against production: anonymous → 401, wrong
secret → 401, correct secret → 200. `/api/cron/admin-digest` called with the secret outside its
window returns `{skipped: true, reason: "not digest time (NY)"}` and leaves `digest_runs` empty,
which is exactly right.

**⚠️ A related bug of my own, same day:** `/api/cron/rfq-reminders` shipped with
`if (CRON_SECRET && auth !== …)` — the check is *skipped* when the variable is unset, so while
it was missing an anonymous GET could run the sweep and send mail. One did, during verification:
it stamped all five surveys and delivered a REMINDER to the shared desk. Fixed in `426de37`; all
four cron routes now fail closed. **A route whose only job is to send email must never be
reachable by default.** (That push also hit the missed-webhook trap and needed an empty commit.)

**Digest opt-out, temporary — revisit.** Arming the digest means six admins get an email they
have never seen. At Jacob's request three are held back for the first live sends while the
format is reviewed: **Jacob Younker, Tyler Bell, Jo Evans**. Crystal, Kacy and Lee receive it.
The list is `DIGEST_OPT_OUT_DEFAULT` in `lib/admin-digest.ts`, overridable without a deploy via
`DIGEST_OPT_OUT_EMAILS` (empty string = nobody excluded), and every run logs how many were held
so a temporary exclusion cannot quietly become permanent.

## 2026-08-15 — Quote requests get an owner, a permanent note trail, and someone chasing them

Migration 088. Four connected pieces, all aimed at the same failure: five real surveys sat
unread for three days because nothing made them anyone's job.

**An assignee.** Picked from the people who actually hold `deals` — resolved server-side against
the live permission matrix, never taken from the client. The name is snapshotted as first name +
last initial ("Jacob Y."), so deleting an account later cannot erase who was working it. Two
people called Jacob is precisely why it is not just a first name. The queue gains an Owner
column, an owner filter with **Unassigned** at the top, and an Unassigned stat that turns amber
when it is non-zero.

**Notes become a permanent trail.** The single editable textarea is gone — it was a whiteboard
where the last person to type won. Each note is now its own row, stamped and attributed, listed
newest-first and scrollable. The route is **POST-only**: no PATCH, no DELETE, and author and
timestamp come from the verified session and the database clock rather than the request body, so
neither can be forged or backdated. A correction is a new note. Anything already typed into the
old column was migrated into the trail; the column stays as a tombstone.

**Two reminders, both keyed on a survey still sitting at New:**

- Assigned and untouched for 24h → the owner gets one email covering *all* their stalled rows,
  not one per row.
- Nobody assigned for 24h → the shared desk gets one with **`REMINDER:`** leading the subject.

Moving a request to any other status stops the chasing, which is the point — one click on
*Reviewing* says a human has it. Idempotency is a timestamp per reminder kind, stamped only on a
successful send so a failure retries tomorrow rather than going quiet, and cleared when the
status leaves New so a row that later comes back is chased fresh rather than suppressed by a
months-old stamp.

`vercel.json` is capped at two cron entries on this tier and both are taken, so the sweep
piggybacks on the daily digest run — deliberately *before* that route's digest-time and
already-sent guards, since those exist to stop the digest sending twice and would otherwise mean
a day the digest skipped was a day nobody got chased. `/api/cron/rfq-reminders` exists for a
manual trigger and can take its own schedule when a slot frees up.

**On the dashboard.** A *My Quote Requests* card on the department dashboard (the first card
that reads the viewer's own id rather than a department roll-up) and two pills in the Sales
dashboard header, since Sales lands on its own command center and would otherwise never see an
RFQ without opening the queue. Both show the unclaimed count *as well as* your own — a dashboard
that only listed your assignments would go quiet exactly when nobody has picked something up.

Verified: the roster resolves to the eight people holding `deals`; the byline handles both
Jacobs, single-word names and blanks; and the sweep's row selection was dry-run against
production — all five current surveys qualify for the unclaimed reminder, and the owner sweep is
correctly empty because nothing is assigned yet. **The first digest run after this deploy will
therefore send one REMINDER email listing all five.**

## 2026-08-15 — The RFQ queue can actually be worked

`/admin/rfq` could be read but not worked: the `status` and `internal_notes` columns from
migration 087 had no UI, so every survey read "New" forever. Five had landed — two of them real
outside submissions — and none had been opened.

**Triage card** on the detail page: a status picker (New / Reviewing / Quoted / Closed) and
internal notes. Status saves on click and reverts if the server rejects it, so the UI never
shows a state that did not stick. Notes save on a pause in typing — a desk note is written in
fits and starts, and a Save button people forget to press is the same as no notes at all.

**Sidebar badge** on Sales › Quote Requests, keyed on `is_read` rather than `status = 'new'` so
it clears when a human has actually opened one, matching Submissions. Without it the only signal
a survey arrived was the desk email, which is the channel that has been unreliable — that is why
five sat unnoticed.

`PATCH /api/admin/rfq/[id]` accepts **`status` and `internal_notes` and nothing else.** The
survey and the estimate we showed the customer are a record of a conversation; a record you can
quietly edit after the fact is not a record. Gated by `requireRfqAuth` on the same `deals` perm
as the page, so page access and write access cannot drift apart. Verified: an anonymous PATCH
returns 401 and changes nothing.

The status vocabulary moved to `lib/rfq-status.ts`, shared by the list filter, the detail picker
and the API validator. The column has a CHECK constraint and three private copies of that list
would eventually disagree with it — the route now rejects an unknown status with a readable
message instead of surfacing a raw Postgres error.

## 2026-08-14 — RFQ: answer in your own units, and the one-pager leads the PDF

Four changes from Jacob's first pass over the live form.

**Every temperature/moisture pair now takes %rh, dew point, grains or wet bulb** from a
dropdown. Room specs arrive as %rh, dry rooms as a dew point, process wheels as grains, and a
sling psychrometer gives a wet bulb — making someone convert before they can answer is how you
get a wrong number typed confidently. All four are live on the room target, the surrounding
space, the outdoor design condition and the process leaving-air spec.

`setCondition()` is the only place a condition changes, because two things have to hold and
both are easy to get wrong piecemeal: **the dry bulb is part of the moisture answer** (a 50°F
dew point is 49%rh at 75°F and 70%rh at 60°F, so moving the temperature recomputes the canonical
%rh), and **switching units converts rather than clears**. The canonical field stays the only
input to the load engine, so nothing downstream knows a unit was chosen. `/api/rfq` re-derives
every canonical value server-side, so a direct POST cannot claim 5%rh while its dew-point field
says otherwise.

**Two numbers in the preset copy were wrong and are now checked against the psychrometrics.**
"1%rh at 68°F is roughly a −20°F dew point" — it is −30°F (−20°F dp is 1.8%rh). "Around
0.4 gr/lb is a −40°F dew point" — that is −45°F; −40°F dp is 0.55 gr/lb, and the battery dry-room
preset now seeds exactly that. Both were confident-sounding and wrong, which is worse than
vague.

**`dewPointF` is now exact rather than a curve fit.** ASHRAE's explicit eq. 39/40 is a different
function from `satVaporPressure`, so rh → dew point → rh did not round-trip across the ice/water
crossover (0°F at 70%rh came back as 70.25%). With customers able to type a dew point directly,
and freezer and cold-storage presets sitting on that crossover, the two directions have to be
exact inverses. Bisection instead; ≤0.07°F from the old values at normal conditions.

**PDF:** the takeaway one-pager **leads** the document instead of closing it — the person
opening it wants their own numbers first. Every page now carries a diagonal PRELIMINARY
watermark and a highlighted band with the required wording: *"Preliminary selections and
performance readouts are provided for planning purposes only and should be validated by IAT or
a qualified professional engineer prior to final design or commitment."* The old one-off
disclaimer panel on the load page is gone — two copies on one page read as boilerplate.

Reserving the bottom of every page for that band meant the record pages could run underneath it,
so each section now calls `ensure()` with the height it is about to draw and continues on a fresh
page if it would collide. Doors moved from the geometry page to the load page, where the
breakdown that says they are usually the dominant load actually lives.

Also: the doors exposure toggle reads **"Opens to Surrounding"**, and both the PDF and the admin
detail echo back the reading as entered ("entered 35 °F dp") when it was not the canonical unit —
how a spec is written is itself a signal worth keeping.

See [`docs/rfq-moisture-survey.md`](docs/rfq-moisture-survey.md).

## 2026-08-14 — Customer ticket emails land in the codebase, still switched off

Written 2026-08-12 and left uncommitted on one machine until now. Two customer-facing
notifications, both **inert**:

- **Confirmation on submit** — ticket number, what they told us, and the automated
  suggestions they already saw on screen.
- **A copy of an admin's "Reply to customer" note** — so a reply reaches their inbox
  instead of only appearing if they log into the portal.

Both short-circuit unless `CUSTOMER_TICKET_EMAILS = "on"`, which is **not set in Vercel**.
With it unset nothing sends, no extra DB read happens, and both routes behave exactly as
they did before. This changes no customer's experience today.

**Why it was worth committing anyway:** `docs/support-tickets.md` has been instructing
readers to flip that switch since 2026-08-13, while the code reading it existed on a single
laptop. Anyone following the documented DNS→Resend runbook would have set the variable and
watched nothing happen, with no error to explain it. The docs and the code now agree.

The reply path cannot leak an internal note. `visibility` and `author_type` are derived
server-side from the verified session, never from the request body — staff notes are forced
`internal`, customer notes carry `author_type: 'customer'`, and only the admin branch can
produce the `public` + `admin` pair the email is gated on. The note is committed before any
send is attempted, and a mail failure is logged, never raised.

**Do not turn the switch on yet.** With the domain unverified, every message would be
refused by the sandbox sender — the same silent failure documented below, except aimed at
customers instead of the desk. The order is: DNS edits → Resend reports `verified` →
`RESEND_FROM_SUPPORT` → *then* consider this switch.

Also syncs the vendored MapLibre worker bundle in `public/maplibre/` from 6.0.0 to the
6.1.0 already in `package.json`. Regenerated by the `sync-maplibre-worker` prebuild step,
which exists precisely so a main/worker version skew cannot reach runtime; Vercel runs the
same step, so production was never serving the mismatch — only the committed copies were stale.

## 2026-08-14 — RFQ: the moisture survey becomes an interactive form with a PDF that teaches

A second card on `/support`, under "Start a support request": **RFQ — Request for Quote**. It
replaces the two Word attachments we have been emailing around (*IAT Quote Request and Moisture
Survey Form*, Room and Process) with a guided survey at `/support/rfq`.

**The fork comes first.** Room or building (a space held at a condition) vs process airstream (dry
air delivered to a machine). The two tracks then ask different questions — 9 steps vs 7 — and the
switch is offered only on the application step, before anything branch-specific has been answered.

**Typical values are the whole trick.** Picking one of 18 room applications or 11 process
applications seeds the target condition, surrounding space, occupancy and door activity with
numbers someone in that industry recognizes. Every one stays editable and carries a one-tap
"typical" chip, which is how a technically complete survey still finishes in about three minutes.

**The numbers build as you type.** A live rail computes grains, dew point, the running load
estimate, a bar breakdown by source and the dry-air cfm. Beyond being the engaging part, it
quietly teaches the thing that matters most to a first-time buyer: relative humidity on its own
cannot size a dehumidifier.

**The PDF is the deliverable.** Five vector pages (~35 KB, generated client-side): a cover with
four at-a-glance tiles, the space with an isometric room diagram and the design-conditions table,
the load breakdown with bars, equipment and utilities, and — the last page — **a one-page takeaway
infographic** of the customer's own numbers: their target in four units, their room drawn to their
dimensions, the arithmetic done with their figures, where their moisture comes from, a typical-
conditions reference with their application highlighted, and the five-step design procedure.

The estimate is preliminary everywhere it appears and says so, in the same words as the paper form.

**Under it:** `lib/rfq-psych.ts` (ASHRAE moist-air properties, checked against published points),
`lib/rfq.ts` (the load set, arranged like our internal moisture-load workbook — permeation, shell
leakage, doors, people, product, combustion, wet surfaces, fresh air, 10% safety factor, with
ventilation carried separately so the system is not oversized), `lib/rfq-pdf.ts`, migration 087
(`rfq_requests` + an atomic per-year reference counter), `POST /api/rfq`, and `/admin/rfq`.

Two things worth knowing before editing:

- **Every PDF string passes through `san()`.** jsPDF's Helvetica is WinAnsi-encoded with no
  fallback — `≈` shipped as `ʺH` and `′` as a stray `2` until the sanitiser existed. Silent
  corruption, no error.
- **`/admin/rfq` is mapped to the `deals` perm in `ADMIN_PATH_PERMS`, and that mapping is
  load-bearing.** An unmapped `/admin/*` path falls back to `dashboard`, which every scoped role
  holds — leaving it off would have shown a stranger's contact details to HR, marketing and
  production. (The comment at `requiredPermForPath` claiming unmapped paths are "admin only" is
  wrong; the entries around `comp-review` and `learn-content` have it right.)

**The desk alert inherits the support stopgap on purpose.** Recipient chain is
`RFQ_NOTIFICATION_EMAIL` → `SUPPORT_NOTIFICATION_EMAIL` → `jacob@dehumidifiers.com`. Written with
only its own variable, this feature would have shipped straight into the failure documented below
— sandbox sender, silent refusal, nobody the wiser. Falling through to the stopgap that is already
set means RFQ alerts arrive with no new Vercel config, and both senders revert to their proper
defaults together the day that stopgap is deleted. The survey is committed **before** any send is
attempted, so a refused email never costs us the request; it is in `/admin/rfq` either way.

No customer confirmation email: they already have the PDF, which is the better artifact.

See [`docs/rfq-moisture-survey.md`](docs/rfq-moisture-survey.md).

## 2026-08-14 — Hardening the customer message box after a security review

Two fixes and a deliberate non-fix, from reviewing the endpoint added earlier today.

**The message box no longer appears on troubleshooting lookups.** The portal-access CTA beside it
was correctly gated with `!startsWith('TSC-')`; the message box was not. TSC- references are
checklist intakes in a different table, and the endpoint only resolves `tickets` — so a customer
looking up one of those was offered a reply that could never land. Not a security hole, but a
promise the portal could not keep.

**reCAPTCHA now fails CLOSED on that endpoint, at a 0.7 score threshold.** `verifyRecaptcha` takes
options; every other caller keeps the existing fail-open behavior, which is correct for customer
submissions — a missing env var or a bad day at Google must never be why a real support ticket is
lost. An anonymous *write into an existing record* is the opposite case: reCAPTCHA is the only
control gating it, so failing open would mean one missing `RECAPTCHA_SECRET_KEY` silently turns it
into an open door with nobody the wiser. A customer blocked there still has the phone. The score bar
rises from 0.5 to 0.7 because the credential it protects is a guessable pair — a sequential ticket
number plus an often-public email.

**A visible "I'm not a robot" checkbox was considered and rejected.** It is reCAPTCHA v2 and needs a
different site key; it adds friction to the exact journey a frustrated customer takes to reach us;
and it does not address the actual threat, since a human guessing a ticket number passes a checkbox
without breaking stride. Raising the invisible v3 bar achieves more, for free.

**Known and accepted:** ticket references are sequential (`IAT-2026-2944`), so the number half of
the pair is enumerable. This predates the write endpoint — `/api/tickets/status` already exposed
ticket details to the same guess — but writes make it worth fixing properly. A random suffix on the
reference would close it at the root and is the highest-leverage remaining change. The rate limiter
still fails open by design: it is a throttle, not an auth control, and failing closed there would
deny real customers during a backend blip.

## 2026-08-14 — Customer mail stops inviting replies, and customers can finally write back

The confirmation emails shipped earlier today told customers to reply to them, and sent from
`iatsupport@`. That was a dead end: **nothing ingests inbound email into a ticket**, so a reply
would land in a mailbox while the thread sat in the portal, splitting the conversation across two
places nobody reconciles.

All customer-facing mail now sends from **`noreply@dehumidifiers.com`** and says plainly not to
reply. In place of the reply invitation each email carries a deep link to
`/support/status?ticket=<reference>` and a "View your ticket & send a message" button. That covers
the ticket confirmation, the copy of an admin's reply, and the RFQ confirmation. Desk notifications
are unchanged and still go to `iatsupport@`.

**The link needed somewhere to land.** `/support/status` was read-only, and every route touching
`ticket_notes` was authentication-gated — there was no write path for an anonymous customer at all.
Telling people not to reply while giving them nowhere to write would have been worse than the
behavior it replaced, so the two ship together: a **message box on the status page**, backed by
`POST /api/tickets/status/message`.

A stranger is allowed to write to a ticket by proving the same pair the status lookup already
requires — the ticket number **and** the email it was raised with. The number alone is guessable;
the pair is not. On top of that: reCAPTCHA, a tighter rate limit than the lookup (8 per 10 min),
message text stored escaped rather than as caller-supplied HTML, and `visibility`/`author_type`
hardcoded so a crafted request cannot post an internal note or impersonate staff. The note attaches
to whichever ticket the pair resolves to, so a caller cannot aim it at another ticket's id.

The desk gets an alert when a customer writes (`sendCustomerMessageAlert`). Without it a reply
would sit silently in the thread with nobody prompted to look — the same failure shape as the
notification outage earlier this month.

## 2026-08-14 — The domain sends its own mail, and no notification goes to a person again

DNS moved from Wix to GoDaddy and `dehumidifiers.com` **verified in Resend**. Portal mail now sends
from the real domain instead of Resend's sandbox address, which could only ever deliver to the
Resend account owner. That limitation is what silently swallowed six support tickets between
2026-08-03 and 08-13.

The move itself: 16 records rebuilt at GoDaddy and verified record-by-record against live DNS
*before* the name servers were switched at Network Solutions, so the cutover was a non-event —
company email never dropped, and the Wix website came through on the pointing method (apex A →
`185.230.63.107`, `www` → `pointing.wixdns.net`). The stray `feedback-smtp` MX that had been sitting
on the apex at priority 20 was deleted first, which also cleared an error Microsoft 365 had been
reporting on the domain.

**Senders now use the real domain:** `RESEND_FROM_SUPPORT` = `iatsupport@dehumidifiers.com`,
`RESEND_FROM_PORTAL` and `RESEND_FROM_FORMS` = `noreply@dehumidifiers.com`. Ticket mail carries no
separate reply-to, so replies land on the support sender — hence a real, monitored, shared mailbox
rather than the `technicalsupport@` placeholder that only ever existed in a code comment.

**No notification is addressed to an individual any more.** Ticket, troubleshooting and RFQ desk
alerts all go to `iatsupport@dehumidifiers.com`, and the hardcoded fallbacks in the three routes
changed from `crystal@` / `jacob@` to the same shared mailbox. A personal address is a single point
of failure that nobody notices until something is missed — holiday, sick leave, someone leaving.
Even the floor the code falls back to should be shared. `RFQ_NOTIFICATION_EMAIL` is now set
explicitly rather than inheriting `SUPPORT_NOTIFICATION_EMAIL`, so changing where tickets go no
longer silently moves quote requests with them.

**Customers now get a confirmation.** `CUSTOMER_TICKET_EMAILS` is on, and despite the name that one
switch governs every customer-facing send so they cannot drift apart: the ticket confirmation, the
copy of an admin's "Reply to customer" note, and a **new RFQ confirmation**
(`sendRfqConfirmationToCustomer`) sent when a moisture survey is submitted. Each quotes the
customer's reference number and invites a reply that keeps it in the subject line.

## 2026-08-13 — Support-desk alerts were silently undeliverable; two open endpoints closed

Found while verifying the photo fix below: **no support-ticket notification has been delivered
since 2026-08-03.** Resend's send log stops dead at IAT-2026-2938. Tickets 2940, 2941, 2942, 2943,
**2944** and 2945 produced no send at all — which is why 2944 (a customer with a burner alarm)
reached us as a forwarded screenshot instead of a notification.

Three things that each look fine alone:

- `dehumidifiers.com` is **`status: failed`** in Resend — DKIM verified, SPF failing.
- No `RESEND_FROM_*` in Vercel, so the sender falls back to `onboarding@resend.dev`. Resend's
  sandbox sender can **only deliver to the account owner's own address**.
- On 2026-08-03 (`44c9452`) the desk recipient changed from the admin roster to hardcoded
  `crystal@dehumidifiers.com`.

Before that commit the mail went to the account owner and delivered. After it, Resend refuses every
send and the route logs the failure without failing the ticket — the same silent-success signature
as the photo bug.

**Stopgap now live:** `SUPPORT_NOTIFICATION_EMAIL` = `jacob.younker@dehumidifiers.com`
(Production + Preview). `crystal@dehumidifiers.com` is untouched in code and is still the fallback —
deleting the env var reverts instantly. **Alerts must be forwarded to Crystal by hand until the
domain verifies.** Verified live: a submission on 2026-08-13 delivered to the redirect address, the
first successful send since 3 August.

**The DNS defect is identified but NOT yet applied** (no changes have been made at Wix, GoDaddy or
M365). Resend verifies via a `send.` subdomain, so the apex SPF is *not* involved and Microsoft 365
is not at risk. The actual problem is a **misplaced MX record** — see
[docs/support-tickets.md](docs/support-tickets.md) for the exact two edits.

**Also closed two open endpoints.** `/api/troubleshooting` was a public, unauthenticated POST that
wrote a row, spent a model call and sent mail behind nothing but a rate limit; `/api/troubleshooting/analyze`
spent a paid model call the same way, while its twin `/api/tickets/analyze` had been gated all
along. Both now verify reCAPTCHA (`submit_troubleshooting` / `analyze_troubleshooting`). No live UI
posts to either — the checklist merged into the Equipment Support ticket and
`TroubleshootingChecklistForm.tsx` is no longer rendered anywhere — so nothing changes for
customers. The read-only `/status` endpoints stay ungated, matching `/api/tickets/status` and the
live status page, which sends no token.

## 2026-08-13 — A trailing newline in an env var was eating every customer photo

A customer attached six photos to a burner-alarm ticket (IAT-2026-2944) and staff opened it to
find none of them. The `image5.jpeg` filenames visible in the description were a red herring —
those come from pasting an Outlook email into a `<textarea>` and were never clickable. The real
bug was underneath: **all six photos uploaded successfully**, landing in the `ticket-photos`
bucket one second before the ticket row was written, and the row still came out with
`photo_urls = NULL`. So had every other ticket in the table.

The Vercel production value of `NEXT_PUBLIC_SUPABASE_URL` carried a **trailing newline** —
`"https://….supabase.co\n"`, almost certainly `echo` piped into `vercel env add`. It broke
asymmetrically, which is why it hid for so long:

- The browser's `supabase-js` client **normalizes** the URL it's constructed with, so uploads
  worked and `getPublicUrl()` returned a clean link.
- Every server-side allow-list built its prefix by **raw template concatenation**, so the newline
  landed in the *middle* of the prefix and `url.startsWith(prefix)` was false for every
  legitimate upload.

Photos were accepted, stored, then silently dropped on the way into the row. No error anywhere:
the customer saw a success screen, the desk email sent, and the files sat orphaned in the bucket.
It took a customer complaint to surface it.

The same untrimmed prefix guarded SRV photos (`form-uploads`) and the `/admin/support-content`
reference photos — which is why saving a wheel/seal image failed with the misleading *"Images must
be uploaded here — external links are not allowed"*, and why both `app_settings` rows sat empty.

Fixed by re-saving the env var for Production and Preview with no trailing whitespace (it's
inlined at build time, so this needs a redeploy to take effect), and by adding
**`lib/public-storage.ts`** — the single place the env becomes a bucket prefix. It trims and
strips trailing slashes once; `lib/support-reference.ts`, `app/api/troubleshooting/route.ts` and
both SRV routes now defer to it instead of re-concatenating. `validPhotoUrls()` also logs when it
drops URLs, so this class of silent data loss leaves a trace instead of nothing. The six orphaned
photos were backfilled onto IAT-2026-2944.

`next.config.js` was never affected — `new URL()` tolerates the newline, so `remotePatterns`
resolved correctly throughout. Full writeup in [docs/support-tickets.md](docs/support-tickets.md).

## 2026-08-11 — Learn: the library is shelves by category, not one sideways deck

Team feedback on `/admin/learn`: scrolling sideways through the courses, with no sense of which
category anything belonged to. Both complaints were the same regression. The library was a single
horizontal deck built when there were **14 subjects**; the Refrigeration & HVAC/R course took it to
**32**, and `getLearnDashboard` fetches modules ordered by the *module's* `display_order` alone —
which **interleaves categories**. So the deck had become 32 cards of shuffled subject matter, about
4½ visible at a time, behind roughly seven sideways scrolls.

It is now **one vertical shelf per category**, in the admin's order, each with its own counts and
progress: Onboarding 2 · Company 3 · Safety 1 · Technical Training 6 · Products & Tools 2 ·
Refrigeration & HVAC/R 18. Inside a shelf subjects keep their module order, so the 18-part HVAC/R
course reads as the syllabus it is instead of an alphabet soup. The whole library is now ~2,700px
at 1280 wide — under three screens, all of it vertical, with a **"jump to" row** across the six
shelves at the top.

**The color got better, not worse.** Every subject still wears its category's Tone (the DESIGN.md
§2.4 dashboard exception), but a shelf is now one color block rather than six tones shuffled
together, so the wash finally reads as "this part of the library" — which is what it always claimed
to mean.

Added along the way: a **text search** (32 subjects is past the point of scanning), and shelves that
collapse away when a filter or search excludes them, with an `n of 32` count. Shelf totals are
computed over the **whole category, never the filtered subset** — "22 of 63 lessons read in
Onboarding" is a fact about Onboarding, and would otherwise jump every time someone clicked a tab.

Three smaller fixes that fell out of the rebuild:

- **Tile titles now align across a row.** The status pill sat *above* the title, so a card with a
  "Done" or due pill pushed its title down while its neighbour's stayed up — ragged in exactly the
  place you scan. Title is first now; completion moved into the progress row.
- **"Required of you" is a compact list, not tiles.** Every subject in it also appears in its own
  shelf below, and repeating the full card a screen apart read as a rendering bug.
- **100% no longer means "finished" when a quiz is outstanding.** A subject with every lesson read
  but an unpassed published quiz is *not* complete (`subjectIsComplete`) — that tile said "100%".
  It says **"Quiz left"**.

`SubjectScroller` and its `.learn-deck` scrollbar CSS are deleted; `SubjectCard` gained
`categorySlug` + `categoryOrder`, without which grouping can't reconstruct the category order the
interleaved module ordering destroys.

## 2026-08-10 — Login: collapse email + password behind a disclosure

"Sign in with Microsoft" was already the primary action; the email + password form now starts
**collapsed** behind the "or sign in with email" divider and expands on click. The eye lands on
the SSO button, but the fallback stays honest — this is a disclosure, not a hidden easter egg,
because break-glass sign-in happens during an outage, under pressure, possibly on a phone. The
toggle carries `aria-expanded`/`aria-controls`, is reachable in two Tab presses, opens on Enter,
and moves focus to the email field.

Two behaviors worth keeping if this is ever restyled: the `?error=` banner moved **outside** the
collapsible (a callback error arrives with the panel closed, and rendering it inside would hide
the only explanation the user gets), and `sso_failed` is the one error code that starts the panel
open, since its message tells the user to fall back to email.

No auth logic changed — password sign-in works exactly as before. Note this is presentation, not
a control: `signInWithPassword` runs client-side against Supabase and the anon key is public in
the bundle, so what actually retires password sign-in is deleting the credentials, which stays
gated on removing the provisioning gate first. See [docs/microsoft-sso.md](docs/microsoft-sso.md).

## 2026-08-10 — Damper Flow Model: a damper you drive, not a calculator you type into

Internal Apps gains `/tools/damper-flow-model.html`, an interactive model of a **TAMCO Series 1000
Air-Foil Control Damper**. It rebuilds an externally-written selection calculator as something with a
handle on it: a blade-angle slider drives a live section view and a face view, and free area,
pressure drop, loss coefficient and the ΔP→CFM K-factor all move together. The face view is the
honest one — the open fraction you see *is* α, checked in-browser at 0.8999 drawn against 0.9000
modeled.

Two modes off one physics core. **Select** sizes the damper. **Measure** treats it as a flow element:
lock a blade angle, get the K for `CFM = K√ΔP`, fit a real K from field-measured points (least
squares through the origin, with R² and a worst-point residual), and export IEC 61131-3 structured
text so a PLC can drive a CFM readout from a differential-pressure transmitter — including the
low-flow cutoff, because below it the square root turns transmitter noise into a jumping display.

**The headline correction: a damper's loss coefficient depends on its size, not just its profile.**
AMCA Fig. 5.3 is **five separate curves**, not one — implied C spans roughly **0.18 to 0.70 for SP**
and **0.30 to 1.04 for NP**, falling as the opening grows, because frame and blade edges block a much
larger fraction of a small opening. The inherited single value of 0.45 tracks the 48×12 curve, so on
the default 36×24 selection it overstated pressure drop by about **2×** and understated the exported
K by about 30%. Corrected: **ΔP 0.0125 → 0.0067 in. w.g., K 35,822 → 49,051.** The tool now carries
per-size values for all three profiles and resolves to the tested size nearest your opening.

**Three more things the source data says that a calculator can quietly get wrong:**

- **TAMCO's WP number is not the damper.** The WP table is a plenum test. The column a coefficient
  derives from is dominated by the opening's own entry loss, and TAMCO's own "Damper Only" column is
  **negative in all thirty published rows** — the air-foil blades cost less than the bare hole. The
  readout is labeled damper + plenum opening.
- **Leakage is a closed-damper property**, so it is evaluated at the system design static pressure
  (a new input, defaulting to the 1 in. w.g. AMCA rating basis), not at the damper's own open
  pressure drop. The maths is derived rather than fitted: every AMCA class is exactly `base × √ΔP`
  cfm/ft², reproducing all **thirteen** published numeric cells (class 1A is rated at 1 in. w.g.
  only, so its other three read n/a).
- **Air density scales the exported K, not just the displayed ΔP.** At 200 °F reactivation air it
  moves the PLC constant by 11.6%. It is now an editable assumption and the emitted structured text
  says when it is non-standard.

**Two bugs carried over from the source calculator were fixed** — the coefficient above, and the
maximum **section** size, which is 25 ft² **and** (60″w × 60″h **or** 48″w × 75″h). The original
checked `w > 60 || h > 75`, so a 60 × 70 passed when TAMCO does not allow it.

The Measure side refuses to hand over a constant it cannot stand behind. Calibration points are
**stamped with the geometry and blade angle** they were measured at, so moving the blades retires the
fitted K instead of silently relabelling it. The fit is judged on **worst-point error, not R²** —
for a fit forced through the origin a centered R² does not decompose, and a tap with a constant offset
scores R² 0.985 while being 12% out. A shut damper exports no constant at all rather than a
plausible-looking `K_FLOW := 0.0`.

Everything the model does not take from TAMCO is exposed in an **Assumptions** panel and tagged
*Measured*, *Chart-read*, or *Modelled*. The coefficient fields are overrides rather than values:
blank resolves to the size-matched number and shows it as the placeholder. Nothing in the UI calls
SP or NP "certified" — those were read off a chart by eye, and the tool says so on the pill, the
chart legend, the angle hint and the exported summary. **Copy review summary** dumps the whole state
with its provenance tags as plain text. That panel is the deliverable as much as the model is: this
was built to be argued with by people who know dampers better than the model does.

Verified in headed Playwright runs — the size-resolved coefficient at all five tested sizes, drawn
free area 0.8999 against 0.9000 modeled, keyboard entry into the calibration table, the tap-offset
case, stamp invalidation, the crossover solve, density scaling of both ΔP and K, and a NaN sweep from
3×3 to 200×200. The tool was then put through a ten-agent adversarial audit against the source PDFs,
which confirmed all 30 WP values, the leakage identity, every geometry constant and the core algebra
— and caught the size-dependence error. No new perm, route or migration; `/tools/*` already gates it
to signed-in staff. The `New` chip moves off the Desiccant HMI onto this.

## 2026-08-07 — c.pCO widget headings render at their intended weight again

The three headings in the Control Panel Crash Course widgets — "Put the unit on BACnet", "The unit's
BACnet point list", "Break the unit" — were rendering at body size and normal weight instead of
15px/500, so each read as another paragraph rather than as the title of its widget.

Not a typo: `.learn-prose-interactive h2, h3` in `globals.css` sets `font-size`, `font-weight` and
`letter-spacing` to `inherit`, and at specificity (0,1,1) that **beats any Tailwind utility** (0,1,0)
placed on the heading. The classes were there and doing nothing. Measured in the browser before the
fix: `15.5px / 400`. After: `15px / 500`.

The reset is correct and stays — it is what stops prose styling leaking into widget chrome — so the
fix is local, the same one applied to the HVAC/R widgets earlier today: the `<h3>` keeps the
semantics and an inner `<span>` carries the type. Colour was never affected, only those three
properties.

Worth knowing generally: a Tailwind utility on an element that a descendant selector also targets
loses, silently, and `tsc` cannot see it. This is the second bug in one day whose only symptom was
visual and whose only detection was opening the page.

## 2026-08-07 — Refrigeration & HVAC/R: a 17-subject technician course, rebuilt on our own rails

Training gains its largest course by a wide margin: **17 subjects, 155 lessons, 170 quiz questions**
covering refrigeration theory, components, electrical, psychrometrics, installation, troubleshooting
and EPA 608. It arrived as a single self-contained HTML file and has been rebuilt as real portal
content — same lesson reader, same progress and XP, same quiz engine, same Quiet Precision surface.

**The interactive parts came across as components, not as an iframe.** Twenty-four of them: six
WebGL models on react-three-fiber (the vapor-compression cycle, reciprocating and scroll
compressors, a TXV that responds to a superheat slider, phase-change particles, refrigerant
molecules, and one air-coil model that serves both the condenser and evaporator subjects with a
fault toggle), five click-to-explore diagrams, six calculators, and six practice drills including
three branching service calls where the plausible wrong turn is the point.

Three decisions worth recording:

- **The quizzes use the existing engine, so the answer key never reaches the browser.** The source
  revealed the correct answer on a failed attempt; ours does not, because these scores feed the
  compliance report. The ungraded practice drills *do* explain themselves on a wrong answer — that is
  the whole value of a rehearsal — and they deliberately write nothing to anyone's record.
- **The final exam is a category capstone and gates nothing.** 34 cumulative questions, two per
  subject. Each subject still completes on its own lessons plus its own knowledge check; the exam is
  what the certificate waits for. Eligibility is decided server-side by the *same*
  `subjectIsComplete()` the library and the compliance report use, so a certificate can never
  congratulate someone the report lists as overdue.
- **The course is generated, not hand-written.** `scripts/gen-hvacr-course.mjs` turns the source data
  into both migrations, and asserts every marker it writes exists in `lib/learn-blocks.ts` — the
  catalog that also *types* the widget registry. A block named in the seed but not wired up is now
  a compile error rather than a lesson that quietly renders "isn't available".

Two bugs caught in browser verification that no type-check could see. `next/dynamic` requires a
literal options object at the call site: hoisting the shared `{ ssr: false }` into a const and
spreading it passes `tsc` and then 500s **every lesson page** at request time — the comment above
those imports says not to DRY them up. And the psychrometric chart stacked its 80% and 100% labels
at the right-hand edge, where they overprinted into "8100%", because both curves leave the top of
the plot long before 100°F; each label now sits at the end of its own curve.

Course data verified against production: 155 lessons, 53 carrying 55 markers across all 24 widgets,
170 questions, and **every question with exactly one correct option** — the condition the publish
gate requires. `scripts/verify-hvacr-certificate.mjs` re-runs all of it.

## 2026-08-07 — SOO: withheld clauses now print, and "incomplete" has one definition

A second real test — the Ferrara unit, extracted rather than hand-entered — printed a draft with
**no Shutdown Sequence, no Remote/BAS Interface section, and no clause starting the desiccant wheel
or the react fan.** Twelve clauses in total, every one of them correctly withheld: the submittal
never states the BAS protocol, the wheel drive, or either plenum pressure transmitter, extraction
rightly refused to guess, and the assembler blocked everything depending on them. The print view
then dropped the evidence.

This is the same leak as the gas-unit case, one commit later and one list over. `uncovered`,
`blocked` and `unsetSetpoints` all mean "something is missing from this document", and they were
rendered in three separate places — the print view got the `uncovered` banner and not the `blocked`
one. Fixing the symptom again would have left the shape that caused it.

`documentGaps()` is now the single definition of *incomplete*, and the editor, the print view and
the approval gate all read it, so a gap kind cannot be added to one surface and forgotten on
another. On the page it replaces the DRAFT banner rather than sitting under it — "draft"
understates a document with whole sections absent — and it says plainly that those clauses are
**absent, not inapplicable**, since they are deliberately not in the "not applicable" list either.
Gaps are grouped by the fact they need, so twelve withheld clauses read as the four questions that
actually have to be answered.

Also: the receipt no longer leaks `{{placeholder}}` syntax from an unresolved clause into a
customer-facing document. Twelve new checks pin all of it, including "every blocked clause surfaces
as a gap" and "withheld clauses are never in the not-applicable list".

## 2026-08-07 — SOO Phase 2: the portal reads the submittal

Upload the DryWare Sales Submittal PDF on `/admin/soo/[id]` and the portal proposes the unit's
configuration. Verified against the real 45-page Ferrara document: **34 of 34 target facts
extracted, zero unrecognised Schedule lines** (`scripts/verify-soo-extract.mjs`, 76 checks). The
extract route **writes no facts** — it returns a proposal a human confirms, so re-running it is free
and changes nothing.

**Two readers, deliberately.** Deterministic parsers do most of the work; a model call is a
*redundant second reader* over the same pages. Not belt-and-braces: with one source a wrong fact is
indistinguishable from a right one and the reviewer has only a page citation, whereas with two the
review table can mark a fact "Schedule + model number agree" (skim) versus "only the second reader
saw this" (read it) — and that triage is what makes a fifty-row table get reviewed instead of
rubber-stamped. It also turns parser breakage into visible conflicts rather than silent nulls. The
model never overrides a parser; it can only add or disagree.

**The document fought back in three specific ways, all now handled.** The Schedule is `Label Value`
with no delimiter ("Desiccant Wheel Size 965 X 200"), so the parser matches *known label prefixes*
rather than guessing where the label ends — an unrecognised line becomes a visible `unmapped` entry
instead of a plausible mis-split. The two-column spec pages put several bullets on one text line, so
bullets split on the glyph, not newlines. And ours-vs-theirs is decided by the **IAT footer**, not
keywords: matching "New York Blower" to spot vendor literature also matches our own Process Fan
page, which names the manufacturer in its spec list.

**The 13-page guide spec is dropped in code, not by prompting.** It is generic boilerplate
("provide freezestat set at 35°F") written for a hypothetical unit — plausible,
authoritative-sounding, on-topic and wrong, which makes it the worst extraction hazard in the
document. Deleting the pages is verifiable; asking a model to ignore thirteen pages of them is not.
The flow diagrams are images (37 words each), so no fact may come from them either.

**Refusing to guess is a feature.** The submittal says "BACnet" without saying MS/TP or IP, so the
protocol is left unset and reported for a human — a coin flip printed as fact in a controls contract
is worse than a blank. Same for the plenum pressure transmitters and wheel drive, which the
submittal never mentions: they stay unknown, their clauses block, and a person fills them in. A
mutation test corrupts the model number and proves the cross-check actually fires.

The review table is ordered by **blast radius**, never document order: conflicts first, then gating
facts each annotated "N on · M off", then identity, design conditions, and unrecognised lines. Every
human edit records `method: 'human'`, which outranks every reader and settles that fact's conflict.
Extraction uses structured outputs (`claude-opus-5` + a schema), so "was it valid JSON" stops being
a failure mode; `stop_reason` is checked before the output is read, and a refused or truncated read
discards the second reader rather than silently reporting a unit with fewer options than it has.

## 2026-08-07 — SOO: three holes found by the first real test unit

A hand-built test configuration (gas reactivation, DX pre-cooling, no rotor rotation alarm package)
produced a document that looked complete and was not. Everything below is now a permanent
regression case in `scripts/verify-soo.mjs`, alongside the Ferrara unit.

**The incomplete-document warning was computed and then not printed.** `uncovered` correctly said
"no reactivation heat sequence for Gas" and showed it in the editor, but the print view never
rendered it — so the PDF read as finished while missing its most important section, and still
referred to a Reactivation Heat Enabled pilot light. A safety net that stops at the screen is not
one. It now prints above the sequence, in red, on any draft with a gap.

**Coverage could be satisfied by a one-line sensor entry.** The rule asked "did any clause testing
this fact survive?", and on a DX unit the "Pre-Cooling Leaving Air Temperature (Type J
thermocouple)" line was enough to make the entire missing pre-cooling *sequence* read as covered.
A sensor is not a sequence, so `CoverageRule.covered` now names the clause that IS one. Keys
pointing at clauses that do not exist yet (`react_heat_gas`, `pre_cooling_dx`,
`post_heating_electric`) are the declared gaps — a to-do list of what the master document still
owes us. Coverage now also watches both cooling media, the heating medium and the wheel drive.

**Nothing at all caught the desiccant wheel never starting.** Both wheel-start clauses required the
rotor rotation alarm package, conflating how the wheel starts with how its rotation is proven, so a
unit without that option lost both and the sequence went straight from "Desiccant Wheel –
contingent upon:" to the react fan. Starting and proving are now separate clauses.

Freeze-protection Stage 2 is restructured from one long sentence into a lead-in plus one
conditional action per bullet. It previously instructed the reader to open a pre-cooling valve and
close a return-air damper whether or not the unit had them — inside the safety sequence. The
dampers now gate themselves, which also deletes the OA-only / OA+RA variant pairs. Same for the
shutdown valve list. The Ferrara fidelity diff moves 102/110 → 100/110, the two new differences
being exactly these splits.

The excluded/blocked receipts also stop printing internal clause keys
(`run_oa_damper_modulating`) into a customer-facing document — `clauseSummary()` uses the clause's
heading, or its own first sentence.

## 2026-08-07 — Sequence of Operation builder (Phase 1: clause library + deterministic assembly)

New `/admin/soo` (Sales rail → **Sequences**; perm `soo`, seeded for sales + engineering by
migration 084). Enter a unit's configuration and the portal assembles the project Sequence of
Operation from a master clause library — the controls narrative that goes to the controls
contractor. **Assembly is deterministic: no AI selects clauses or writes setpoints.** The master
SOO (decomposed from the Trane Florida / Ferrara Orangeburg document into ~100 clauses in
`lib/soo-master.ts`) carries a `requires` predicate per clause, so every "(where provided)" hedge
in the old Word master became a condition and the generated document states things outright.

The safety property throughout: **nothing disappears silently.** An unknown fact *blocks* its
clauses (listed, and approval refuses) rather than dropping them; a non-matching fact *excludes*
with a printed reason ("Not applicable to this unit" renders on the document); a configuration the
library has no content for (e.g. gas reactivation — only steam is authored) is a loud blocker, not
a quietly thinner document. Control constants (120°F react permissive, 40°F/35°F freeze stages,
300°F ceiling) live in a registry with rationales — editing a clause that carries one requires a
written note, enforced server-side at approval. `draft → in_review → approved` mirrors proposals,
but approval is engineering-or-admin rather than admin-only: signing a control narrative is an
engineering judgement. The library is DB-editable with append-only versioning
(`soo_library_versions`); approving pins the version, so an approved document re-renders exactly
as signed even after the master moves on.

Verified by `scripts/verify-soo.mjs` — 66 checks including mutation tests — and by diffing the
generated Ferrara document against the real .docx: 102/110 paragraphs exact, the 8 differences all
being hedges resolving to definite statements. Print view at `/print/soo/[id]` with a DRAFT banner
until approved. Phase 2 (extracting the facts from the DryWare submittal PDF) is next; the
Ferrara fact set in the verify script is its ground truth. Docs: `docs/soo.md`.

## 2026-08-06 — Internal Apps: Desiccant Dehumidification HMI (live process-flow diagram)

A new self-contained tool at `/tools/desiccant-wheel-hmi.html`, surfaced in the **Internal Apps**
launcher (`TOOL_APPS` in `lib/tools.ts`, wearing the `New` chip; moved off the Washdown calculator).
It's a clickable HMI of a desiccant unit (model IAT-3000RE-IDP-6000, 6,000 CFM): both airstreams —
process left-to-right, reactivation counter-flow right-to-left — routed through filters, pre-cool
coil, the shared desiccant wheel, bypass damper, electric reactivation heater, and supply/exhaust
fans. Click any component for live readings, its control signal, and setpoint sliders; toggle
power per-component or Start/Stop all; the header stats (supply/exhaust CFM, moisture removed,
power draw) and a high-limit alarm respond in real time, and animated ducts show active flow.

Rebuilt from an external prototype into **Quiet Precision**: warm canvas, white hairline cards, no
resting shadows, Inter + JetBrains Mono, brand green reserved for the active/primary/focus states,
Tone pills for status, `tabular-nums` on every figure. **Two deliberate divergences from the
light-only static-tool convention**, because this is a live display and not a print/PDF surface:
it keeps a **light/dark toggle** (full surface-ladder dark mode per DESIGN.md), and the schematic
artboard keeps two functional flow hues (process / reactivation) the way the Application Diagram
Studio artboard does — those encode airflow direction, not decoration. Equipment-icon fills are
CSS-token-driven so they retheme live on toggle. No new permission or migration — the existing
`/tools/*` middleware gates it to signed-in staff.

## 2026-08-06 — Sidebar nav is now an accordion (one group open at a time)

Expanding a rail group used to leave others open, so the list could get long. The nav is now an
accordion: opening a group retracts whichever was open, and navigating opens only the active page's
group. The single-open cap lives in all three places that set `open` — the toggle, the localStorage
restore, and the navigation effect — and the footer's Self-service group shares the same rule.

## 2026-08-06 — Training nav un-parked

The Training group in the admin rail goes live (it was parked — grayed with a "Soon" chip — since
the `/learn` port), together with its four ⌘K palette entries. **No permission work was needed for
sales**: learner pages (`/admin/learn/*`) are in `OPEN_ADMIN_PREFIXES` and deliberately carry no
perm, so every staff role — sales included — has Browse / My Learning / Leaderboard the moment the
rail shows them. The Permissions matrix governs only authoring (`learn_admin`, non-delegatable,
admin-only by design). Marketing stays parked.

## 2026-08-06 — Learn: Control Panel Crash Course — a working c.pCO simulator (migrations 081+082)

Sales asked for panel training that isn't a digital textbook. The centerpiece is a **faithful
simulator of the pGD terminal** (`lib/cpco/`): a 22×8 character-grid LCD in the panel's real
colors, the six buttons, and the editing grammar taken keystroke-for-keystroke from IAT's own
"How to setup the BACnet instance" procedure — Enter walks the cursor field to field and digit by
digit, Up/Down edit under it, a protocol change forces the reboot prompt, and Alarm+Enter held
three seconds drops into the CAREL system menu. Trainees are **graded on doing the task** (set the
protocol, take the reboot, key in device instance 2749001), never on multiple choice. Five graded
scenarios ship; keystroke counts are feedback, not a gate.

**Both menu trees are data, not code** (`lib/cpco/trees/`). A screen captured off a real panel
becomes a record with no code change — which is the plan for the pending screen-capture pass and
SOO. Entries the source procedure proves exist but never shows are carried as `—` so the pager
counts stay honest; nothing is invented. `scripts/verify-cpco.mjs` (38 checks) asserts the literal
screen text of the whole documented walk against strings typed from the PDF — if a tree drifts
from the panel, it goes red.

**Lessons can now embed interactive exercises.** A `data-interactive` marker in a lesson body
splits into HTML runs and real components (`lib/learn-interactive.ts` + a registry behind the
client boundary). A body with no marker returns the **byte-identical** single-injection path, so
the 357 existing lessons render exactly as before (`scripts/verify-learn-interactive.mjs`). The
`InteractiveBlock` TipTap node keeps markers alive through editor open/save — round-tripped
against the live @tiptap versions including 47 real `img-missing` seed bodies, per the PR #35
method (old-output vs new-output, never input vs output).

**Grading rides the existing rails.** `learn_sim_attempts` (081) keeps one row per user+scenario,
best run kept, `passed` sticky — mirroring quiz attempts. `POST /api/learn/sim-attempt` is
session-scoped exactly like `/api/learn/progress`, and a passed scenario completes its lesson
through that same progress route, so XP, streaks, badges and the assignments compliance report
needed zero changes.

**082 seeds the course**: 10 published lessons under Technical Training — driving the pGD, two
read-a-value tasks, the BACnet setup, the point explorer (all 38 objects; only 6 writable; the
unitless-export caveat), the fault-injection alarm lab (panel and BACnet Summary Alarm reacting
together), remote access (web pGD / tERA / BAS), and two service tasks (pLAN address, static IP).
Facts trace to the CAREL manual, IAT's BACnet procedure, and the point-list export. Three
**defects found in that export** are surfaced in the explorer rather than hidden (instances 25/26
labeled "Pre" instead of "Post"; 14/15 descriptions swapped) — flagged to engineering.

The LCD's hex colors are a deliberate token-system exception (a physical part, not a themed
surface) — documented in the one `globals.css` block the design grep excludes. Also live at
`/admin/tools/panel` as an untracked workbench behind the `tools` perm; the tracked course is the
front door, so the workbench is deliberately not in the launchers.

Not yet in the course (blocked on the SOO + captures): the unit schematic with real sensor
positions, setpoint behavior, the full IAT menu tree, and the capstone quiz.

## 2026-08-05 — Proposals: a sizing selection becomes a submittal-ready PDF (migration 079)

`/admin/proposals` turns a Deal plus a Sizing Studio selection into a branded proposal PDF that a
human approves before it goes anywhere. Perm `proposals`, seeded for sales. **Draft, human sends** —
nothing is emailed; the portal produces a file.

**Claude is never shown a number.** It writes only the cover letter and the scope of work, from a
FACTS object carrying qualitative descriptors alone — "a high-capacity desiccant wheel", "electric
reactivation" — never a figure. Every number on the document is templated directly from the frozen
sizing snapshot, and the PDF generator never reads the prose.

That inversion is what makes the guard sound. The case-study tool lets the model write figures and
checks them afterwards, and that check has real holes: a decimal splits into two runs that both
pass, single digits are permanently whitelisted by `unit: 1..N` in the corpus, a model number
donates its digits so a fabricated `$5000` passes next to `IAT-5000`, and it only runs at generate
time so anything a human types in later is never checked. Here the rule is simply **any digit
Claude writes is a flag**, cleared by a human before approval, re-derived on every save. The
allowlist is the model number and the customer names, matched as whole tokens — so `IAT-3000RE-2000`
passes while a bare `$3000` still flags. The one remaining hole, a number spelled as a word, is
asserted in the test suite *as a known hole* so it cannot be mistaken for coverage.

**A watermarked draft PDF can be produced at any stage; approval lifts the watermark.** Blocking
the PDF outright would just be routed around with screenshots — the `DRAFT — NOT FOR DISTRIBUTION`
stamp is the control that travels with the document. Approval needs the **admin** role and is not
delegatable through the perm matrix. Reopening an approved proposal deletes its archived PDF.

**The Sizing Studio persists nothing**, so creating a proposal is the moment a selection first
becomes durable. Both the inputs and the computed result are frozen: the inputs alone would replay
the run today, but the engine is changing and the catalog is fetched live, and an approved proposal
has to render the same numbers in a year. An unverified proposal is marked preliminary on the page
*and* on the PDF — and, given the planning coefficients measured conservative, is likely to name a
larger unit than the job needs.

**Nothing customer-facing originates in a request body.** The client may post sizing *inputs*; it
may never post a result or a verification. The selection is recomputed server-side against the live
catalog, and `verification` is only ever written by the server calling DryWare itself.

Entry points: the list, a **Proposals** tab on the deal drawer, and **Start a proposal** on a
Sizing Studio run. The customer name is snapshotted rather than read live, because `deals.customer`
is DryWare-owned and rewritten on every sync.

`lib/proposal-pdf.ts` is new: letter, running header, hand-rolled column tables, page x-of-y.
`lib/pdf.ts` was not a usable base (A4, no tables, no running header, no logo); the precedent is
`public/tools/washdown-load-calculator.html`. Only an approved PDF is archived, to the private
`proposal-docs` bucket via the signed-upload idiom.

`scripts/verify-proposals.mjs` — 54 checks. It masks the allowlist out of the FACTS object and
asserts no digit remains, reproduces each case-study checker hole as a test that this checker does
not share it, and **actually renders the PDF**: the draft must be measurably larger than the
approved copy, long prose must paginate, and a proposal with no selection must still produce a
document.

## 2026-08-05 — Compensation Review: the annual merit-increase sheet, in the portal

The **Sample Annual Review Spreadsheet** — the workbook the annual review has run on from a
desktop copy — is now `/admin/comp-review` (migration `078`). It reads as a list of people, not a
grid of cells: one row each, edited in a record panel rather than in the table, because you review
a person, not a row of columns.

Every formula was ported 1:1 and is verified against the workbook by
`scripts/verify-comp-review.mjs` (57 assertions). See [docs/comp-review.md](docs/comp-review.md).

- **Four editable fields** per person — per hour, gross annual, bonus, score. Neither pay field is
  required: employees are hourly *or* salaried, and forcing a fake hourly rate onto salaried staff
  would corrupt the payroll total. Salaried people get the same percentage applied straight to
  their annual figure.
- **The record panel shows its work.** `$25.00 × 8.54% = $2.14`, `$25.00 + $2.14 = $27.14`, and so
  on down the chain — the thing a spreadsheet could compute but never explain.
- **The raise divisor is now live.** The workbook divided every score by a hardcoded `3.5` (its own
  header reads "% of Avg score **()**", parentheses left empty) with a one-row override at `N7`.
  It is now the mean of the scores actually recorded. Because that denominator is the mean of the
  column it divides, **any consistent scale works** — 1–5, 1–10 or 0–100 all behave identically.
- **Finalizing freezes the year.** While a cycle is a draft, scoring one person moves everyone
  else's raise; the panel previews that shift and says who it affects. Finalizing snapshots the
  average so a signed-off year stops moving, enforced by a DB CHECK and computed server-side only.
- **The budget total is right now.** `I40 =SUM(I3:I17)` had been totalling 15 of the 34 people on
  the sheet.

⚠️ **Three workbook quirks were reviewed and deliberately KEPT**, so the portal reproduces the
numbers the spreadsheet produces today. Read the docs before "fixing" any of them:

1. `H = C*(G/48)` divides by **48, not 100** — every raise is ~2.08× what the pool figure implies
   (an average performer receives **8.54%**, not 4.1%).
2. `G = N*O` applies the relative score **twice**, squaring the spread between scorers.
3. The pool multiplier is `4.1` while its own column header says `3.4%`; the cited benchmarks
   average ~3.46%.

All three are now cycle **columns**, not literals, so revisiting them is a row update rather than a
deploy — and a past cycle always recomputes with its own constants.

🔒 **Admin and HR only**, behind a new `compensation` permission. The `ADMIN_PATH_PERMS` entry is
load-bearing: an unmapped `/admin/*` path falls back to `dashboard`, which five scoped roles hold,
so omitting it would have opened payroll to all of them rather than failing closed. Tables are
RLS-on with no policies; cycle constants and finalize are admin-only even for HR; every line edit
is audited with before → after values.

## 2026-08-05 — Sizing Studio: verify a selection against DryWare's real wheel model

The Studio's wheel performance has always been a planning approximation — 80% moisture removal for
a standard wheel, 90% for high-capacity — because DryWare's product API gives geometry but not
performance curves. It turns out DryWare exposes the curves after all, through the engine behind
its own wheel calculator. **Verify with DryWare** (now the primary action on the page) runs the
current selection through that engine and returns real numbers.

- **New: pressure drop.** Process and reactivation, in. w.g. The Studio had no way to compute this
  at all.
- **New: a genuinely optimised RPH.** The local engine only ever reported a mid-range placeholder
  and said so.
- The verified leaving condition sits **next to** the Studio's estimate rather than replacing it,
  with the delta called out — the gap is the useful part. The selection card flips from
  **Preliminary** to **Verified**, and the copied summary changes with it, because that text goes
  out to customers.
- When the two disagree about whether the target is met, the page says so explicitly in both
  directions.

⚠️ **The planning coefficients were materially conservative.** On the default 2,000 CFM case the
local engine predicts 15.56 gr/lb leaving; DryWare returns **7.58**. The Studio has therefore been
**over-sizing** — and may have recommended a high-capacity wheel (a real cost adder) on jobs a
standard wheel would meet, or flagged a reachable target as unreachable. Verify before quoting.

Implementation notes, all of which are load-bearing:

- **Every failure from that endpoint is HTTP 200**, including a zero-byte body and the DTO echoed
  back with `passwordOk:false`. A `res.ok` check would report success on total failure — same class
  as the middleware-swallows-`/api` trap. `readDesmodResponse()` in `lib/desmod.ts` is the single
  place that decides whether a calculation actually happened.
- **The upstream is single-threaded**, ~1.9 s per call, strictly serialised. Hence one call per
  click (never as-you-type, never a catalog sweep), a per-user rate limit, and a deterministic
  cache. `predictLeavingState()` was deliberately **not** replaced — the local engine has to stay
  instant.
- **It validates nothing** upstream, so the portal owns the sanity envelope.
- The client posts **inputs only**; the selection is recomputed server-side, so a forged unit or
  airflow can't come back looking authoritative.
- **No local fallback exists for the physics.** If DryWare locks the endpoint down, verification
  fails and the page reverts to the preliminary estimate. It stays an internal `/admin` action for
  that reason.

**Fixed along the way: the rotor depth was a constant, not the real one.**
`selection.wheelDepthMm` returned `WHEEL_SPECS[wheel].depthMm` — a flat 200 mm standard / 400 mm
HC — discarding the catalog row's own depth. Most of the line genuinely is 200 mm, but
**IAT-75REC and IAT-150REC ship a 100 mm rotor**. That mislabelled both compacts on screen
(`320 × 200 mm rotor` for a 100 mm machine), and it would have fed DryWare a rotor IAT does not
build: a 100 CFM job verified ~2 gr/lb drier than the unit can reach, at double the true pressure
drop and half the correct commissioning RPH — under a green **Verified** pill. It now reads the
catalog row, and HC doubles that depth (200→400 mainline, 100→200 compacts).

`scripts/verify-desmod.mjs` (69 checks) pins the live response for a known payload so upstream
drift fails loudly, and mutation-tests the response guard by corrupting a known-good payload seven
ways and asserting each is rejected. Rotor depths are asserted as **literals per size** — the
original check compared the payload against the field it was copied from, which is tautological and
could never have caught the bug above. No migration, no schema change, no writes.

## 2026-08-05 — Condense the admin rail: fewer People / Operations items

Trimming nav clutter without dropping any capability:

- **Operations** loses the standalone **Support form** item. It pointed at `/admin/support-content`,
  which the **Forms** tab already lists as **Equipment Support** in its Specialized-forms card — a
  duplicate. Route stays live.
- **People › Org Chart** is no longer its own rail entry; it's an **Org Chart** link in the header of
  the **Employees** page (perm-gated on `org_chart`). Route stays live.
- **People › PTO** and **Sick Time** merge into one **Time Off** item → `/admin/requests`. That queue
  already loads both types; it now has an **All / PTO / Sick** filter so the reviewer picks one of the
  two on the page, and the stat strip + status counts follow the selection. The rail badge is the
  combined pto + sick pending count. The `/admin/requests/pto|sick` routes still work by URL (they
  stay pre-scoped, no toggle).

The ⌘K palette's separate PTO / Sick entries collapse into one **Time Off Requests** (keywords cover
both terms).

## 2026-08-05 — Washdown Load Calculator, and Internal Apps becomes the one home for tools

Two things, both about **Operations → Internal Apps**.

**The Washdown Moisture Load Calculator** (`/tools/washdown-load-calculator.html`) is a 1:1 port
of the *IAT Washdown Load Calculator* workbook into a portal app. It estimates the moisture a
daily washdown adds to a space, in grains/hr — the number that feeds desiccant unit selection.

The premise that makes it right: **the load is not the water you spray**, most of which drains
away. It is only the water that *evaporates* into the room air. The tool estimates that two
ways and rolls each into the total space load. **Method 1 (residual film)** takes the thin film
left clinging after drainage, converts it to pounds over the wetted area, and averages it across
the drydown — the **recovery basis**. **Method 2 (Carrier)** gives the instantaneous peak while
surfaces are fully wet, driven by warm water, airflow and dry target air — the **hold-RH basis**.

**The caveat is built into the page, not buried in a note.** The peak only lasts until the film
is gone. With the workbook's own defaults that is **13 minutes**, and the peak basis is **9.1×**
the recovery basis — sizing on the raw peak would badly oversize the unit. Under 30 minutes the
page raises an amber callout saying exactly that, and the recommendation line defaults to the
recovery basis unless a brief RH excursion is unacceptable for the product. The same caveat
prints on the PDF.

Film thickness is the single biggest driver, so it gets preset chips (0.003″ squeegeed →
0.020″ poorly drained) and the page says plainly that drainage and squeegee practice shrink the
load more than any unit upsize. That is a sales lever, not a footnote.

Water colder than the room's vapor pressure now reads *"No evaporation"* instead of a negative
load; blank or zero inputs render `—`, never `NaN`. All twelve outputs were checked against the
values the xlsx has cached in its own cells and match to floating-point exactness — the density,
grains, gallons, latent-heat and Magnus constants are the workbook's, so **don't change one
without the other**; sales quotes off both. **Download PDF** produces a one-page submittal sheet.

**Sizing Studio and Application Diagrams moved onto the Internal Apps page**, out of the
sidebar's Sales group. Every internal tool now has one home rather than being scattered across
nav groups, joining Presentations (which already sat there). Only the rail entry moved — routes,
perms and middleware gating are untouched, so bookmarks still work and `ADMIN_PATH_PERMS` still
enforces `sizing` / `diagrams`. Each is listed on the page under **its own** perm, so a `tools`
holder without `sizing` doesn't get a dead link. Since neither has a rail entry any more, both
were added to the ⌘K palette on those same perms — that's now their keyboard shortcut.

New doc: [docs/internal-apps.md](docs/internal-apps.md).

## 2026-08-05 — SharePoint → Jerry's Brain goes live (pull half, human-gated)

The read-only SharePoint pull has been sitting inert since 2026-07-21, waiting on IT's Entra app
registration. The credentials landed, the smoke test returned the real library (**IAT Documentation
/ Documents**), and this ships the half that was never built: **the human gate**.

A document added to the SharePoint library can now be pulled into Jerry's Brain, where it waits in a
**"From SharePoint"** review queue until an admin approves it. It uses the *same* transcribe-and-scrub
engine and the *same* review card as a manual upload — competitor names struck through, PII flagged,
Staff-only vs Customer-facing chosen per document. **Nothing auto-publishes.**

**The bug this closes before it could happen.** `/api/admin/kb/ingest` never set `kb_documents.source`
or `sharepoint_item_id`, and the pull's anti-duplicate check asks `kb_documents` which SharePoint items
are already published. Approving a pulled document through the old path would have re-queued that same
document on **every subsequent pull, forever**. Approval now goes through
`/api/admin/kb/queue/{id}/approve`, which stamps the source and item id. Rejection marks the row
`rejected` rather than deleting it, for the same reason — the delta will offer that file again, and a
rejected row is a durable "a human said no". The approve route reads the transcript from the **queue
row**, never the request body: the browser was shown a scrub preview of a specific document, so that is
what must be stored.

**It pulls on a button, not a timer.** `vercel.json` already holds two cron jobs and `admin-digest`
documents a 2-cron account cap, so a third would not register; `CRON_SECRET` is also unset, and setting
it would silently reactivate the two dormant jobs (including `accrue-pto` and its known accrual bug).
So Phase 1 pulls on demand via an admin-gated **Pull now** button — which also lets the ~80-PDF first
backlog be drained deliberately, a batch at a time, instead of dumping 80 review cards and 80 AI
transcriptions at once. The cron route remains, unscheduled, sharing one engine for when scheduling is
decided.

**Read-only, and separate from SSO.** The Graph app holds `Sites.Selected` with **read** on one site —
not tenant-wide, not write — and is a *different* Entra app from the staff "Sign in with Microsoft"
login (whose credentials live in Supabase, not Vercel). The Push half (Jerry → SharePoint) stays
deliberately unbuilt; that is what keeps the credential read-only.

**Known limitation:** PDFs and images only — `.docx`/`.xlsx`/`.pptx` are skipped in v1 (80 of the
library's 95 files are PDFs). The pull counts what it skipped, so "nothing appeared" is explainable.

Also pinned `SHAREPOINT_SITE_ID`/`SHAREPOINT_DRIVE_ID`, so a future SharePoint rename or URL change
needs no changes on our side. Extracted `lib/kb-sharepoint-sync.ts` and `lib/kb-ingest.ts` so the
button and the cron — and the upload and queue approvals — are one implementation, not copies.

## 2026-08-05 — TipTap 3.29.2, with the 133 lesson placeholders re-verified first

Dependabot's minor-and-patch group (PR #35, 20 packages) carried `@tiptap/*` from 3.27.3 to
3.29.2. Normally a group bump like this merges on a green build, but yesterday's lesson-editor
work made TipTap a load-bearing dependency in a way it wasn't before: `ImagePlaceholder.tsx` is a
custom node whose whole job is to re-serialize `<figure class="img-missing">` **byte for byte**,
and 133 of the 357 lessons depend on it. A serialization regression wouldn't throw or fail a
build — it would quietly flatten a placeholder to a bare `<p>` the next time someone opened one of
those lessons and pressed Save.

So the bump was checked before merging, not after: the real `ImagePlaceholder.tsx` bundled into a
jsdom harness, the extension list mirrored from `LessonEditor.tsx`, and all 133 production rows
round-tripped through both the old and the new tree. **Result: 0 differences.** Not merely
"markers survived" — 3.29.2 emits output byte-identical to 3.27.3 for every one of the 133 rows.
Also confirmed StarterKit v3.29 still bundles Link, so configuring it through
`StarterKit.configure({ link: … })` still applies and the duplicate-name warning stays gone, and
that all three TipTap-consuming components type-check against 3.29.2's declarations.

Worth recording for the next bump, because the obvious version of this check lies: a round trip is
**already** lossy at the byte level on 124 of the 133 rows even on a known-good build, because
ProseMirror wraps `<li>text` as `<li><p>text` and strips the whitespace between block tags. Both
preserve content — nothing is dropped, the visible words are identical — but comparing input to
output makes a safe bump look catastrophic. The comparison that means anything is old version
against new version. `docs/learn.md` now carries the full recipe.

**Found while in here, not fixed:** `components/shared/RichTextEditor.tsx` (ticket notes) still
registers bare `StarterKit` *plus* a separate `TiptapLink` — the exact duplicate-`link` pattern
removed from the lesson editor yesterday. It warns at both 3.27.3 and 3.29.2, so it is live now,
and which config wins is undefined, meaning `openOnClick: false` may not be applying there.

## 2026-08-04 — Image upload in the lesson editor (and the placeholder trap it uncovered)

The Learn lesson editor could only insert an image by **typing a URL into a `window.prompt`**,
which is why `docs/learn.md` listed content backfill as "blocked on image upload existing first".
Authors can now get an image in three ways — the toolbar button, **drag-and-drop**, and
**pasting a screenshot** — and each one uploads the file to Storage. External URLs are no longer
insertable: every image in a lesson is now one we host.

Bytes go **straight from the browser to Supabase Storage** via a one-shot signed URL from
`/api/upload` (the same path every form file field already uses), because Vercel's ~4.5MB
function body limit is well under a phone photo or a full-window screenshot. JPG/PNG/GIF/WebP,
10MB — the cap is the `form-uploads` bucket's own `file_size_limit`, so it holds whatever the
browser claims. SVG is refused by name (an active-content type we deliberately don't store) and
so is HEIC, both with a message that says what to do instead. Save is disabled mid-upload, since
saving with bytes still in flight reads as "it saved and my picture vanished".

**The part that mattered more.** 133 of the 357 lessons carry a marker the Trainual import left
behind — `<figure class="img-missing">` wrapping a figcaption describing the image that couldn't
be carried over, ending "— re-upload via admin editor". StarterKit has **no `figure` node**, so
ProseMirror was parsing the marker as unknown, discarding the wrapper, and re-serializing the
caption as a bare `<p>`. Merely opening one of those lessons and pressing Save silently
downgraded the placeholder to body text — and the whole point of this feature is to go open
exactly those 133 lessons. Verified by round-tripping all 133 production rows through the real
schema: **without the fix, 133 of 133 lose their placeholder.**

So the marker is now a real node. It round-trips (133/133 preserved, captions identical), and its
node view turns the placeholder into the upload target itself: a dashed card showing what the
image was, with **Add image** and a remove button for the markers that never stood in for a still
image in the first place (one is an embedded YouTube video). Replacing one inherits the Trainual
description as **alt text**, so the backfill produces accessible images for free rather than 133
empty `alt=""`. The only drift is cosmetic: 12 of the 133 captions contain HTML entities, and
`&quot;` re-serializes as a literal `"` — identical rendering, identical text.

**Also fixed while in here:** the editor registered Link twice. StarterKit v3 bundles it, and
`@tiptap/extension-link` was being added on top — TipTap warns "Duplicate extension names found:
`['link']`" and which config wins is undefined. Now configured through StarterKit. And lessons
had never contained an image at all, so this is the first time a block node is selectable or
reachable here: selected images get a brand outline, and the **gap cursor is styled**, without
which an image at the end of a lesson leaves you no visible way to put the caret after it
(TipTap ships the behavior but no CSS).

Not covered: pasting rich HTML from a web page still brings that page's `<img>` tags in as
external hotlinks. Unchanged from before, but worth knowing given everything else here is
upload-only.

## 2026-07-31 — Sidebar: home-content editor becomes "Hub Content"; nav icons tilt on hover

Two small follow-ups to the rail work. **System → Company Home** (the editor for the landing page)
is now **Hub Content** — nav item, breadcrumb, page heading, and permission label. With the landing
already "The Hub", this clears the last "Company Home" from the UI without giving two nav entries the
same name.

Section icons **tilt gently on hover** — a ~6° tilt with a subtle 1.1 scale, held while hovered
(`transition-transform`, 200ms ease-out), on the two top-level links and every group header. Applied
via `motion-safe:group-hover:` transforms, so it honours `prefers-reduced-motion`. (First shipped as
a full 360° spin earlier the same day; dialled back to a tilt on feedback.)

## 2026-07-31 — Quiz answer-key leak, and eight other completion bugs

An adversarial review of the two features shipped today (quizzes 074, assignments 076) found a
**blocker and five majors**. All fixed here.

**The blocker: the grade response leaked the answer key.** `gradeAttempt` returned
`correctOptionId` for every question and the attempt route spread it straight to the browser, so
`POST {"answers":{}}` handed back the complete key; replaying it scored 100%. With unlimited
retakes and a sticky `passed`, that made the 80% gate — and every "complete" in the compliance
report built on it — unenforceable without opening a single lesson. The key is now withheld unless
the attempt **passed**, where revealing it is harmless (the completion is already earned) and makes
the review screen useful. Guessing to a pass is not a way in: 80% of ten four-option questions is
roughly 1 in 10⁵. The claim in the previous entry that "the answer key never leaves the server" was
wrong, and the code comments asserting it have been corrected rather than quietly deleted.

**The gate failed open.** `getPublishedModuleQuizzes` swallowed its error and returned an empty map,
and `subjectIsComplete` reads "no quiz" as "lessons are enough" — so one failed read silently
removed the quiz requirement from every subject at once and reported learners who never passed as
complete. It throws now, as do `getAttemptSummaries` and the two reads behind the assignment report
(a swallowed error there rendered the whole roster 0% and every past-due assignment red).

**Three surfaces disagreed about completion, and one lied.**
- The subject-page banner said "This subject is complete" on the strength of the quiz alone — no
  lesson check at all. Reachable, because the quiz is linked straight from that banner. It now uses
  `subjectIsComplete` and says what's outstanding: "Quiz passed — 4 lessons still to read."
- The quiz result said "This subject now counts as complete" even for a **category** capstone,
  which gates nothing, and for a module quiz passed before the lessons were read.
- Company Home's required count skipped the quiz gate, so someone who'd read everything but never
  passed was told nothing was due while the admin report showed them overdue. It applies the full
  rule now — one extra query for three surfaces agreeing.

**XP was inconsistent in four places.** `/admin/learn/me` and the mark-complete toast used a
lesson-only total, so the same person saw a different XP — and possibly a different level — one
click from the browse page, and could miss a level-up celebration entirely. The leaderboard ranked
quiz-passers below their real XP. Unpublished-lesson completions also scored a phantom 50 XP on the
dashboard (`?? 0` → `lessonXp(0)` = `XP_BASE`) while the other two sites correctly dropped them.

**Assignments that could never be completed.** A module assignment ignored publication, so
unpublishing a subject left people nagged about something the library no longer showed them; and a
scope with no published modules — or none with published lessons — was accepted and then sat at 0%
and overdue forever with no action available. Both refused now, with a hint naming the cause.

**Also:** the quiz-aware `requiredTotal/requiredDone/requiredOverdue` had **no consumer at all** —
computed and thrown away — so the "precise state one click away" that Company Home promised didn't
exist. It's a stat tile now. Plus accessibility on the new surfaces: quiz options had no visible
keyboard focus (the radio is `sr-only`, and nothing supplied a `focus-within` ring), questions now
use `fieldset`/`legend` so the prompt is announced, results are a live region, and the report's
expander exposes `aria-expanded`. And stale copy claiming due dates, mandatory flags and quizzes
don't exist has been rewritten — that page renders all three.

## 2026-08-03 — Equipment Support listed in the Forms tab, beside SRV

`/admin/forms` already had a **Specialized forms** card for custom-coded forms that aren't rows in
the `forms` table — SRV was its only entry. Equipment Support now sits beside it, linking to
`/admin/support-content`. So the Forms tab finally shows the whole catalog rather than just the
builder-backed part of it.

- Entries are a data list filtered by perm rather than hand-written markup: SRV needs `srv`,
  Equipment Support needs `tickets`. The card renders only what the viewer can actually open, and
  disappears entirely when that's nothing — previously it was gated on `canSrv` alone.
- **The section count was hardcoded to `1`.** It's `specialForms.length` now; adding a second row
  without that fix would have shipped a card headed "Specialized forms · 1" listing two forms.
- The row subtitle says responses arrive in **Tickets**, because Equipment Support writes to
  `tickets` rather than `submissions` — otherwise the natural next click is the Submissions inbox,
  where nothing will ever appear.

**Only half of the SRV pattern applies here, deliberately.** SRV *also* keeps a real `forms` row +
`form_fields` synced from code (`lib/srv-form.ts` `ensureSrvForm`), because SRV submissions land in
`submissions` and the generic admin renderer iterates a form's fields to display them. Equipment
Support has its own table, queue, statuses, notes, attachments and AI recommendations, so giving it
a `forms` row would create a permanently-empty form reading "0 submissions" next to a real ticket
queue. It gets the listing, not the projection.

## 2026-08-03 — Support form reference photos are staff-managed (/admin/support-content)

The Wheel & Seals step of the public support form has always had two reference-photo frames —
"Desiccant wheel" and "Wheel seals" — sitting on a `ReferencePhoto` component that renders a
"Photo coming soon" placeholder until given a `src`. Filling them used to mean committing files to
`public/support/` and deploying. Now they're uploaded from **`/admin/support-content`**.

- Images go straight from the browser to the public `ticket-photos` bucket under a
  `support-reference/` prefix (direct-to-Storage, because a phone photo would blow the ~4.5MB
  Vercel function body limit on any route-handler upload). Only the resulting URL passes through
  the server action.
- The URL is stored in `app_settings` (migration 069's key/value store) — **no new migration.**
- Empty is a first-class state: no row, a null row, or a row that fails the URL allow-list all
  render the existing placeholder. The form is correct with nothing configured.
- **The stored URL is re-validated on read as well as on write**, and must be an `https` URL inside
  our own public bucket — the same allow-list `validPhotoUrls` applies to customer ticket photos.
  It ends up in an `<img src>` on a page anonymous customers reach, and a server action's arguments
  are attacker-controlled regardless of what the UI submits.
- Gated on the existing **`tickets`** perm — same audience as the support queue, so no new `Perm`
  key and no `role_permissions` seed. It's listed in `ADMIN_PATH_PERMS` as a **sibling** of
  `/admin/tickets`: an unmapped `/admin/*` path falls back to `dashboard`, which every scoped role
  holds, so omitting it would have opened the page rather than failing closed.

⚠️ **`lib/support-reference.ts` is deliberately DB-free** so the `'use client'` support form can
import its types; the read lives in `lib/support-reference-server.ts`. `lib/supabase-admin.ts` has
no `server-only` guard, so nothing would have errored if that import crossed into the client bundle.

Verified: the permission gate asserted directly against compiled `lib/roles.ts` (support-content
matches the tickets queue for all 7 staff roles; customer and null-role refused); and the read path
driven end-to-end in a real browser — seeded row → server read → RSC prop → `<img>` rendered on the
Wheel & Seals step, image anonymously fetchable (HTTP 200), placeholder correctly restored after the
seed was cleared. The admin UI itself is compile- and gate-verified but not human-clicked (signing
in isn't something I can do).

## 2026-08-03 — Support form sends one email, to the support desk

A support submission used to fire **two** emails: a confirmation to the customer, and a
notification fanned out to every admin employee plus `ADMIN_NOTIFICATION_EMAIL` plus
`SUPPORT_NOTIFICATION_EMAIL`. It now sends **exactly one** — a heads-up to
`crystal@dehumidifiers.com` so the desk knows a ticket came through.

- **No customer confirmation.** `sendTicketConfirmationToCustomer()` is deleted, not just
  unwired. The customer still gets their ticket number, the "we'll reach out to *you@…*" line,
  and the AI suggestions **on screen** at submit, so nothing they need lives only in that email.
- **No admin fan-out.** `getAdminRecipients()` / `ADMIN_NOTIFICATION_EMAIL` are gone from
  `app/api/tickets/route.ts`; those still drive PTO/digest mail, just not tickets.
- **Recipient is `SUPPORT_NOTIFICATION_EMAIL` (comma-separated), defaulting in code to Crystal.**
  Unset in prod today, so the default applies. Note the semantics changed: the env var now
  *replaces* the recipient list rather than CC-ing on top of the admin roster.
- `sendTicketNotificationToAdmins()` → `sendTicketNotificationToSupportDesk()`, so the name can't
  invite the roster back in.
- The retired `/api/troubleshooting` endpoint (checklist merged into tickets 2026-06-24, but still
  a live public POST) got the same treatment — no customer confirmation, same Crystal default,
  replacing the old `CS_NOTIFICATION_EMAIL` → Jacob fallback.
- `/support/status` no longer says "Reply to your confirmation email" — there isn't one.

⚠️ **This does not yet reach Crystal's inbox, for reasons outside this change.** Production has no
`RESEND_FROM_SUPPORT`, so every support email still sends from the `onboarding@resend.dev` sandbox,
which Resend only delivers to the Resend account owner — and `dehumidifiers.com` currently reads
`status=failed` in Resend. Verify the domain and set `RESEND_FROM_SUPPORT` (see
`docs/email-domain-setup-guide.md`) and this notification starts landing with no code change.

## 2026-07-31 — Required training + completion reporting (migration 076)

The last item on the IAT Learn roadmap. Assign a subject or a category to people with a due date at
**/admin/learn-content/assignments**, and see who has actually done it.

Four audiences: **one person**, **by role**, **by department**, or **everyone on staff**. The
audience is stored as a *rule* and resolved on read, never materialised — so a new hire inherits
every role/department/everyone assignment the day their account exists, without anyone remembering
to add them.

**There is no `completed` column.** Completion is derived through the same `subjectIsComplete()` the
library pages use — lessons read, plus the quiz passed where one is published — so a manager's
report can't drift from what the learner sees on their own dashboard.

⚠️ **Department assignments can reach nobody, and that shaped the design.** Department is free text
on the employee record and blank for 5 of the 9 active staff, so "assign to Dept · Warehouse" could
look like it worked while reaching zero people. The form shows the resolved head-count before you
save and says how many staff have no department; the API independently refuses a zero-person
audience with a 422. Assigning **by role** always resolves — every account has one.

**Learner side.** Required subjects sort to the front of the browse deck and swap their category
label for a due pill (`Due in 5d`, or `3d overdue` in rose), and a **Required** filter tab appears —
the reference design's "Mandatory" tab, finally real rather than faked, and hidden when nothing is
required. Company Home's training strip now leads with outstanding and overdue counts.

Verified with a 21-assertion harness against the live schema: audience resolution for all four
kinds, customer exclusion, blank-department normalization, category fan-out, earliest-due-date-wins
on overlapping assignments, overdue only counting when someone is actually behind, least-done-first
ordering, and cascade cleanup. One assertion failed first time and it was the *test* that was wrong:
it assumed customer profiles still existed here. The Phase-2 split moved them to their own project,
so this database now holds 9 staff and 0 customers — the exclusion filter is a correct no-op rather
than dead code, and the comment now says so.

Numbering note: this landed as **076**. A parallel session had already taken 075 for the Rep
Scorecard, so both files briefly existed; migration history was repaired and both are recorded.

## 2026-08-03 — Rep Scorecard (`/admin/rep-scorecard`)

Sales' rep-health review, ported from the `IAT_Rep_Scorecard` workbook they were
keeping by hand. Ten 0/1/2 signals per rep → a Total out of 20 → a Tier and a Grade,
rolled up per firm and across the channel. Migration **075**. Docs:
[`docs/rep-scorecard.md`](docs/rep-scorecard.md).

**The scoring model is unchanged from the workbook** — same ten signals, same wording,
same Inside Sales Playbook bands (15–20 Platinum/Gold · 8–14 Silver · 0–7
Developing/At-risk; A 17+ / B 13+ / C 9+ / D 5+ / F) — so the numbers Sales already
trusts don't move. What the portal adds:

- **Scores are kept per period** (`?period=2026-Q3`, linkable). The workbook was a
  snapshot that got overwritten; each rep now has a **Trend** tab showing every
  quarter scored with the delta between them.
- **Reps are the real CRM roster** — `contacts` at a `kind='rep_firm'` company, the
  *same* roster the territory map uses. A rep added on either surface appears on the
  other instead of drifting into a second list. Adds `contacts.territory` and
  `contacts.rep_status`.
- **Open pipeline and RFQs (60d) can come from DryWare** instead of being typed. IAT
  sells *through* reps, so the rep is the person on `deals.rep_contact` (~305 of 372
  live deals carry one). The Numbers tab shows the live figures with a "use these"
  button, and the Add-rep name field autocompletes from them. ⚠️ It's matched on the
  **name**, so it's a suggestion, never an authority — nothing is stored until a human
  accepts it.
- **Firm rollup and channel summary are computed**, not re-linked.
- **Every save is audit-logged** (`rep_scorecard.*`), with who scored and when on the record.

One deliberate fidelity note: the workbook's Total is the sum of whatever is filled in,
always out of 20 — so a rep judged on three signals reads the same as one judged on ten.
That behavior is kept (changing it would move every number), but the scored count now
shows beside the total (`4/10`) and the drawer header says so, since a low score that
just means "we haven't looked yet" was previously indistinguishable from a bad one.

Access shares the existing `deals` permission (Sales + admin), like Performance and
Territories — **no new permission to seed**. Scoring is further restricted to the admin
and sales roles server-side; other `deals` holders see the board read-only.

The roster starts empty: the source workbook was a blank template (only its EXAMPLE row
was filled), so there was nothing to import.

## 2026-08-03 — Infrastructure cleanup: retired the three folded-in apps

Housekeeping, no portal code changed. Three sub-apps that had already been consolidated into the
portal were still occupying Vercel projects and live repos; they're now cleaned up.

**Deleted (Vercel projects):**

- **`iatlearn`** — was already serving a 404 (no production deployment existed). Learn lives at
  `/admin/learn`, verified holding all 14 modules and 357 lessons.
- **`iat-home`** — was still serving the old static landing page. Its two cards already pointed at
  `iatportal.vercel.app` and `/support`, so nothing was lost. The front-door job belongs to the
  portal's `/home` intranet page.
- **`iat-ticketing`** — the last standalone deploy. Since 2026-07-22 it had served only a 307
  redirect to `iatportal.vercel.app/support`, catching pre-consolidation customer bookmarks. It was
  initially kept for exactly that reason, then **deleted the same day** on Jacob's call.

  ⚠️ **Known side effect:** `iat-ticketing.vercel.app` now returns a 404, so any pre-2026-07-22
  bookmark, saved link, or old ticket-confirmation email pointing there is a dead end rather than a
  redirect. If a customer reports the support site "not working," that's the first thing to check —
  the live address is `iatportal.vercel.app/support`. Web Analytics was never enabled on the
  project, so there's no measurement of how much traffic this affected.

**Vercel is now down to two projects: `iatportal` and `iat-customer`.** Neither has a custom domain.

**Archived (GitHub, read-only):** `iat-home`, `iat-learn`, `iat-ticketing`. Archived rather than
deleted — reversible, preserves history, and silences the Dependabot noise (`iat-learn` had three
open bot PRs). All three were public; archiving makes them immutable.

**Deleted (Supabase):** the **`iat-learn`** project (`lhrakeyfiniiftszrtuz`) — a leftover from the
standalone Learn prototype, which had its own database separate from the shared `iat-forms` one. It
was already paused (`INACTIVE`, DNS torn down). Safe to drop because the content was verified live
in the main DB first: 14 modules matching the 14 files in `_archive-iat-learn-import/`, 357 lessons.

**Verified before deleting:** no code anywhere in the workspace references the retired URLs (only
docs prose), and the old `/support` → `iat-ticketing.vercel.app` rewrite is already gone from
`next.config.js` — the portal serves `/support` natively. Post-cleanup checks confirm
`iatportal.vercel.app` still 307s to `/login` and **`/support` still returns 200** — the canonical
customer flow is unaffected by any of the deletions.

Docs updated: `07-sitemap.md`, `00-ecosystem-overview.md`, `02-iat-ticketing.md`,
`04-accounts-and-access.md`, and security item **8.7** — "legacy standalone app still live" — is now
closed. — J.Y. + Claude

## 2026-07-31 — Learn quizzes, drafted by AI (migration 074)

The last unbuilt Phase-2 gamification piece, and the Trainual feature Jacob wanted carried over:
a **Build with AI** button on any subject or category that reads the lesson text and drafts a
10-question quiz.

**It drafts; you publish.** Same posture as case studies and Jerry's ticket replies — nothing
AI-written reaches a learner unreviewed. The review screen shows each question with its four
options, the answer key, the explanation, and **the lesson it was drawn from**, so checking the key
is a click rather than a hunt. Publishing is refused server-side unless every question has exactly
one correct option, so a reviewer who deletes the right answer can't ship an unpassable quiz.

**It refuses rather than invents.** 33 lessons are still the literal "maintained in Trainual"
placeholder, and they cluster — Safety Procedures has 23 lessons but only ~1,500 usable characters
across 2 of them. Asking any model for ten questions about that guarantees fabrication. So the
source is measured *before* any API call: Safety Procedures, Testing Training and Our Products are
all refused today, each naming the lessons that need writing, at zero token cost. Content that is
long but still unquizzable gets caught by a second layer — Claude's own `blocked` reply, carried
through in its own words rather than shown as "malformed".

**Passing a subject quiz now completes the subject** (Jacob's call). Reading every lesson is no
longer enough once a quiz is published — but a subject with *no* published quiz completes on
lessons alone, so adding a quiz later never retroactively un-completes anyone. 80% to pass,
unlimited retakes, best score kept, `passed` sticky, and the 150 XP lands **once** on the first
pass so retaking can't farm it. Attempts store the bar they were graded against, so raising
`pass_pct` later doesn't re-grade history.

**The answer key never leaves the server.** `learn_quiz_options` has exactly one RLS policy —
admin — and no learner read path at all; the learner query doesn't even *select* `is_correct`; and
the client posts option ids while the server grades. An option id belonging to a different question
is treated as unanswered rather than credited.

Verified against the live schema with a 17-assertion harness covering scoring, blank answers,
cross-question ids, first-pass detection, best-score-kept, sticky pass, gating and cascade cleanup.
The AI path was run end-to-end against real lesson text before any UI existed: 10 grounded
questions from "Using DryWare", 0 bad source ids, 0 malformed options.

Model: `claude-sonnet-5`. The older AI features are still on `claude-sonnet-4-6`.

## 2026-07-31 — Five invisible backgrounds: the token-opacity trap, swept

Semantic color tokens are registered as bare `var(--x)` strings, so an opacity modifier on one
(`bg-surface-strong/50`) produces **no CSS rule at all** — the element silently has no background.
DESIGN.md §2.5 documents this and two files already carried warning comments about it, but five
live instances had slipped in. Verified by grepping the compiled stylesheet, not the source:
all four class variants were absent from `.next/static/css/*.css`; the plain tokens were present.

- **CRM board drag-over highlight** (`BoardView.tsx:227`) — the real one. `bg-surface-strong/50`
  meant dragging a deal card highlighted **no drop target whatsoever**. Now `bg-brand-soft`, the
  sanctioned active wash, which is also more legible than the original intent.
- CRM collapsed "Lost" rail hover (`BoardView.tsx:185`) → `hover:bg-surface-strong`.
- Department-dashboard briefing divider (`DepartmentDashboard.tsx:86`) → `border-hairline-soft`.
- Form-builder section-header rules (`FormBuilder.tsx:461,463`) — the two 1px lines flanking a
  section label rendered as empty gaps. Now `bg-hairline`; the `text-brand-ink` label still carries
  the color signal, and a decorative brand-tinted rule would have been §2.3 misuse anyway.

Re-verified after the fix: each replacement emits a real rule, and the four broken variants appear
zero times.

## 2026-07-31 — Learn's library page, rebuilt as a gamified dashboard

`/admin/learn` was a greeting band over five category tiles. It's now a proper library dashboard,
built from a reference design Jacob supplied: a **level band** (ring, title, XP, XP-to-next,
streak), a horizontal **deck of the 14 subjects** washed in their category's color with lesson
count, run time and progress, a **week chart** of content completed per day with a vs-last-week
delta and four stat tiles, and an **Up next** panel — a 7-day activity strip plus the actual next
lessons to open, resuming a started subject before offering a fresh one.

The gamification was always there — XP, ten levels, streaks, nine badge types — it was just
rendered quietly. This surfaces it.

**Colour is the DESIGN.md §2.4 dashboard exception, not a fork.** Every wash is a Tone from the
sanctioned table (emerald / sky / amber / violet / rose / slate); no off-system pastels were
introduced. A subject inherits its *category's* tone, so color means "this part of the library"
rather than decoration — Onboarding is emerald, Safety amber, Technical violet, and so on.

**Nothing on the page is invented.** The reference leaned on due dates, a Mandatory filter, "hours
studied" and test scores. Learn has no `due_date`, no `is_mandatory`, no quizzes, and
`learn_progress.time_spent_seconds` — despite existing since migration 014 — **is never written by
anything**, so a real "hours studied" figure would have been fabricated. Rather than fake them:
the date pill carries the category, filters use real progress state, and the chart plots
`estimated_minutes` of lessons *completed* per day under the label "Content completed". Due dates
land with assignments; scores with quizzes.

Caught while verifying against a static render of the real compiled CSS: the first cut sized bars
with percentage heights inside `items-end` columns, which have no definite height — so the chart
rendered completely empty. Heights are explicit pixels now. Days are bucketed with the same
`dateKey()` helper streaks use, so a late-evening completion can't extend a streak while landing
on the previous bar.

## 2026-07-31 — Admin sidebar: drop the active-row green indicator

The 2px brand-green bar on the left edge of active nav items is gone (all three spots: the two
top-level links and the group headers). Active state now reads from the `--sidebar-strong` wash +
brighter `--sidebar-ink` alone. Removed on preference — the accent bar wasn't wanted. `--sidebar-brand`
is now unused on the rail; the token stays defined. DESIGN.md §2.2/§6 updated so it isn't re-added.

## 2026-07-31 — Admin sidebar: regrouped, Self-service pinned to the footer, groups unfurl

The rail is reorganised around where people actually look for things:

- **Operations** keeps the day-to-day queues and gains **Internal Apps**, which was a top-level
  item of its own. **Prod Board** is the shorter label. **SRV Form** comes off the rail entirely
  (the route stays live — it now surfaces inside the **Forms** page as a *Specialized forms* card,
  shown only to holders of the `srv` perm).
- **Sales** gains **Sizing Studio** and **Gantt** from Operations, alongside Application Diagrams.
- **Marketing** gains **Case Studies** from Sales, next to the Calendar.
- **Training** moves down next to the other work groups; **People** renames Accounts →
  **Employees** and Scheduling → **Schedule**.
- **Self-service** is no longer the first group in the scrolling list — it is pinned to the
  **footer**, above theme + log out, where personal pages belong. It highlights and auto-opens on
  its own `/admin/me/*` pages like any other group.

Groups now **unfurl** instead of snapping: the panel animates its grid track `0fr → 1fr` over
240ms, clipped by `overflow-hidden`. The animation is gated behind a flag armed one frame after
mount, so restoring remembered-open groups on a reload doesn't animate — only your own toggles
do. Collapsed children stay mounted but drop out of the tab order.

The landing itself is now **"The Hub"** to match the rail: the shared `HomeTopBar` title (rendered
by `HomeContent` in the admin, `/home`, and employee shells, so all three landings change at once),
the employee shell's nav link, and the production-staff note on `/admin/dashboard`. **System →
Company Home** is deliberately left as-is — it's the *content editor* for that page, and giving it
the same "The Hub" label would put two identically-named entries in the nav.

## 2026-07-31 — Application Diagram Studio

`/admin/diagram-studio` — sales builds the airflow figure for a proposal instead of asking
someone to redraw one. Pick the application, edit every condition on the drawing, drop in a photo
of the space, export a PNG at 4000 × 2300 and paste it into the submittal.

**The application dropdown changes the layout, not just the numbers.** Six templates ship, and
they are genuinely different drawings: a hospital OR is a desiccant DOAS bolted onto an existing
air handler, an ice arena is a recirculating loop with no air handler at all, a battery dry room
is a three-stage precool → desiccant → post-cool train, and there are cold-storage dock,
natatorium and pharmaceutical-coating figures too. Switching applications redraws the figure, so
it asks before discarding edits.

Everything on the drawing is editable in place. Click a value card, a label or a piece of
equipment and the right-hand rail fills in with its settings — title, color, rows of
value + unit, card width, leader line on/off. Cards and labels drag to reposition, and a selected
card's leader dot drags to re-point it. Cards and labels can be added and deleted. The figure
header (figure number, title, eyebrow), the footer keys, the equipment labels and the AHU section
names are all editable too.

Exports: **PNG** (2× the artboard — the one for Word and PowerPoint), **SVG** for anyone who needs
vector, and **Save file / Open** to hand a figure to a colleague as `.json`. The selection outline
never appears in an export.

Two things worth knowing before handing this to the team:

- **The numbers are not calculated.** This is a drawing tool — it does no thermodynamics and
  validates nothing. The values each template ships with are plausible design conditions so a rep
  starts from a filled-in figure rather than a blank one; **they are placeholders**. Size the unit
  in the Sizing Studio and type the results in here.
- **Work is autosaved to the rep's own browser, not the server.** A figure survives a reload but
  does not follow you to another machine, and only one is held at a time. Use **Save file** before
  starting the next one. A server-side library is the natural next step and would slot straight in
  — the scene is already plain JSON.

The artboard deliberately ignores the portal's design tokens and dark mode: it is a customer-facing
document that has to look identical whichever theme the rep is working in, so an exported PNG can
never come out dark. Its palette is its own closed system.

New `diagrams` perm, seeded for sales, engineering and marketing in migration 073 (no tables — the
page is entirely client-side, like the Sizing Studio). Full write-up in
[docs/diagram-studio.md](docs/diagram-studio.md).

## 2026-07-31 — Delete content in Learn

`/admin/learn-content` can now delete a **category**, a **subject** or a **lesson**. Until now the
only way to remove anything was to hide it, and adding a category or subject still needs SQL.

Every level cascades — category → subjects → lessons → `learn_progress` — and none of it is
recoverable. Because XP, levels, streaks and badges are *derived from `learn_progress` on read*,
erasing progress rows lowers people's totals retroactively and can revoke earned badges. So the
tree names the blast radius before you commit: clicking the trash icon swaps the row for an inline
confirmation reading e.g. *"Delete 'How we Use Trainual at IAT' and 5 lessons?"*, calling out
completion records separately when there are any, and pointing at **Hidden** as the non-destructive
alternative. Lesson rows show a ✓N completion count so you can see what is at stake before clicking.

Every deletion writes an audit entry — `learn.category.delete` / `learn.module.delete` /
`learn.lesson.delete`, under a new **Training** filter on `/admin/audit`, with the lesson and
completion counts in the summary.

Hardened after an adversarial review, which found real defects in the first cut:

- **The count must succeed or the delete must not run.** `supabase-js` reports failure as
  `data: null` / `count: null` rather than throwing, so the original code would have deleted a
  category while writing an audit record claiming nothing was destroyed. `getDeleteImpact()` now
  throws on any failed count and each route returns 500 without touching the data.
- **"No progress is lost" can no longer be a guess.** A failed read of `learn_progress` used to be
  indistinguishable from zero completions, which would have rendered a confident all-clear over
  data about to be erased. Unknown is now its own state, with its own warning.
- **Lesson confirmations said "and 1 lesson"** — appending the count of the very lesson already
  named in the headline, implying a second one.
- The audit entry for a subject deletion recorded `modules: 0` when it had removed one.
- The lesson trash button was keyboard-focusable but invisible (`opacity-0` with no
  `focus-visible` counterpart, which also swallowed its own focus ring). Confirmations now take
  focus, announce as an `alertdialog`, and errors are live regions.
- `busy` was a single shared slot, so an in-flight publish toggle could re-enable the delete button
  mid-request and invite a second DELETE. Publish/create failures were also silently swallowed.

A category **rename** endpoint was written and then removed before shipping: nothing called it, and
an admin-only endpoint no UI exercises never gets smoke-tested. Renaming and reordering stay on the
roadmap in `docs/learn.md`.

## 2026-07-30 — IAT Learn moves into the admin portal (and gets re-skinned)

IAT Learn is 357 published lessons that **nobody had ever opened**. A query against production
found `learn_progress` completely empty — zero completions, zero users, since it went live on
2026-06-15. Nothing was broken; it simply appeared in no sidebar. Its only doors were four links
inside `/employee/*` — the surface the portal consolidation is retiring — and one hero link on
Company Home.

So it now lives in the admin shell, one click down the left nav:

| Old | New |
|---|---|
| `/learn` | `/admin/learn` |
| `/learn/me` · `/learn/leaderboard` | `/admin/learn/me` · `/admin/learn/leaderboard` |
| `/learn/[category]/[module]/[lesson]` | `/admin/learn/[category]/[module]/[lesson]` |
| `/learn/admin` | `/admin/learn-content` |

A new **Training** group (Browse · My Learning · Leaderboard · Manage content) sits beside
Self-service, since both are the groups every employee can see. Old URLs 308-redirect from
`next.config.js`, which runs before middleware, so bookmarked lessons and `?redirect=/learn…`
logins both still land.

**Access.** Every staff role views; only full admins author. Authoring is deliberately the
*sibling* `/admin/learn-content`, not a child route: `requiredPermForPath` short-circuits on
`OPEN_ADMIN_PREFIXES` and returns `null`, so a permission on anything nested under the open
`/admin/learn` would be silently dead code. The new `learn_admin` perm is in no
`DEFAULT_ROLE_PERMS` list — admin-only by omission, **no migration**. Verified by compiling
`lib/roles.ts` and asserting the gate directly: all 7 staff roles view, none but admin author,
customer and null-role refused.

**One breadcrumb bar.** Closes the follow-up the 2026-07-27 consolidation left open. Learn's
category/module/lesson pages each rendered an inline `<Breadcrumb>` beneath the shell's own bar,
and the shell's crumb was hardcoded wrong — it read "Learn › Browse › Lesson" on category and
module pages too. Record crumbs now feed up through `PageChrome`, so a lesson reads
`Training › Browse › Safety › Safety Procedures › Why Gloves Matter`. `LearnShell` (216 lines of
duplicate sidebar/top-bar/search/sign-out) and `components/learn/Breadcrumb.tsx` are deleted.

**Re-skin.** Learn was the last fully pre-token surface — ~367 raw `gray-*`/`zinc-*`, 110 hex
literals, 25 `font-bold`, gradient buttons with hover-lift. Now entirely on the semantic tokens,
with a grep as the acceptance gate rather than a hand-written checklist. Badge tiers and
leaderboard podium chips move onto the Tone system; the four identical brand-green stat-tile
chips and CategoryCard's scale-in green bar are gone (DESIGN §2.3 — green is not decoration);
the search box's `focus:ring-2 focus:ring-[#089447]/10` was a live instance of the §2.5 trap
where a token opacity modifier renders **blue**, and is now the outline recipe. `.learn-prose`
is rewritten on CSS variables, which lets its 11-rule hand-rolled `.dark` mirror disappear.

**"Your training" on Company Home.** Rather than putting XP chips in the operations top bar, a
per-person strip sits between the core-values band and the KPI row: level, XP, day streak and
library percentage. Its **zero state is the primary state** — with `learn_progress` empty, that
is what everyone sees first, so it reads as an invitation, not an empty dashboard. It joins the
existing `Promise.all`, so it costs no extra round trip.

**A correction to the 2026-06-15 entry below:** it claims "81 of 357 lessons are heading-only
stubs" and "154 image/video placeholders". Live numbers are **33 placeholder bodies** and **133
lessons carrying ~180 missing images**. The concentration matters more than the total —
**Safety Procedures is 20 of 23 placeholder text**, Testing Training 13 of 16, and both are
published. Worth unpublishing those two before announcing Learn to staff. That entry also still
says gamification is "deferred"; it shipped 2026-06-16.

Docs: new `docs/learn.md`; `docs/admin-topbar.md` and `docs/roles-and-permissions.md` updated.

## 2026-07-30 — Marketing calendar: wider and shorter

Calendar goes from 75% to **77%** of the width (the panel is now a fixed 288px, so the calendar
takes every pixel a wider window offers), and the whole block gets **140px shorter** for a 6-week
month and **230px shorter** for a 5-week one — 656px / 566px, down from a flat 796px.

The height came from making week rows a fixed 90px instead of `1fr` of the viewport. Stretching
them filled the screen, and since the side panel matches the calendar's height, an airy calendar
was dragging an airy card along with it. Cell internals tightened to suit (`p-1`, `mb-0.5`,
`space-y-[3px]`), and chip count is now **adaptive**: three chips fit only when three is all
there is — a fourth item spends the last slot on the "+N more" line, since that hint matters more
than one extra title.

The composer condensed with it: single-column fields at a tighter rhythm, platform switched from
a six-chip row (which wrapped to three lines at 288px) to a select, and owner moved back to the
Details tab. Dead space in the Basics pane drops from 427px to 168px on a 6-week month and 78px
on a 5-week one. Equal-height columns and the no-scrollbar panel both still hold — measured 0px
body overflow on both tabs, light and dark.

## 2026-07-30 — Marketing calendar: equal-height columns, tabbed panel + migration history repaired

**Layout.** The calendar and the side panel now end on the same line, and the panel has no
scrollbar. At `lg` nothing on the page scrolls: the viewport height flows down to the calendar's
week rows, which absorb the slack (`repeat(N, minmax(112px,1fr))` instead of a fixed 104px), and
the grid's `stretch` makes the panel column exactly as tall as the calendar. Because the panel
now knows its height it can drop `overflow-y-auto` and use a **tab strip** instead — Basics
(title/date/status/channel/platform/owner) and Details (link + notes, notes absorbing the
leftover height). Tabs are the shared `components/ui/Tabs`. Measured 1440×900: both columns
796px, panel body overflow 0px on both tabs.

The 112px row floor is a FULL cell — date + three chips + the "+N more" line. Sizing it to the
chips alone (96px) clipped exactly that overflow hint. Below the floor the *calendar* scrolls;
the panel never does. Day list and record notes keep a safety-valve scroll since their length is
unbounded and clipping an event would be worse.

**Migration history repaired.** `supabase migration list` reported 068, 069, 070 and 072 as
pending when all four were live in the database — a blind `db push` would have re-run them.
Verified every object of each against production (tables, indexes, triggers, the
`companies.map_color` column, RLS, plus 71 territory + 54 location rows) then
`migration repair --status applied`. Also renumbered the duplicate `064_crib_assign.sql` to
`070_crib_assign.sql`: two files claimed 064, so one could never be recorded and showed as
permanently pending. It is idempotent (`DROP … IF EXISTS`, `CREATE OR REPLACE`), so the rename
carries no re-run risk. The tracker is now clean — 72 migrations, zero pending, no duplicates.

## 2026-07-30 — Marketing calendar (migration 071)

New `/admin/marketing` under a new **Marketing** nav group — the content calendar for social
posts, email campaigns, blog articles, trade shows and paid ads.

Three quarters of the page is the month grid; the right quarter is a **floating card** that is
both the composer and the record view. It looks like the CRM's detail drawer but is deliberately
not modal — no scrim, no focus trap — because a drawer would black out the calendar you're
scheduling against. Composing is its resting state, so adding something is never behind a modal
or a button, and after each add the form keeps the date/channel/owner so a week of posts is one
run. Clicking a day shows that day; clicking a chip shows the record with inline edit, one-click
status, and delete.

Chips are colored by **channel** (social/email/blog/event/ad/pr), not status — that's the axis
you scan a content calendar on; status only marks the chip when it changes the read (published ✓,
canceled struck through). Channel/status/platform lists live in `lib/marketing.ts` with no DB
CHECK behind them, so adding "TikTok" is a one-line edit — `app/api/admin/marketing/validate.ts`
is the enforcement.

New perm `marketing_calendar` seeded to **marketing** by migration 071 (table `marketing_events`,
RLS on, service-role only). Named `marketing_calendar` rather than `marketing` because that's
already a StaffRole. Not built on `deal_follow_ups`: those rows CASCADE when DryWare prunes a
deal, which would silently delete marketing work. See `docs/marketing-calendar.md`.

## 2026-07-30 — Case Studies back under Sales; Marketing + Training parked

**Case Studies moved Marketing → Sales.** Sales is who actually uses it: they start one from a
customer page and write every grounding input. Marketing only approves, which the status ladder
already enforces (`requireCaseStudiesAuth({ approve })` is marketing/admin) — it never needed to
be a Marketing nav item to be a marketing responsibility.

**Marketing and Training are parked** — "nice to haves one day". New `NavParent.parked` renders a
group grayed, non-interactive and un-expandable with a "Soon" chip, distinct from `hidden` (gone
entirely): the roadmap stays visible on the rail, it just can't be opened. Parked groups are also
excluded from `activeParent`, so reaching one by URL can't force-open a group with no rollout.

The ⌘K palette entries went with them (Marketing Calendar + the four Training ones, commented out
in place with restore instructions) — leaving them would have made the palette a back door into a
tab we just grayed out. Their `Megaphone`/`GraduationCap` imports were dropped alongside.

**Routes are NOT gated** — this is a nav affordance only. `/admin/marketing`, `/admin/learn` and
friends still serve anyone with the URL or a bookmark, which keeps parking cheap and reversible
(delete `parked`, uncomment the palette rows). Note the Hub (`/home`) still carries a "Browse
training" hero link and the `TrainingStrip` progress card; those were left alone as a separate
surface, so Training is parked in the rail but not on the landing page.

## 2026-07-30 — Case studies: anonymity risks are surfaced, not scrubbed

Anonymized mode omits the customer name, serials and site from FACTS **structurally** — but it
could never strip what a person typed into the free-text story fields. A test study set to
Anonymized still produced "a licensed cannabis cultivator in Oxford, GA", because the city was in
the context someone wrote. For a licensed operator, industry + city is effectively an ID.

The toggle now flags rather than scrubs — silently deleting detail someone deliberately typed is
its own failure mode, so the call stays with the human. Two independent passes, because they catch
different things:

- **`findDisclosureLeaks` (deterministic).** Exact matches on identifiers we *hold* — customer
  name (including the suffix-stripped form, so "Acme Pharma Inc" also catches "Acme Pharma"),
  customer location, unit serials, unit sites — scanned across context / problem / outcome /
  application / notes. No false positives; a 4-char floor keeps generic tokens from matching, and
  overlapping identifiers report once.
- **`disclosure_risks` (model-reported).** What only a reader can spot: a city, person, or facility
  name we have no record of. In testing it flagged the city *and* reasoned that cannabis + specific
  city + facility type is identifiable through public licensing records.

Both land as blocking `kind: 'disclosure'` gaps in a distinct rose **"Anonymity risks"** panel
(separate from the amber input-gap panel, so "missing fact" and "this names the customer" never
read as the same problem). Clearing one is an explicit **"Accept anyway"**. `Gap.kind` is optional,
so pre-existing rows keep counting as input gaps — no migration.

## 2026-07-30 — Case studies: a refusal is no longer reported as "malformed"

First real click-through hit `The draft came back malformed. Try again.` — and that message was
wrong in both halves. Claude hadn't malfunctioned: the study's context/problem/outcome fields held
IAT's internal **fabrication-department** blurb while the unit described a cannabis facility, so it
declined to weld those into a story. Having no JSON-shaped way to say "these inputs are unusable"
(a `gap` covers a *missing* fact, not wholesale garbage), it broke format and explained in prose —
which the route caught as a parse failure and replaced with a generic error. "Try again" was also
actively wrong: retrying identical inputs fails identically (prod logs show 3 attempts in a minute).

The anti-fabrication design worked exactly as intended; only the reporting was broken. Now:

- **Refusal is a first-class outcome.** The prompt defines `{"blocked":{"reason","fields"}}` for
  inputs that can't support a study; the route returns **422** with it and the editor renders a
  rose "Not enough to work from" panel quoting Claude's reason, the offending FACTS paths, and a
  note that retrying unchanged will land in the same place.
- **The model's words are never swallowed.** If the response still isn't JSON, its prose is
  surfaced *as* the blocked reason rather than discarded behind "malformed".
- **JSON extraction hardened** — falls back to first `{` … last `}`, so commentary-wrapped JSON parses.
- **Truncation is its own error.** `max_tokens` 3000 → 8000 (five sections + a claim per assertion
  ran tight), and `stop_reason === 'max_tokens'` now reports a length problem instead of
  masquerading as a parse failure.

Verified against the exact prod inputs that failed: the model now returns a structured block naming
`project.context`, `project.problem_before`, `project.outcome_after` and what to put there instead.

## 2026-07-30 — Case Studies: AI-drafted, human-approved (migration 072)

New `/admin/case-studies` (Sales nav group). Sales starts a study fresh from the list or from a
customer detail page ("New case study" pre-seeds the customer + one snapshotted unit row per
registered equipment record). Required inputs — per-unit model/application/entering/target/airflow,
plus project context, the problem before, and the outcome after — then **Claude drafts the prose
from those inputs and nothing else**:

- The model receives ONE structured `FACTS` object (`lib/case-studies.ts:buildFacts`). Anonymized
  studies (the default) omit the company name and serials **structurally** — Claude never sees them.
- Server-side number check (`checkNumbers`): every digit-run in the draft must trace back to the
  inputs; unmatched numbers become rose "unverified number" flags in the editor.
- Facts the model wanted but wasn't given come back as amber **gaps**, not invented sentences.
  Gaps + flags block approval until each is resolved/cleared by a human.
- Claude's original draft stays immutable (and visible) under the human-edited working copy.

Status ladder `draft → in_review → approved`; **approve is marketing/admin only**
(`requireCaseStudiesAuth({ approve })`), same split for reopening or deleting an approved study.
Approved studies lock and get a print/save-as-PDF sheet at `/print/case-study/[id]` (drafts print
with a "DRAFT — not approved for distribution" banner; anonymized studies hide serials + name).

New perm `case_studies` seeded to **sales + marketing** by migration 072 (tables `case_studies`,
`case_study_units` — RLS on, service-role only). Deliberately NOT keyed on `deals`: content
approval is a different trust boundary than pipeline access.

No energy-savings %, ROI, payback, customer quotes, or competitor mentions can appear unless a
human typed them into an input field — the prompt forbids them and the number check backstops it.

`d172a55` themed the `/admin/knowledge` reactor as a desiccant rotor — face-on rotation plus a
reactivation sector fixed in the housing, giving the two-sector rotor face. Shipped and reverted
the same day: **the sun-only look is preferred.** `ReactorSun.tsx` is byte-identical to its
pre-`d172a55` state (plasma star, tumbling about Y, no `ROTOR` block, no sector uniforms).

Don't re-propose it as a fresh idea — it was built, deployed, looked at, and declined on taste,
not on a defect. The slider harness used to dial it in lives in `claude-design/mockups/`
(untracked, workspace root) if it's ever wanted again; `git show d172a55` has the shader.

One finding worth keeping from that work: **`smoothstep(a, a, x)` divides by zero, which is
undefined in GLSL** — it renders "correctly" on some drivers, NaNs on others, and was observed
changing behavior under an unrelated refactor of neighbouring lines. Guard the branch and write
the intended value explicitly if a tunable feeding a `smoothstep` edge can reach 0. Nothing in
the current tree does this.

## 2026-07-29 — Self-service group in the admin sidebar

The `/admin/me/*` pages are now discoverable in the rail, not just from the Company Home hero.
A new **Self-service** nav group (first, above Operations) holds Time Off, Submit a Form,
Directory, and Internal Apps. Its children carry no `perm`, so they show for **every**
admin-surface role — a real win for base `production`, which otherwise saw only "Company Home"
in the sidebar. `NavChild.perm` is now optional (omit = open), plus a `hideIfPerm` flag hides the
self-service "Internal Apps" from `tools` holders (who already have the top-level "Internal Apps"
→ `/admin/tools` with Presentations), so the label never doubles.

## 2026-07-29 — Self-service ported into the admin shell (`/admin/me/*`)

Follow-up to the Company Home feedback batch: employees are merged into the admin
surface, so **no `/admin` page should link into `/employee`**. The home hero's
self-service buttons now point at a new open namespace inside the admin shell:

- `/admin/me/time-off` — request PTO/sick + history (the `/employee/requests` view,
  extracted to a shared `components/self-service/TimeOffRequests.tsx` and rendered by
  both routes)
- `/admin/me/forms` — browse & submit internal forms (shared `EmployeeFormsView`)
- `/admin/me/directory` — read-only team directory (`OrgDirectory`, `canEdit` off)
- `/admin/me/apps` — internal field-apps launcher (`TOOL_APPS`, no perm-gated extras)

`/admin/me` is added to `OPEN_ADMIN_PREFIXES`, so every admin-surface role reaches it
like `/admin/home` — deliberately distinct from the perm-gated *management* copies
(`/admin/requests` approval queue, `/admin/employee-forms`, `/admin/org-chart` which is
editable, `/admin/tools`). The temporary `EMPLOYEE_SELF_SERVICE` middleware allowlist
from the previous entry is reverted — admin-surface roles are fully funneled out of
`/employee/*` again, since everything they need now lives under `/admin/me`. Breadcrumbs
added under a "Self-service" section.

The hero links are **surface-aware** (derived from `profileHref`): the admin shell links to
`/admin/me/*`, but the employee-shell home (`/employee/home` — only the null/unknown-role
fallback lands there) keeps its `/employee/*` links, which that role can actually reach. Without
this, a role-less account's four hero buttons dead-ended at `/employee/profile`.

No DB / permission-key / migration changes (`OPEN_ADMIN_PREFIXES` is code-only).

## 2026-07-29 — Admin sidebar scrollbar matches the rail

When enough nav groups are expanded the admin sidebar overflows and scrolls, and
it was painting the default OS browser scrollbar — bright chrome against the dark
pine/graphite rail. It now uses a thin (8px) rounded thumb tinted from the rail's
own ink tokens: `--sidebar-ink-faint` at rest (a step below the nav-label ink, so
it recedes behind the content) lifting to `--sidebar-ink-muted` on hover, over a
transparent track with the increment/decrement arrows suppressed. The tokens
resolve per theme, so it reads as a soft green on the light pine rail and neutral
graphite in dark mode. Firefox gets the same via `scrollbar-width: thin` +
`scrollbar-color`.

Scoped to the admin rail — desktop `<aside>` and the mobile drawer share one
`<nav>`, so both are covered; the `/learn` and customer navs are untouched.

`app/globals.css` (`.sidebar-scroll`) · `components/admin/AdminSidebar.tsx`.

## 2026-07-29 — Performance rows link across to the CRM Board

Expanding a project on **Performance** (`/admin/projected-sales`) now offers
**"Open in CRM Board"**, which opens that deal's record on `/admin/deals`. The
forecast view and the workflow view show the same projects and were completely
unconnected until now.

There's no FK between them, and `projected_sales.id` can't stand in for one: the
table is wiped and re-inserted on every sync, and since `id` is an identity
column that a `DELETE` doesn't reset, every row is re-numbered each time. The tie
is the computed `dryware_key` (`customer|project`) that the materializer already
stamps onto `deals`, so the page hands the client a key-keyed map. Verified
against production: 374 rows, 366 keyed deals, 0 duplicate keys, 0 unmatched.

Caught in review before shipping — the first cut keyed the map on
`projected_sales.id`, which would have gone **100% stale the moment anyone
clicked "Sync now"**: every link would vanish and the fallback would advise
syncing again, which re-breaks it. Also fixed: the `?deal=` param strip now
passes the existing history state through, because on a hard load that effect
runs before Next patches `replaceState` and a null state kills the Back button
and lets a refresh resurrect the param; and a deep link to a pruned deal now says
so instead of silently doing nothing.

`projected-sales/page.tsx` · `ProjectedSalesClient` · `DealsClient` ·
`lib/dryware-key.ts` (new).

## 2026-07-29 — Territories: the panel floats, and clicking a rep drills into it

The rep panel was a docked column with a left border. It's now a **floating
card** over a **full-bleed map** — inset from the edges, 16px radius, hairline
border, Level-3 shadow in light / `ring-white/10` in dark — the same language as
the deals drawer. The map is meaningfully bigger for it.

**Clicking a rep now drills the panel into that rep**, the way clicking a firm
already did: back-link, identity, then Overview / Territories / Locations /
Notes. Deliberately *not* the overlay `Drawer` the deals board uses — this page
is about the map, and a scrim over it hides the thing you're reading about. So
`RepDrawer` is gone, replaced by `RepDetail` rendering inside the panel.

Going full-bleed moved three things that used to sit safely beside the panel:

- **Camera framing** — `fitBounds` had a flat 60px padding, so framing a firm
  parked its territory *under* the panel. `MapCanvas` now takes an `insetRight`
  (clamped to a third of the canvas so phones don't break).
- **Attribution** — maplibre puts it bottom-right, exactly where the panel now
  is; it measured ~9% visible with its "i" toggle unclickable, which ODbL
  attribution can't be. Moved to bottom-left.
- **The panel-toggle button** — it lived in the corner the panel now covers, so
  it renders only while the panel is closed; the panel header carries the
  collapse control.

Caught in review: raising the paint/place banner to z-40 so it stays visible on
phones made it **cover the panel-toggle button completely** — the banner is
wider than a phone, and the button measured 0% clickable at 375/390/430px,
stranding you in paint mode. Fixed by *positioning* it clear of that corner
below sm rather than relying on z-index, verified by hit-testing every pixel of
the button in headless Chromium (97.2% reachable at every width, 375→1440).
`onStartPaint` also collapses the panel on phones, as `startPlace` already did.
The map-failure banner moved to z-50 so the "screenshot this" diagnostic can't
be half-covered, and the shared tab strip scrolls horizontally — four labeled
tabs don't fit a 380px panel.

`TerritoriesClient` · `RepPanel` · `RepDetail` (new) · `RepDrawer` (removed) ·
`MapCanvas` · `components/ui/Tabs`.

## 2026-07-29 — Floating record drawer: the deal modal goes tabbed, and reps become clickable

Clicking a kanban card used to throw a center modal over the board and bury
everything in one ~88vh scroll. It's now a **floating right-hand drawer** —
inset from all four edges so the board stays visible beside it — with the
content split across **four tabs**: Overview (money, stage, fields), Comments
(quick-action loggers + the dated updates thread), Checklist (the 5 process
steps, finally out of that collapsed accordion, + follow-ups), and Activity.
Editing hides the tab strip and pins the drawer open, so a half-filled form
can't be abandoned by clicking away. Esc-while-editing cancels the edit; Esc
otherwise closes — one key can't do both.

Two new shared primitives back it, the first residents of `components/ui/`:
**`Drawer.tsx`** (scrim, Esc, body-scroll lock, Level-3 shadow in light and
`ring-white/10` with *no* shadow in dark, per DESIGN.md §5) and **`Tabs.tsx`**
(the canonical underline strip, replacing the hex-hardcoded `tabCx` for new
work). The drawer's scrim runs lighter than the modal recipe's `bg-black/40` —
at 40% the context behind is dimmed to the point that the "floating over your
work" read is lost, which is the whole reason to use a drawer.

**Territories reps are no longer dead text.** They were three lines with no
click target — only firms were selectable. A rep now opens the same drawer
(`RepDrawer.tsx`): Overview (stats + firm + an editable contact card),
Territories, Locations, and Notes. No Activity tab — there's no per-rep
activity table, and an always-empty tab is worse than none. Rep edits go
through a new `updateContact` → `PATCH /api/admin/deals/contacts/:id`.

Caught in adversarial review before shipping, all fixed: the drawer now
**portals to `document.body`** — `fixed` positioning does not escape an ancestor
stacking context, so inside territories' `z-20` aside the map's `z-30` toggle
button rendered *on top of* the drawer and unmounted it when clicked (confirmed
in Chromium at five viewport widths). **⌘K no longer takes the drawer with it**:
`CommandPalette` listens on `document` and the drawer on `window`, so Escape
closed both — the palette now consumes Escape only when it's actually open.
Plus real focus management (the panel claimed `aria-modal` without it), a
record-id guard so an activity POST resolving after ←/→ can't land in the wrong
deal's feed, a rep-reset effect keyed on `id` only (it was firing on every save
and bouncing you off the Notes tab), and `dark:text-rose-400` on the confirm-
delete state.

`DealDetailModal` · `RepPanel` · `RepDrawer` · `TerritoriesClient` ·
`CommandPalette` · `components/ui/{Drawer,Tabs}` · `tailwind.config.ts`
(drawer-in/scrim-in keyframes).

## 2026-07-21 — CRM Board: lanes actually pin to the viewport; narrower + Lost expanded

Follow-up on the full-page board. The lanes were still growing and scrolling the whole page because
the admin shell's outer is `min-h-screen` (a minimum, not a definite height), so the board's
`flex-1 min-h-0` chain had nothing to constrain against. Gave the CRM shell a **definite height** —
`h-[calc(100dvh-3.5rem)]` (viewport minus the `h-14` top bar) — so the stage lanes now hold the
viewport and **scroll internally**, page stays put. Also narrowed the lanes (268→244px) so **all six
stages fit across**, and **Lost now shows expanded by default** instead of the collapsed rail (still
collapsible). `DealsClient` + `BoardView`.

## 2026-07-21 — CRM Board goes full-page

The Board is now a proper full-height workspace instead of a card on a scrolling page. The CRM header
collapses into one slim bar: a **compact numbers strip** (Pipeline · Weighted · Open · Avg confidence,
open-deals only and rep-filter-aware) on the left, search + rep filters on the right, with the
Board/Focused/Calendar tabs and New Deal on the row above. The **stage lanes fill the entire screen
and scroll internally** — the page itself no longer scrolls — so you see 7–8 cards per lane at once and
dragging never fights a moving page. `DealsClient` became a fixed-height flex shell (Focused/Calendar
scroll within their own area); `BoardView` owns the stat bar and full-height internal-scroll lanes.
Cosmetic/layout only — data, drag-drop, and the lane/card design are unchanged.

## 2026-07-21 — CRM Board facelift

Restyled the kanban to match the portal's warm bento look. Each **stage lane** now carries its own
tone (a colored dot + a soft-tinted header band + count pill + lane total) — Lead slate · Quoted sky
· Follow-up amber · Verbal violet · Won emerald · Lost rose — so the pipeline reads as a real
left-to-right progression instead of six identical gray wells. **Deal cards** gained a confidence
meter (a thin tinted bar), a rep initials avatar in place of the blocky uppercase group tag, a more
prominent amount, and a quiet days-in-stage chip that appears (amber past 30 days) as deals age.
Purely cosmetic — drag-and-drop, the collapsed Lost rail, and the won/lost reason prompt are
unchanged. `app/admin/deals/BoardView.tsx`.

## 2026-07-28 — Dashboard: briefing folds into the welcome hero; Edit dashboard moves to the top bar

Two tidy-ups to the admin dashboard:

- **Executive Briefing folded into the greeting.** It was a full card (icon, an "Executive Briefing"
  title, an "AI-generated · live data" badge) sitting above the grid. Now the AI summary renders bare —
  no title, no badge — as a quiet line of context under "Welcome back", separated by a hairline: one
  block instead of two. Removed as a grid card (`ai_briefing`); any saved layout that still had it just
  drops it. Admin-only, as before. (`ExecutiveBriefing.tsx`, `DepartmentDashboard.tsx`, `dept-cards.tsx`)
- **"Edit dashboard" moved to the top bar.** The edit toolbar (Edit → Add card / Reset / Cancel /
  Save) now portals into the shared `AdminTopBar` actions slot on desktop, so it appears only on the
  dashboard page and sits with the rest of the top-bar chrome. Mobile keeps the toolbar inline above the
  grid (the top bar is hidden there). (`DashboardGrid.tsx`)

## 2026-07-28 — Sizing Studio: wheel sectors, purge and rotation

The engine described the wheel as a fixed ⅓ process:reactivation *airflow ratio*. DryWare
describes it the way the machine is actually built — as **sectors in degrees**, defaulting
to 270°/90°. Same 3:1, stated properly, and the difference matters as soon as a purge
sector exists.

- **Sectors are now degrees.** Airflow through each sector is proportional to its angle at
  a common face velocity, so 270/90 reproduces the previous behavior *exactly* (asserted,
  so no existing job silently re-sizes) while any other split works correctly. Sectors must
  cover the face: anything not totalling 360° is scaled proportionally and the scaling is
  disclosed rather than quietly producing airflow ratios no real machine has.
- **Purge.** A purge sector draws its angular share of air, and — because it shrinks the
  process sector — correctly *raises* the process face velocity, which is the constraint
  that governs wheel diameter. Routing the purge outlet into the reactivation inlet
  (DryWare's "autofill") recovers the heat the purge air picked up off the just-reactivated
  wheel, lowering the reactivation duty.
- **Rotation.** RPH now drives reported **dwell** — how long a point on the wheel spends in
  each sector — which is why rotation has an optimum rather than "faster is better".

Two honesty constraints held throughout. The purge heat-recovery credit is a **planning
estimate** (the true purge outlet temperature depends on wheel thermal mass and rotation,
which is exactly what DryWare's calculator models), so the un-credited duty is reported
alongside it and can be discounted. And an unset RPH falls back to a typical mid-range
value **flagged as suggested, not optimised** — DryWare optimises RPH against wheel
performance curves this Studio does not have. Rotation never touches the moisture maths;
a test asserts that changing RPH cannot change the selection.

Sizing suite 97 → 120.

## 2026-07-28 — Sizing Studio: the standalone calculators from DryWare

Ports the formula half of DryWare's calculator suite into `lib/hvac-calcs.ts`, surfaced as
a tabbed Calculators panel under the sizing result. Reference tools a rep reaches for
mid-job, deliberately separate from the inputs that drive the selection.

- **Duct** — one solver behind DryWare's three duct calculators, which are the same
  relationship entered from different corners. Give it any two of {CFM, diameter, velocity,
  friction} and it returns all four plus total loss over the run. The velocity+friction case
  (neither flow nor diameter known) has a closed-form solution, so no iteration.
- **Velocity / CFM**, **RPH ⇄ time**, **Bypass CFM**, **Coil widths**, **BTU ⇄ kW**.

Two of those carry the reasoning that makes them worth having:

**RPH is about dwell.** The calculator reports how long a point on the wheel spends in each
sector, because that is why rotation speed has an *optimum* rather than "faster is better" —
too fast and the desiccant never saturates or never fully regenerates, too slow and it
saturates and rides through into the process stream.

**Bypass exists because a wheel over-dries.** It dries well below most targets, so pushing
the whole airstream through wastes reactivation heat. Bypassing part and remixing hits the
target with a smaller wheel. The target must sit between the wheel outlet and the untreated
inlet; outside that the calculator says *unreachable* rather than silently clamping.

Duct friction uses the standard Wright/ASHRAE fit, verified against the sizing rules every
estimator knows — 400 CFM ≈ 10 in, 1,000 ≈ 14 in, 2,000 ≈ 18 in at 0.1 in.wg/100 ft, with
velocities landing in the normal commercial band. (My first two test references were wrong,
not the formula: a 12 in duct at 1,000 CFM is simply undersized at 1,273 fpm. Checking the
diameter at a *standard friction rate* is the better test and is what the suite now asserts.)

57 new checks in `scripts/verify-hvac-calcs.mjs`, each against a hand-computable case or a
published reference rather than against the implementation.

Not ported: DryWare's Desiccant Wheel Calculator (table-driven off performance curves we
don't have) and Ship Date (belongs with the CRM, not sizing).

## 2026-07-28 — Sizing Studio: live DryWare catalog + ASHRAE weather lookup

Two of the four gaps between the Studio and DryWare, closed.

**The catalog is now live.** The page fetches DryWare's product data at request time
(15-minute cache) instead of relying on the copy baked into `lib/sizing-catalog.ts`, so
it cannot drift when engineering adds or retires a product. Deliberately NOT a database
mirror: the endpoint needs no credential and the baked-in catalog is a complete current
copy, so a sync table would add a migration, a cron slot and a staleness question to buy
nothing. If DryWare is unreachable the Studio falls back to the built-in catalog **and
says so on the page** — a silent fallback to stale data is the exact failure mode this
codebase keeps getting bitten by. `calculateSizing()` now takes the catalog as an
argument rather than importing the constant.

**ASHRAE design conditions by city.** A city/state lookup pulls the nearest weather
station from DryWare and drops the design condition straight into the outdoor-air inputs,
along with the station elevation. It defaults to the **1% dehumidification** column, not a
cooling column — a dehumidifier is sized for the peak-MOISTURE hour, which is a different
hour of the year than peak temperature, and getting that wrong undersizes the job. ASHRAE
publishes the humidity ratio in grains, which is already one of the Studio's input modes,
so nothing is converted and no precision is lost. 1/2/4% percentiles are selectable.

Proxied through `/api/admin/sizing/weather` (same `sizing` perm) rather than called from
the browser, so the Studio never talks to DryWare directly.

Suite 86 → 97. The new checks prove the catalog argument is actually *used* (a deliberately
tiny two-size catalog must change the selection) and that the DryWare→CatalogSize mapping
collapses the duplicate 600 SKU while unioning its series.

## 2026-07-28 — Sizing Studio: real product data from DryWare

The Studio's catalog was hand-transcribed from the 2022 nomenclature sheet. DryWare — the
system engineering actually sizes in — exposes the real thing over an API
(`/api/Product/getProductsForProductType?id=4`), which is the same catalog its own wheel
calculator matches against. Ported it, and it corrected three things the Studio was
stating wrongly.

- **There is no 25,000 CFM product.** The nomenclature sheet lists it as a *size*; it is not
  a shipping *product*. The real line is 13 CFM values / 14 SKUs (600 ships as both
  `IAT-600` and `IAT-600REC`). A ~22,000 CFM job now correctly selects the 30,000 unit.
- **HC is a 400 mm rotor**, not an abstract efficiency bump. DryWare's rotor catalog offers
  100/200/400 mm depths and every standard unit ships 200 mm — so high-capacity is double
  the depth, i.e. roughly double the air-to-desiccant contact time.
- **Reactivation is 285 °F**, DryWare's own default and what the training material teaches.
  This said 270. Steam and hot water remain unconfirmed planning figures and are now
  labeled as such.

Every unit now carries its real `wheelDiameterMm`, `wheelDepthMm` and `effectiveAreaFt2`,
which makes a design rule measurable instead of assumed: **face velocity**. Every rotor from
1,000 CFM up sits in a tight 530–580 fpm band through the 270° process sector at nominal
airflow (compacts deliberately run slower). The Studio now computes the actual face velocity
for the selected unit, shows it, and warns past 600 fpm — too fast leaves the air too little
residence time in the desiccant and raises pressure drop.

**The test suite grew 66 → 86, and the reason is the point.** The full catalog rewrite above
passed all 66 existing checks unchanged — the suite was testing the *engine* and never the
*data* it selects from. The new checks lock the product facts, and they are mutation-tested:
reintroducing a 25,000 unit, reverting HC depth to 200 mm, or corrupting an effective area
each trip several failures. Reactivation now lands at ~2,246 BTU/lb (was ~2,068), still
mid-band of the 1,500–2,500 that desiccant systems run.

Still preliminary: the API gives geometry, not performance curves, so `predictLeavingState()`
remains the one place wheel behavior is approximated. See `docs/sizing-studio.md`.

## 2026-07-28 — Fix: SRV review audit log claimed customers were emailed when they weren't

`resend.emails.send()` does **not throw** when the API rejects a send — it resolves with
`{ data: null, error }`. `app/api/admin/srv-review/route.ts` wrapped the call in a
`try/catch` and set `emailed = true` on any non-throwing call, so every API-level rejection
was recorded as a success: `logAudit` dropped its `(customer email failed)` suffix and the
response returned `emailed: true`. **The audit trail asserted a customer had been told what
to fix before start-up when they never received anything.**

Verified against the live Resend API rather than assumed — a rejected send returns
`threw: false`, `data: null`, `error: { statusCode: 422, … }`. Old code recorded that as
notified; new code records it as failed.

The flag is now a three-state `emailStatus`, because "not sent" has two very different
causes and the audit trail has to tell them apart:

- `sent` — no suffix
- `failed` — `(customer email failed)`, set only when the API returns an error or the call throws
- `no_recipient` — `(no customer email on file)`, when the submission has no address

Previously the no-recipient case also logged "customer email failed" despite nothing being
attempted — misleading on its own, and a live trap because the address is read by field
*label* (`submission.data['Email Address']`), so renaming that field in the form editor
would silently produce "email failed" on every review. `emailStatus` is also written to the
audit `metadata`, and the response keeps a backwards-compatible `emailed` boolean (now true
only on a confirmed send). The try/catch is retained for genuine network faults, which do throw.

This matters today: with no `RESEND_FROM_*` set in Vercel, mail goes out from the
`onboarding@resend.dev` sandbox, which only delivers to the Resend account owner — so the
rejection path is the common one, not the rare one.

## 2026-07-28 — resend 3.5.0 → 6.18.1

Upgrades the email SDK three majors. This is the dependency behind every transactional
email — tickets, PTO, customer invites, digests, SRV reviews — so it was ground-truthed
against the actual v6 `.d.ts` files and verified at the wire level before landing, rather
than from changelogs alone.

**One source change was required.** v4 renamed the send payload's `reply_to` to `replyTo`,
and the old key is *not* an alias — v6's normalizer (`parseEmailToApiOptions`) reads only
`replyTo`, so a stale name is dropped on the wire with no error and a successful-looking
`{data:{id},error:null}` response. The repo had exactly one occurrence, in
`app/api/tools/duct-traverse/email/route.ts`. It was a fresh inline object literal, so
`tsc` caught it (TS2561).

⚠️ **The type check only protects inline literals.** TypeScript's excess-property check does
not fire on a payload built as a variable or assembled with a spread — those compile clean
and silently drop the field. Keep resend payloads as inline literals at the call site.

Everything else was already compatible: no `react:` prop anywhere, the one attachment passes
`{filename, content}` and never `content_type` (also renamed), no code reads `error.name` or
`.statusCode`, and the `result.data?.id` pattern still compiles under v6's discriminated-union
response. Verified live against the Resend API with a read-only `domains.list()` call — the v6
client authenticates and returns the new `{data, error, headers}` shape correctly.

**Dependency effect — 0 added, 1 changed, 52 removed.** v6 drops `@react-email/render`, taking
`js-beautify`, `editorconfig`, `html-to-text` and `glob@10` with it. That removes both
`minimatch@9` copies and both `brace-expansion@2.1.3` copies, so the GHSA-mh99-v99m-4gvg
exposure on the *email* path is gone (`npm audit` 17 → 13 high). What remains is
`brace-expansion@1.1.16` under eslint, which still has no patched release on the 1.x line —
but removing the runtime path reclassified alert #39 from `scope=runtime` to
`scope=development`, and GitHub **auto-dismissed it**. The repo is now at **zero open
Dependabot alerts**.

Pinned to `6.18.1` deliberately rather than `@latest`: every finding above was verified against
that exact version, and `parseEmailToApiOptions` is a hand-maintained key allowlist, so a future
minor could drop a field with no type error. The lockfile diff was reviewed and confined to the
resend subtree.

## 2026-07-28 — Security: postcss and brace-expansion advisories

Two high-severity Dependabot alerts.

**postcss (GHSA-r28c-9q8g-f849, path traversal via `sourceMappingURL`) — fixed.** Bumped the
direct dev dependency and the `next`-scoped override to `^8.5.18`; the whole tree now resolves to
a single postcss 8.5.24. Not runtime-reachable here regardless: the one path that could feed
user input to postcss is `sanitize-html` parsing `style` attributes, and `lib/sanitize.ts`
strips `style` entirely (no `allowedStyles`), so only our own build-time CSS is ever parsed.

**brace-expansion (GHSA-mh99-v99m-4gvg, unbounded-expansion DoS) — partially fixed.** Upstream
patched **only the 5.x line** (5.0.8), but the advisory range is `<= 5.0.7`, which also covers
the 1.x and 2.x copies in the tree. A blanket `brace-expansion` override is **not** viable —
5.x changed its export shape, and forcing it breaks every older consumer:

```
minimatch@3.1.5  ->  expand is not a function
minimatch@9.0.9  ->  (0, brace_expansion_1.default) is not a function
```

`npm audit` reports "0 vulnerabilities" in that state, so it would have shipped silently broken —
including on `resend -> @react-email/render -> js-beautify -> editorconfig -> minimatch@9`, which
runs when emails render. The override is therefore **version-scoped to `minimatch@10`**, which is
the only consumer written against brace-expansion 5.x. All six minimatch copies in the tree are
verified to still brace-expand correctly.

Left in place deliberately: brace-expansion 1.1.16 (eslint, dev-only — `next lint` isn't even
configured here) and 2.1.3 (editorconfig, via resend's old `@react-email/render`). Neither takes
attacker-controlled input — the patterns come from our own config and build files — and there is
no patched release on either line to move to. The real fix for the 2.x branch is upgrading
**resend 3.5.0 → 6.x**, which drops `@react-email/render` altogether; that is a three-major bump
of the SDK behind every portal email and wants its own change plus a send test.

## 2026-07-28 — Sizing Studio: psychrometric dehumidifier selection

New `/admin/sizing-studio`. Enter a job's design conditions — airflow (or room volume × air
changes), entering/target/outdoor conditions, outside-air fraction, altitude, internal moisture
load — and get a recommended IAT unit, the predicted leaving-air condition, the moisture-removal
duty and the reactivation energy, plotted on a live psychrometric chart. Pure calculator: no
reads, no writes, recalculates as you type.

Three layers, each replaceable on its own:

- **`lib/psychro.ts`** — ASHRAE Fundamentals (2017) Ch.1 in IP units: saturation pressure over
  water *and* ice, humidity ratio, grains, dew point, wet bulb, enthalpy, specific volume,
  pressure vs. altitude, adiabatic mixing. Dependency-free and side-effect-free.
- **`lib/sizing-catalog.ts`** — the product line as typed data, transcribed from the 2022
  nomenclature sheet, plus a model-number builder **and parser** (the parser decodes any IAT
  model number, so it's reusable against the free-text `model_number` on equipment records).
- **`lib/sizing.ts`** — the selection logic: mix in outside air, pick the wheel, predict the
  leaving state, size airflow as `max(circulation, load)`, select the catalog size, compute
  reactivation duty. Altitude is honoured throughout — the chart's own curves shift with it.

**The psychrometrics are exact; the wheel performance is not.** IAT's real rotor curves live in
the DryWare calculator, not this repo, so wheel behavior uses planning coefficients (80%/90%
removal, derated by reactivation temperature). Every result is stamped **Preliminary** in the UI
and in the copied summary, and engineering confirms rotor performance before a submittal. When
the real curves land, `predictLeavingState()` is the only function that changes.

Verified by two scripts — 40 checks against published ASHRAE values and 66 on the engineering
logic, including all 224 model-number round trips and a 648-case sweep asserting the wheel never
adds moisture, never cools and never returns NaN. Independent corroboration: reactivation lands
at ~2,068 BTU per lb of water on the baseline job, mid-band of the industry's 1,500–2,500, which
the engine has no knowledge of.

Gated by a new `sizing` permission — admin-only by omission, like the SRV editor, so no
migration or `role_permissions` seed was needed. See `docs/sizing-studio.md`.

## 2026-07-27 — Customer bridge complete: tickets, Jerry, attachments and SRV

Finishes the bridge, so every customer surface now works from the split deployment. Eleven more
endpoints under `/api/bridge/*`, all reusing the existing internal logic rather than
reimplementing it:

- **Tickets** — detail + public reply thread, post a reply, advisory mark-resolved, contact
  prefs. Staff identity is stripped (a public note is "IAT replying"); resolve never touches the
  staff-owned status enum; contact updates are built field-by-field so a customer can't reach
  `status` or `owner_id`.
- **Attachments** — signed upload/download against the internal private bucket. The download
  endpoint adds a **public-note membership check** the internal routes don't have: today an
  owning customer is kept out of an internal-note attachment on their own ticket only by the
  path being unguessable, which is secrecy rather than a check.
- **Jerry** — runs entirely internally and returns only the finished answer, so the Anthropic
  key, the RAG pool, the `is_internal` exclusion and the competitor scrub never leave this
  deployment. The transcript is validated and capped; the company name is looked up here rather
  than accepted, since it lands in the system prompt.
- **SRV** — bootstrap (sections + units + prefill + revision in one call, so they can't
  disagree), live config, photo upload, submit/revise, and list. Photos go to *this* project's
  `form-uploads` bucket because submit validates them against the internal host.

Ownership is re-checked internally on every call; "not yours" and "doesn't exist" both return
404 so ids can't be probed. Verified live end-to-end with signed requests, including a
cross-tenant probe that correctly returns 404. See `docs/customer-bridge.md`.

## 2026-07-27 — Support flow: light/dark toggle, home link, and a leave-guard

Release polish for the public `/support` customer flow:

- **Light/dark toggle** (Sun/Moon) now sits top-right on every customer-facing support
  screen — the landing, the ticket form, status lookup, and the KB index + articles. It
  reuses the shared `ThemeToggle`; default still follows the visitor's OS setting.
- **Home access**: the IAT logo in the support form header (and a standalone Home button next to
  the light/dark toggle — gray tile with a green icon that inverts to a green tile on hover)
  return to `/support`. The customer portal (`/customer`) is back-burnered and out of this
  release, so the support flow never routes there.
- **Leave-guard**: navigating away mid-form now confirms first ("Leave and lose your
  answers?") when there's unsaved progress — nothing is stored until *Submit Ticket*.

reCAPTCHA v3 is fully wired (client + server, fail-open) and confirmed **live** in production —
both `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` are set in Vercel prod.

## 2026-07-27 — One breadcrumb bar: detail pages fold into the top nav

Clicking into a record (Operations → Equipment → a unit) used to stack a *second* breadcrumb bar
under the shared `AdminTopBar`: one showing `Operations › Equipment`, another showing
`Equipment › 26-5875` with the page's Save/Delete/Print buttons. Now there is one bar — the top nav
reads `Operations › Equipment › 26-5875` (with **Equipment** clickable back to the list) and holds
the page's actions.

- New `app/admin/PageChrome.tsx` + `app/admin/crumbs.ts` (the `ROUTES`/`crumbsFor` map, lifted out
  of `AdminTopBar` so both share it). A detail/editor page drops in
  `<PageChrome record={…}>{actions}</PageChrome>`: the record crumb is fed up into `AdminTopBar`
  (via context) and the action buttons are portaled into a new `#admin-topbar-actions` slot. On
  mobile — where `AdminTopBar` is hidden — `PageChrome` renders its own sticky bar (list crumb +
  record + actions), so **mobile is unchanged**.
- Migrated all 16 stacked admin bars: the 8 `DetailTopBar` detail pages (submissions, tickets,
  equipment, employees, customers, troubleshooting, tool crib, forms tally), the production
  department/project pages, the Presentations and SRV editors, and the four redundant static bars
  (Permissions, Ask Jerry, Jerry's Brain, Customer Jerry) whose crumb the top bar already showed.
- `DetailTopBar` stays in `components/admin/detail-ui.tsx` for the customer ticket page, which has no
  shared top bar and never stacked.
- Presentations: the editable deck title + Save/Present now live in the one top bar; the breadcrumb
  reads `Sales › Presentations`.

The `/learn` surface has a similar generic-bar-over-inline-breadcrumb stack; it uses a different
top-bar mechanism (`PortalTopBar`) and is left for a follow-up.

## 2026-07-27 — Customer portal provisioning: the split portal can finally have accounts

The customer portal has its own Supabase project, so a customer invited here didn't exist
there — the new portal was a working shell with no way to create a login. This adds the one
internal→customer write that fixes that, and wires it into the whole customer lifecycle:

- **invite / re-invite** → provisions the login on the customer portal with the *same* temp
  password the welcome email already carries, so the credentials in that email work on either
  portal during the dual-run.
- **remove portal access** → deletes the logins there too. "Removed from the portal" has to mean
  both portals or it means nothing.
- **hard delete** → deletes the mirrored login and company row. This is the one that must not be
  missed: leaving a login whose company no longer exists recreates the orphaned-session
  redirect loop this app already fixed once.

New `lib/customer-portal.ts` signs the call (same HMAC contract and shared secret as the inbound
bridge, one secret both directions) and the customer app verifies it in `/api/provision`, which
fails closed when the secret is unset. Provisioning is best-effort at each call site — the
internal account is already usable by then, so a failure never fails the invite — but every call
site records the outcome in the audit log (`customer_portal_provisioned`) and the remove/delete
routes return a flag, so divergence between the two systems is always traceable.

Also adds `scripts/backfill-customer-portal.mjs` (`--dry-run`, `--all`) to provision existing
customers through that same endpoint. Backfilled accounts get a fresh temp password that is
**not** emailed — the point is to get accounts in place so the bridge can be exercised, not to
send credentials weeks before cutover. Needs the new `CUSTOMER_PORTAL_URL` env var; without it
provisioning is skipped and logged, and invites keep working exactly as before.

## 2026-07-27 — Company Home & login: team-feedback fixes

Six fixes from the team's notes, across the Company Home (`/home`) and the login screen:

- **Notifications bell no longer falls behind the page.** The scroll region below the home/admin
  top bar is its own stacking context (`isolate`); the bars now carry `relative z-40`/`z-30` so the
  bell dropdown paints above the content (`app/home/HomeTopBar.tsx`, `app/admin/AdminTopBar.tsx`).
- **"Have an idea" is now a brand-tinted pill** instead of a faint ghost button, so it stands out
  from the other top-bar icons.
- **Home hero quick-links work for every role.** "Submit a form / Request time off / Team directory"
  point at `/employee/*`, which middleware bounced every admin-surface role away from (dead-ending
  on `/admin`). A new `EMPLOYEE_SELF_SERVICE` allowlist in `middleware.ts` lets any signed-in staffer
  reach those self-service pages; all other `/employee/*` paths still funnel admins to `/admin`.
- **Login restacked** so **Microsoft SSO is the primary action** (solid dark button on top); email +
  password moved below an "or sign in with email" divider as a secondary outline button. Password
  sign-in is unchanged.
- **Core Value of the week** moved from the footer to directly under the hero and is now
  **clickable → a modal of all values**.
- **Holidays & open roles are clickable.** The "Next holiday" KPI and the This-Week holiday chip open
  an all-upcoming-holidays modal (new `upcomingFederalHolidays()` in `lib/home-data.ts`); the "Open
  roles" KPI, the Open Positions header, and each listed role link out to `dehumidifiers.com/jobs`.
  New client module `app/home/home-modals.tsx` holds both modals.

No DB / permission / migration changes.

## 2026-07-27 — Housekeeping: Presentations → Internal Apps; typeface → Nunito Sans

Two small cleanups:

**Presentations left the Sales nav group.** It's now the first entry on the
**Internal Apps** launcher (`/admin/tools`) — an in-app link (not a new-tab HTML
app), gated by the `presentations` perm so a `tools`-only user never sees a dead
link. The shared employee tools list (`/employee/resources/tools`) is unchanged.
No perm/migration change: `presentations` already existed and `/admin/presentations`
stays gated as before.

**Portal typeface is now Nunito Sans** (was Inter) — a geometric-humanist sans used
as a freely-licensable stand-in for Avenir. Swapped centrally: the `next/font` import
(`app/layout.tsx`, now exposed as `--font-sans`), the Tailwind `sans` stack, the
`globals.css` body, and the embedded-form layout (`/forms/[slug]/embed`). Same weights,
sizes, and tokens — only the letterforms change. Transactional email templates still name
Inter in their fallback stack (mail clients render Arial regardless, so it's a no-op there).

## 2026-07-27 — Territory Map: rendering fixes + Mapline data import

Two silent-blank-map bugs fixed post-launch: (1) maplibre v6's render worker never
loaded under webpack (`import.meta.url` inlined as a build-machine `file:///` path) —
the worker is now vendored into `public/maplibre/` and pinned via `setWorkerUrl`
(`scripts/sync-maplibre-worker.mjs`, prebuild); (2) maplibre's own CSS flips the map
container to `position: relative` after Tailwind loads, collapsing it to 0 height —
container positioning is now inline styles. Also: panel search overflow fix, breadcrumb
entry, and on-page surfacing of map-engine errors.

Map theme polish: the basemaps are near-monochrome by design (color comes from the
translucent territory fills), so a theme change briefly drops the fills while the basemap
reloads. Removed the avoidable version of this — the map used to boot on the light basemap
and then swap to dark for dark-mode users (a "colors → black-and-white → colors" flash on
every load); it now initialises on the correct basemap. Dark-mode fills are also more opaque
so territories stay clearly colored on the near-black map.

Panel scrolling fixed: the rep list is tall, and the admin shell root grows with
content (`min-h-screen`), so scrolling the list scrolled the whole page (map and all)
instead of just the list. The panel now renders out of page flow (`absolute inset-0`
inside a positioned `<aside>`, the same technique the map canvas uses) so it scrolls
internally and the page stays put.

Camera behavior fixed too: clicking a pin used to re-frame the map to the firm's whole
multi-state footprint (jumping a couple of states away, and zooming *out* because
`fitBounds` caps at zoom 7). Pin clicks now zoom **in** on the clicked pin, fill clicks
identify the owner without moving the camera, and re-framing a whole footprint is an
explicit action ("Show all" in the firm panel, or picking the firm from the list).

Then the Mapline roster was imported (`scripts/import-mapline.mjs`, curated data kept
out of this public repo): 34 rep firms, 71 territory assignments (incl. real
county-level for LJ Early: 20 NY counties + Berkshire MA + VT), 54 office pins, all
geocoded city-level. Personal contact details deliberately withheld. See
[docs/territory-map.md](docs/territory-map.md).

## 2026-07-27 — Territory Map: rep firms & territories on a live map (replaces Mapline)

New `/admin/territories` (Sales → Territories): an interactive US + Canada map — real
street-level basemap (MapLibre + OpenFreeMap, free, no API key) — where Sales tracks which
rep firm owns which state, province, or **county**, with clustered pins at rep locations and
a flat Reps directory. Replaces the $1,700/yr Mapline subscription.

- Built on the dormant CRM layer (062): firms are `companies` (`kind='rep_firm'`), reps are
  `contacts`. Migration 068 adds `company_territories` (overlap allowed, per-assignment
  `exclusivity` note), `company_locations` (pins; click-to-place + drag, no geocoder), and
  `companies.map_color` (curated palette, auto-assigned).
- Access shares the `deals` perm (no new seed); **editing is admin + sales roles only**
  (`requireTerritoryAuth({ write: true })`). All writes audit-logged (`territory.*`).
- Boundaries are committed public-domain TopoJSON (`public/geo/`, `scripts/build-geo.mjs`);
  counties (~1.7MB) lazy-load on first use. Dark mode swaps to OpenFreeMap's dark style.
- Sensitive personal rep data (home addresses, personal phone/email) deliberately not
  imported yet; the Mapline roster import lands as a phase-2 script.

See [docs/territory-map.md](docs/territory-map.md).

## 2026-07-27 — Favicon: white IAT mark on a deep-pine tile

Added a real browser favicon (`app/icon.png`, auto-detected by Next 15): the white IAT
logomark centered on a deep-pine (`#0e1a14`) square — the same treatment the logo already
has on the sidebar. A bare white-on-transparent logo is invisible on light browser tabs, so
it sits on the tile. The customer portal (`iat-customer`) got the same icon.

## 2026-07-24 — Sign in with Microsoft (Entra ID SSO) for staff

Staff can now sign in with their `@dehumidifiers.com` Microsoft account from `/login`, beside
the existing email/password form. Additive only — middleware role-routing, RLS policies and
the customer password flow are untouched. MFA is inherited from the tenant's Entra Conditional
Access policy; there is nothing portal-side to build for it. See
[docs/microsoft-sso.md](docs/microsoft-sso.md).

Two gates in `/auth/callback`, both reading the **verified session** rather than any URL param,
so neither can be spoofed by editing the callback URL:

- **Domain** — the returned email must end in `@dehumidifiers.com`. Defence in depth behind the
  single-tenant Entra app registration, and it fails closed on a *missing* email (with only the
  `openid` scope Entra returns no email claim, and "no email" must never read as "allowed").
- **Provisioning** — the account must already carry an `email` identity, i.e. it was created by
  an admin invite. This is load-bearing: the trigger from migration 002
  (`handle_new_user_profile`) creates a `profiles` row at the `employee`/`production` tier for
  **every** new `auth.users` row, and since the portal consolidation `production` is an
  admin-surface role. Without this gate any member of the M365 tenant could click the button and
  silently self-provision a working portal account.

Account linking was verified against the live project rather than assumed: Supabase **does**
auto-link by verified email, so an existing staff member keeps their role and history on first
Microsoft sign-in (no duplicate or role-less profile).

Also here: `login_events.method` gains `'microsoft'` (no migration — plain text column, no CHECK
constraint); `/login` now renders the `?error=` codes the callback redirects back with, which had
previously been swallowed silently; and Microsoft sign-in carries a `?redirect=` deep link through
the round-trip, validated by `safeRedirect` on both sides.

## 2026-07-24 — Customer bridge: serve the customer portal without giving it the database

Phase 2 chunk C. The customer portal now lives on its own deployment and its own Supabase
project (`iat-customer`), so it holds **no credential to this database**. These four endpoints
under `/api/bridge/*` are the only path between the two systems — everything IAT authors
(equipment, milestones, tickets, KB) stays here and is served on request:

- `equipment` — the customer's units + milestones + warranty state, computed with the existing
  `lib/equipment.ts` / `lib/customer.ts` helpers so both portals can never disagree about a
  warranty date.
- `tickets` — "My Requests" (tickets + historical troubleshooting intakes), merged and sorted.
- `kb` — published KB articles for the dashboard rail.
- `warranty` — file a claim (the first customer→internal write), reproducing the existing route
  including the one-pending-per-unit idempotency.

Auth is a new `requireBridgeAuth` guard (`lib/bridge-auth.ts`): HMAC-SHA256 over
timestamp·method·path·body, timing-safe compare, a 5-minute freshness window so a captured
request can't be replayed, and **fail-closed when `INTERNAL_BRIDGE_SECRET` is unset** (an empty
secret would otherwise verify every unsigned request). Its own named guard, per the
one-guard-per-surface convention in `lib/api-auth.ts`.

Every endpoint lists columns explicitly — the internal pages can afford `select('*')` because
their view mapping runs before the RSC boundary, but a JSON bridge has no such backstop.
**Security narrowing:** the tickets bridge derives the match email from the customer's own
record instead of trusting a caller-supplied one, and re-filters results to drop any row linked
to a different customer. A caller-supplied email would let a compromised customer deployment
read another company's tickets. Inert until the secret is configured. See `docs/customer-bridge.md`.

## 2026-07-21 — CRM Calendar: add your own events

Sales can now add calendar items directly instead of relying only on the auto 2-week
follow-up. A **New event** button (and a per-day "Add event") on the CRM Calendar opens a composer
— date, event text, and an optional deal to link it to. Events with no deal are **standalone**
(migration `064_calendar_events.sql` makes `deal_follow_ups.deal_id` nullable) and, unlike deal
follow-ups, **survive DryWare syncs** — a deal follow-up cascade-deletes if its project is pruned
from the feed, so standalone events are the right home for meetings, trade shows, and general
reminders. Standalone events render on the calendar labeled by their text with an "event" tag.

## 2026-07-24 — Security: customer ticket detail no longer ships internal columns to the browser

The customer ticket detail page (`app/customer/tickets/[id]/page.tsx`) fetched the ticket row with
`select('*')` and passed it into a `'use client'` component, so every column — including
internal-only `owner_id`, staff `notes`, `resolved_reason`, `ai_recommendations`, and
`viewed_kb_articles` — was serialized into the RSC/Flight payload delivered to the customer's
browser, even though the UI never rendered them. Replaced the wildcard with an explicit
customer-safe column allow-list (the fields the detail component actually reads, plus `customer_id`
for the server-side ownership check). The dashboard ticket LIST was already safe (it maps to a
narrow subset) — only the detail page leaked. Found during the Phase 2 customer-portal
data-boundary audit; the read bridge will re-enforce this allow-list server-side.

## 2026-07-24 — reCAPTCHA v3 on all public forms (invisible, frictionless)

Extended the invisible reCAPTCHA v3 (already on the support ticket form) to **every public / anonymous
submit path**, so bot spam is scored + gated with **zero user friction** — no checkbox, no image
puzzles. Covered: **`/api/submit`** — the entire dynamic forms engine (PTO, sick, IDP, performance /
annual review, and every other builder form), via both `StepFormModal` and the embed `FormRenderer`;
**`/api/tickets/request-account`** (anonymous portal-access requests); and the two public AI POSTs
reachable from the support wizard — **`/api/ocr-label`** (nameplate OCR) + **`/api/tickets/analyze`**
(pre-submit tips). Extracted the token logic into a shared **`components/use-recaptcha.ts`**
(`getRecaptchaToken(action)` — lazy-loads the script, deduped, fail-open), and each route verifies
server-side via the existing `lib/recaptcha.ts` (score ≥ 0.5 + action match). **Gated forms**
(logged-in employee PTO, US Rotors, customer portal) were intentionally **skipped** — the login already
stops bots there. Fails open throughout (a missing key or a Google outage never blocks a real
submission); `analyze` degrades to empty tips, `ocr-label` to manual entry. This also hardens the open
"anonymous submissions" surface without dropping the public form-fill path.

## 2026-07-23 — Admin dashboard is customizable too (executive widgets → cards)

The admin **executive dashboard is now the same per-user customizable card grid** as the department
dashboards: admin gets the **"Edit dashboard"** button (add / remove / reorder / resize) while keeping
its full richness. The ~9 executive widgets — **AI Briefing, 14-day Activity, Forms Performance, Top
Forms, Top Submitters, Form Status, Needs Attention, Live Activity, Admin Activity** — are ported into
the card registry as admin-only cards reading one shared `getExecData()` batch; the admin default
layout reproduces the old executive arrangement, and the KPI strip shows the executive metrics. **Every
admin-surface role now lands on the same customizable grid** (Sales keeps its dedicated command center;
View-as previews any role). The old cookie-backed layout presets + the top-bar view-switcher are
**retired** (superseded by the card editor). New: `lib/exec-dashboard-data.ts` +
`components/dashboards/exec-cards.tsx`; `app/admin/page.tsx` drops ~850 lines of inline dashboard and
becomes a small role router.

## 2026-07-23 — View-as now previews each role's actual dashboard

"View as [role]" previously re-skinned only the sidebar — the `/admin` page still rendered your own
(admin) dashboard, so a preview didn't show what that role actually sees. It now swaps the whole page:
selecting a role writes a short-lived `va_role` cookie and refreshes, and `/admin` renders **that
role's dashboard, read-only** (scoped roles → their department dashboard at its default layout; Sales →
the Sales command center; base production → a short note). Access is unchanged — middleware + guards
still use your **real** session role, so a preview can never grant reach or lock you out, and "Exit
preview" clears it. The admin's own executive dashboard is unchanged for now (its editor is next).

## 2026-07-23 — Portal consolidation (Phase 1): base staff land in /admin, phasing out /employee

First step of collapsing three portals (`/admin` + `/employee` + `/customer`) toward two (one
employee portal, one customer portal). The base `production` tier — everyone from President down to
Production Associate who used to live in the `/employee` shell — is now an **admin-surface role**:
it signs in and lands on `/admin/home` (the shared Company Home) like every other internal role,
under one roof. `isAdminSurfaceRole()` now returns true for `production`; per-section `/admin`
access is unchanged (still gated by the `role_permissions` matrix), so a permless production user
reaches only the always-open `/admin/home` + `/admin/profile` and every other `/admin/*` path
fail-closes to a 302 — **no new permissions were granted, no migration needed**. The strict
`getAdminUser()` write gate and the scoped `.can(perm)` write-actors are untouched, so no write
access shifts. The `/employee/*` routes stay alive and reachable by `production` (its self-service
pages — My Board, directory, time off — aren't ported yet, so middleware deliberately no longer
bounces production out of them); only the 5 scoped roles + admin are bounced to `/admin`. The
first-time set-password **welcome flow** still runs for new `production` invites, then lands them in
`/admin`. Login + auth-callback redirects and the employee welcome page were updated to match.
Next: triage/port the remaining `/employee` self-service pages, then Phase 2 (customer portal onto
its own deployment + database). No customer-facing change.

## 2026-07-23 — Build your own dashboard: per-user card add / remove / reorder / resize

Department dashboards (hr / marketing / engineering / production_manager) are now **customizable per
user**. An **"Edit dashboard"** button turns the grid into an editor: **drag cards to reorder**
(dnd-kit), toggle each card's **size** (S / M / L → 1–3 columns, auto-reflowing), **remove** cards,
and **"Add card"** from a picker of every card your role can see. **Save** persists your arrangement;
**Reset** restores the department default. Layouts are stored per user (migration **067**,
`dashboard_layouts`, RLS own-row) and validated server-side against the card registry **and your live
permissions** — a saved layout can never surface a card you lack permission for, and spans are clamped
to each card's allowed sizes. A user with no saved layout sees the exact department default, so there
is **no visible change until you customize**.

Built on a new declarative **card registry** (`components/dashboards/dept-cards.tsx`): each card is a
self-contained, permission-gated async renderer (Key Metrics, Recent Tickets / Submissions / Time-off /
Presentations, Tickets-by-status, Quick Links, Your Workspace). The server renders every card the role
can access and hands them to the client `DashboardGrid`; editing only rearranges — data never
re-fetches until reload. New dependency: `@dnd-kit`. The admin executive + Sales dashboards are
unchanged. Preview per role via View-as.

## 2026-07-23 — Department dashboards: each scoped role gets its own warm bento

Rebuilt the scoped-role landing page (`DepartmentDashboard`, served to **hr / marketing /
engineering / production_manager** on `/admin`) onto the same warm "Quiet Precision" bento as the
exec + Sales dashboards: warm `bg-canvas`, hairline cards (no resting shadow), semantic tokens,
colored **Tone-chip KPIs**, an emerald-glow greeting hero, and the shared `sales-charts.tsx`
primitives. Cards stay **permission-gated from a declarative catalog** (grant/revoke in
`/admin/permissions` reshapes the page, no code change), now with: real-count KPIs + a universal
"Team" tile, a recent-activity list, a **Tickets-by-status donut** for roles that can see tickets,
an enriched quick-links grid (now including Jerry + Internal Apps), and an always-on **"Your
workspace"** snapshot so thin departments (marketing/engineering) still read as a complete page.
Dropped the page's own breadcrumb bar (the shared AdminTopBar already carries it). Admins can
preview each department via View-as. This declarative card catalog is also the substrate a future
"build your own dashboard" would sit on. Follow-on to the #26 dashboard bento port.

## 2026-07-23 — Admin dashboard: ported to the "Quiet Precision" warm bento

Brought the **admin executive dashboard** (`/admin` for full admins) onto the same token-correct,
warm bento design language as the shipped Sales command center. It previously ran on raw
`zinc-*`/hex colors, `font-bold`, and resting `shadow-sm` cards; it now uses the semantic token
system throughout — warm `bg-canvas`, hairline-bordered `bg-surface` cards with **no resting
shadow**, `text-ink`/`-secondary`/`-muted`/`-faint`, and the shared presentational primitives in
`components/dashboards/sales-charts.tsx` (`Card`/`CardHead`/`CardBody`/`Kpi`/`Donut`/`DonutLegend`).
KPIs are now clean colored **Tone-chips** (sky/violet/amber/rose/emerald/slate) that still link
through to their pages; the greeting card adopts the shipped **PortalHero** emerald-glow warmth;
the 14-day activity line chart and tickets donut were re-tinted to token colors. The
`ExecutiveBriefing` card got the same token pass. Extended the shared `CardHead` with an optional
"View all" action link (backward-compatible — the Sales dashboard renders unchanged). No data or
behavior change: `getData()`, the three cookie-backed layout presets + top-bar view-switcher, and
the sales/scoped-role dashboard branches are all untouched. Audit L-tier item #26.

## 2026-07-23 — SUPER IMPORTANT SOFTWARE™: reverted to the original (whole-image) dance

The limb-articulated clapping rig still read as choppy on the shoulders (no way around it with
a single flat source image — there's no pixel data for "behind the arm"). Reverted the tool to
the original build (commit 8571c7d): whole-image squash-and-stretch dance (Church Clap / Happy
Bounce / Hip Twist / Wiggle) with popping musical notes — no arm-cutting, so no shoulder
artifacts. Transparent-GIF and MP4 exports unchanged. The two rig versions below are kept in
history (and in git) in case we revisit it. Static asset only.

## 2026-07-23 — SUPER IMPORTANT SOFTWARE™: cleaner clap (no more "ripped-off arms")

Per feedback that the first clap looked choppy — like the arms were torn off with cut
shoulder blades. Fixed the rig's seams: the arm cut-edges are now **feathered** (no
"cut-paper" hard edges), a soft **rounded-shoulder fill** sits behind the body so the armless
torso reads as smooth rounded shoulders instead of a hard notch/stub, and the clap angles were
retuned so the paws **clasp together** in front instead of crossing past each other like stiff
paddles. Verified frame-by-frame (rest reassembles to the original; clap and mid-swing are
clean). Rebuilt bundle; static asset only.

## 2026-07-23 — SUPER IMPORTANT SOFTWARE™: real limb-articulated clapping

Upgraded the dancing hippo from whole-image squash-and-stretch to a **2D puppet rig**: the
two arms are cut into separate layers with shoulder pivots (edge-dilated masks so they tile
back with no seam or ghost), the body behind them is patched with purple, and the **Church
Clap** move now swings the arms in so the paws actually meet in front of the chest — a real
clap, with a sparkle burst at the point of impact. The other moves (Bounce/Twist/Wiggle) got
gentle arm swings from the same rig. Rebuilt bundle; no portal-code change (static asset only).

## 2026-07-23 — Internal Apps: "SUPER IMPORTANT SOFTWARE™" (dancing hippo, for laughs)

Added a (tongue-in-cheek) internal app to the **Internal Apps** launcher for a VBS project:
a browser studio that makes the purple inflatable-hippo mascot **dance**. Pick a move
(Church Clap, Happy Bounce, Hip Twist, Wiggle), tune tempo/energy, and export either a
**transparent looping GIF** — the drag-and-drop-into-slides asset (GIFs are the only
animated+transparent format both PowerPoint and Google Slides honor) — or an **MP4 video**
with a chosen background.

Fully self-contained static page at `public/tools/super-important-software.html` (inlines the
`gif.js` encoder, its worker as a Blob URL, and the hippo PNG as a data URI — zero external
requests), gated to signed-in staff by the existing `/tools/*` middleware, listed via
`lib/tools.ts` with a `Mission-Critical` tag. Source studio lives outside the repo at
`~/hippo-dance`. The hippo's white background is removed at load with an edge flood-fill (keeps
interior whites — teeth, paws); the dance is beat-synced squash-and-stretch with popping
musical notes.

## 2026-07-23 — Fix: Company Home no longer shows two top bars

The shared `AdminTopBar` (added to every `/admin` page) was stacking on top of the Company
Home page's own `HomeTopBar`. `AdminTopBar` now returns null on `/admin/home`, so that page
shows just its own bar — mirroring how the employee shell suppresses its bar on
`/employee/home`.

## 2026-07-23 — One-card list pattern rolled out to every admin list

Extended the one-card list pattern (shipped on Performance) to all remaining `/admin` list
pages, via a new shared kit `components/admin/list-card.tsx` — `ListCardPage`, `ListCard`,
`CardHead`, `StatStrip`/`Stat`, `Toolbar`, `CardTable`, `Row`, `SortHeader`,
`Pagination`/`usePagedList`, `FilterDropdown`, `ListSearch`, `ToneAvatar`, `TagPill`,
`Meter`. The three alignment gotchas (`w-full` rows, `overflow-y:hidden` table wrapper, and
NOT `overflow-hidden` on the card) are **baked into the components** so they can't be missed.

Converted — client-side pagination (default 10), colored avatars, tone pills, semantic
tokens, existing behavior preserved: **Submissions, Tickets, Employees, Customers, Equipment,
Tool Crib, Production, Gantt, PTO/Sick requests, Accrual, Audit, Presentations, US Rotors
Orders**. The **CRM (Deals)** view is a kanban board, not a table, so it got the header/shell
only — the Board / Focused / Calendar views are untouched. Submissions and the Audit "Emails"
tab keep their existing **server-side** pagination (they page/filter server-side; client
slicing would desync the counts).

Known follow-ups (non-blocking): on rows that carry inline controls (Tickets/Submissions
selection checkbox + kebab), the control nests inside the row `<Link>` — works in every
browser, but a future `Row` "stretched-link" variant would make it valid HTML. Lists that
previously hid their column header on mobile now show it (labels only; no functional change).
See `docs/list-views.md`.

## 2026-07-22 — Performance list: pagination + a livelier, one-card redesign

The Performance list (`/admin/projected-sales`, ~340 projects) ran on forever with no
pagination and read as a flat wall of gray text. Rebuilt it as the **template** for our
list views:

- **Pagination** — a page-size selector (**default 10**, plus 25 / 50 / 100), windowed page
  numbers, and a "Showing X–Y of Z" line. Client-side over the already-loaded snapshot (no
  API change).
- **One card, one gutter** — the whole module (header · stats · filters · table ·
  pagination) lives in a single card on the warm canvas page; every band shares one left
  and right edge, so it reads as one aligned unit instead of scattered rows.
- **Life, with meaning** — colored salesperson avatars, project-type tone pills, a
  confidence meter (emerald ≥70 / amber ≥45 / gray below), close-date urgency (amber
  within 30 days, rose if overdue), and a weighted-magnitude bar. Both meters are kept
  short (`w-14`, `h-1`) so they don't crowd the row. Plus search, a rep-filter dropdown,
  and click-to-sort columns (Project / Confidence / Est. close / Quote / Weighted).
- **Fixed** two column-alignment bugs so the header labels sit exactly over their data:
  (1) the table's `overflow-x:auto` wrapper silently forced a vertical scrollbar that pulled
  columns ~15px off the right gutter — pinned with `overflow-y:hidden`; (2) the row
  `<button>`s shrink-wrapped to their content instead of filling the row (columns drifted up
  to ~470px left, worse on wide screens) — fixed with `w-full`.

Read-only page, so no selection checkboxes (they'd do nothing). This is the pattern we'll
roll out to the other admin lists next. See `docs/list-views.md`.

## 2026-07-22 — Fix: weekly accrual no longer touches customer accounts

The weekly PTO/sick accrual cron (`runWeeklyAccrual`) fetched all active `employees` and — because every
customer invite creates an employees row (migration 001 trigger) — was writing phantom PTO/sick balances
and `accrual_log` rows to the 4 customer accounts every week. It now excludes customers via
`getCustomerIds()` (the same helper the Accounts page and `/api/employees` use). Stops the ongoing
pollution; the existing phantom rows are harmless (customers never see time-off) and can be cleaned up
separately if wanted.

## 2026-07-22 — Shared operations top bar on every admin page

The dashboard's top bar (breadcrumb · search · layout view-switcher · notifications
bell · profile avatar) was hand-rolled inline on `/admin` only — every other admin
page had a plainer title header with none of it. Lifted it into a shared
**`AdminTopBar`** (`app/admin/AdminTopBar.tsx`) rendered once from the admin layout,
so **every `/admin/*` page** now carries the same chrome.

- Breadcrumbs resolve from the route (Operations / Sales / People / Jerry / System).
- The dashboard layout **view-switcher** ("Balanced / Tickets / Submissions") is now
  contextual — it renders on the dashboard only; on every other page that slot is
  free for future per-page actions.
- Desktop chrome (md+); on mobile the sidebar's hamburger bar still stands in, so
  there's never two stacked bars.
- No data, API, or permission changes. First step toward one consistent shell across
  the portal — the employee and Learn surfaces still use their own bar for now.

See `docs/admin-topbar.md`.

## 2026-07-22 — Sentry: server-side error monitoring (inert until a DSN is set)

The app had **no** error monitoring — 200+ `console.error` calls that only landed in Vercel logs,
nothing aggregated or alerting. Wired `@sentry/nextjs` for **server + edge** errors (API routes,
server components, server actions) via `instrumentation.ts`, plus the app's first `global-error.tsx`
boundary. It **ships dark — inert until you set `SENTRY_DSN`**:
1. Create a free project at sentry.io (Next.js platform) → copy the **DSN**.
2. Set `SENTRY_DSN` in Vercel → Settings → Environment Variables (Production + Preview) → redeploy.

Browser-error capture is a deliberate opt-in (the Sentry SDK adds ~80 kB to the client bundle), so the
client bundle is unchanged — add an `instrumentation-client.ts` + `NEXT_PUBLIC_SENTRY_DSN` when you
want it (see the note in `global-error.tsx`). For readable (un-minified) stack traces, wrap
`next.config.js` in `withSentryConfig` with a `SENTRY_AUTH_TOKEN` later. (`npm audit fix` also cleared
3 newly-disclosed transitive advisories; the 2 remaining highs are Next.js's `sharp`/libvips dep, which
Dependabot will bump when Next patches it — not a force-downgrade.)

## 2026-07-22 — Security: retire the legacy ticketing app + close the anon-insert bypass

The standalone `iat-ticketing.vercel.app` app (a static page that inserted tickets directly with the
anon key, bypassing the API rate limiter) is retired — it now 307-redirects to
`iatportal.vercel.app/support`, which replaced it. With no client left that needs it, migration `066`
drops the `tickets_public_insert` RLS policy, so the anon key can no longer insert ticket rows directly
(portal tickets go through `/api/tickets` server-side, which bypasses RLS). Closes security gap §8.1 /
§8.7 for tickets. (`submissions` still allows anon insert for the public form — flagged for separate
verification before dropping.)

## 2026-07-22 — Dashboards: cards gated by permission; sales follow-ups nudge

The scoped-role dashboard (`DepartmentDashboard`) now picks its stat cards from a declarative catalog
gated by permission — a role sees a card only if it holds that perm, so granting/revoking in
`/admin/permissions` reshapes the dashboard with no code change (the recent-activity list follows the
same rule). The Sales command center gains a **"N follow-ups due"** header badge (deal follow-ups due
today or overdue, linking to the deals calendar) — the in-app half of the rep-reminder feature, which
needs no email/domain.

## 2026-07-22 — Roles: scoped write access for the coherent set

Scoped roles were view-only on most surfaces — a role could open a page but every action 403'd. This
widens WRITE access to match page access, one matrix-backed named guard per surface (like Deals /
Tickets), so it stays revocable from `/admin/permissions` and widening one surface can't silently
widen another:
- **Engineering** can now work the submissions inbox (mark-read, status) — `requireSubmissionsAuth` /
  `getSubmissionsActor`.
- **Sales / Engineering / Production-manager** can maintain the equipment registry (create, edit,
  delete, milestones) — `requireEquipmentAuth`.
- **Sales / Engineering / Production-manager** can edit Gantt timelines — `getGanttActor`.
- **HR** can approve / deny / delete time-off requests — `getTimeOffActor`.

Field whitelists at each write site are unchanged (widening the gate doesn't widen the columns), and
sensitive writes stay admin-only (role assignment, the permissions matrix, ticket deletes, form
approval). Audit attribution now uses the surface user, so scoped-role actions log who made them.

## 2026-07-22 — Tickets: "Draft response with Jerry"

On a ticket, admins get a **Draft response with Jerry** button that generates a customer-facing first
reply — grounded in the ticket's equipment + the KB (the same RAG engine as the ticket assistant, but a
customer-tone prompt with no internal citations) — and loads it into the note editor. The human reviews,
edits, and sends it via the existing "Reply to customer" flow (sanitization + visibility rules
unchanged). Nothing sends automatically.

## 2026-07-22 — Org chart: Free layout (drag-anywhere whiteboard mode)

The admin org chart gets a **Free layout** toggle: drag any card to an arbitrary spot on the canvas
and the position saves (per-node, on drop) to the shared chart, with connectors following. Un-placed
nodes keep their computed tidy-tree position, so turning it on changes nothing until you actually move
someone; **Reset** clears all hand-placement back to the automatic layout. Auto (manager-reassign)
mode is unchanged, and Free layout is admin-only (the employee `/directory` never sees it). Backed by
two nullable columns (`employees.org_x` / `org_y`, migration `065_org_layout.sql`) written through an
admin-gated server action.

Migrations: applied the previously-inert **SharePoint schema (060)** early (additive + inert — nothing
turns on until Entra/env are set) and reconciled the drifted migration tracker, so **059–065 now read
as applied**. Also documented that the Layer-2 backup dump (`scripts/backup-db.mjs`) needs Docker
Desktop or a native `pg_dump` (`docs/backup-restore.md`).

## 2026-07-22 — Hardening pass 2: access-control fixes, shared AI client, plainer Gantt copy, backups

**Security fixes.** `/tools/*` now bounces customers to `/customer` (a customer session could open the
internal US Rotors pricing calculator). `updateTicket` writes an explicit field whitelist
(status/priority/owner_id/resolved_reason) instead of forwarding the whole client object. The employee
detail page redirects customer ids to `/admin/customers`, and the role-change API refuses customer
targets — together they close a path that coerced a customer into a staff role and could lock them out
of their portal. `GET /api/employees` (an unused route) now requires a non-customer role — it had handed
the staff name/email/phone roster to any signed-in session. `scripts/check-perm-seed.mjs` hardened to
catch schema-qualified INSERTs, block-comment INSERTs, and DELETE/TRUNCATE/UPDATE.

**Shared Anthropic client.** All 10 server-side AI call sites now import one `lib/anthropic.ts` instead
of each constructing an identical client (behavior unchanged; model/tokens/system stay per-call).

**Gantt wording.** Plainer P80 copy on the print sheet, confidence panel, and editor — quote the
"80% confident by" date, never the middle plan date, and confirm with the project lead before committing
to a customer. Advisory only (the feature is already admin-only).

**Backups.** New `scripts/backup-db.mjs` (off-Supabase logical dump to a gitignored `backups/`) plus
`docs/backup-restore.md` covering the restore test and enabling Supabase managed backups + PITR.

## 2026-07-22 — Hardening: centralized email senders, US Rotors order-API guard

**Email senders centralized** (`lib/email-from.ts`). Every Resend sender now reads from a single
`EMAIL_FROM` map that defaults to the shared `onboarding@resend.dev` sandbox and flips to the real
`dehumidifiers.com` addresses purely by env var — no code deploy — once the domain is verified. Set
`RESEND_FROM_SUPPORT` (support/ticket/troubleshooting mail), `RESEND_FROM_PORTAL` (portal/system
mail; the legacy `RESEND_FROM` is still honored as its fallback), and `RESEND_FROM_FORMS` (form
notifications) in Vercel when the domain is live. Ticket notifications also gained an optional
`SUPPORT_NOTIFICATION_EMAIL` (comma-separated) CC list so the support desk / PM can be added without
a code change. Behavior is unchanged until those vars are set.

**US Rotors order API hardened.** `POST /api/us-rotors/orders` previously gated only on "is someone
logged in," so any authenticated principal — including an external customer calling the API directly
— could insert an order even though the feature's nav is hidden and the GET/PATCH handlers already
role-gate. The POST now uses the same `requireUsRotorsActor()` guard (rejects anonymous and
`customer` roles); the employee order form is unaffected.

Docs: README company name corrected to Innovative Air Technologies.

## 2026-07-21 — Sales pivot: DryWare is the source of truth; Deals→CRM, Projected Sales→Performance

The sales pipeline stops being a monday.com spreadsheet mirror and becomes a **materialized view
of the DryWare "projected sales" feed** (migration `063_deal_dryware_key.sql`). On every DryWare
sync the `deals` table is refreshed from the feed (`lib/dryware-deals.ts`): DryWare owns the facts
(customer, $, confidence, close date, salesperson, unit models), the portal preserves the workflow
overlay (stage, ★ focus, follow-ups, notes) across syncs keyed by a stable
`project_customer|project_name` key, and projects that drop off the feed are pruned. So one "Sync
now" click on Performance refreshes the CRM Board, Focused, Calendar, **and** the `/admin` dashboard
at once. The 441 stale spreadsheet deals were backed up and deleted; the current feed materialized
to ~335 deals ($55.6M / $12M weighted across 5 reps).

Nav + structure: **Deals → CRM**, **Projected Sales → Performance**. The CRM view is now just
**Board / Focused / Calendar** — the in-CRM Dashboard tab (redundant with the `/admin` command
center, which now shows the DryWare-fed numbers), the Table tab, and the Companies tab were removed.
New Deal reverts to a plain customer field for the occasional off-DryWare deal (dryware_key NULL,
never touched by sync). The Phase-2 companies/contacts layer is dormant (tables + API kept, UI
removed). Write-up: `docs/deals.md` (top).

## 2026-07-21 — CRM Phase 2: companies & contacts, human-gated backfill, monday cutover tooling

The relational account model (migration `062_crm_companies.sql`): new **`companies`** (unique
normalized name as the dupe guard, kind, optional link to the support-portal customers row) and
**`contacts`** tables, with `deals.company_id`/`primary_contact_id` FKs. `deals.customer` survives
as a derived display cache — linking rewrites it to the company name, renames cascade — so every
existing view and analytic is untouched.

The old CRM tab is now **Companies**: account roster with deal/contact rollups, a per-company
drawer (fields, contacts, linked deals, merge, delete), and the **"Review & link"** panel — a
two-phase backfill that clusters the 441 free-text customer strings (177 clusters via the new
conservative normalizer in `lib/crm-normalize.ts`; branch offices like "H&H Nashville" are
*suggested*, never auto-merged) for human review before anything is written. Commit links deals,
moves parenthetical hints into empty job names, seeds contacts from rep_contact, and is idempotent +
audit-logged. The same panel is the standing tool for future unlinked deals.

New Deal's customer field is now a company combobox and the server exact-matches or auto-creates a
prospect, so **every new deal lands linked**. The deal modal gained a Company & Contact section
(link/change company, primary contact picker, quick-add contact). The xlsx importer's carry-over
identity now normalizes company names (canonical renames would otherwise break every re-import),
carries the new FKs, and auto-links remaining rows by exact match only. All routes ship under the
existing `deals` permission via a new `requireCrmAuth` guard — no new permission seed.

**Cutover to retire monday.com** (runbook in `docs/deals.md`): final export → replace-import →
Review & link → hand-link portal customers. The review pass needs a human — nothing merges without
approval.

## 2026-07-21 — CRM Phase 1: real pipeline stages + drag-and-drop Board

First phase of the CRM master plan (portal replaces monday.com as the sales source of truth).
Deals now carry **named pipeline stages** — `lead → quoted → follow_up → verbal → won/lost`
(migration `061_deal_stages.sql`, applied via Supabase CLI) — with a **`deal_stage_history`**
table logging every transition for future funnel/conversion analytics. Existing 441 deals were
backfilled from status + checklist (407 quoted / 32 lead / 2 won) and each seeded one history row.
`status` (Won/Lost/null) survives as a synced compatibility shadow so every existing analytic is
untouched; reopening a closed deal restores its last open stage from history.

New **Board tab** on `/admin/deals`: a Quiet-Precision kanban (`@hello-pangea/dnd`, already in the
bundle — no new deps) with weighted-$ column headers, biggest-deals-first cards capped at 40 per
column, search + rep pills, Lost collapsed to a drop rail, and a **closed-reason prompt** on
Won/Lost drops (reasons stored in the new `closed_reason` column for win/loss reporting). The deal
modal gained a stage stepper + inline reason picker, the 5-step checklist demoted to a collapsed
"Process Checklist" accordion, stage history merged into the activity feed, and new fields:
**`expected_close`** (real date — backfilled from the free-text `projected` for 158 of 162 deals by
`scripts/backfill-expected-close.mts`), **`next_step`** and **`next_step_due`**.

Under the hood: the deals PATCH API now returns the full updated row and `DealsClient.persist()`
folds it into the optimistic state behind a per-deal in-flight counter — fixing a latent drift where
server-derived fields never reached the client. The xlsx importer derives stages on fresh rows and
its replace-mode carry-over now preserves stage, stage age, the new columns, and re-parents stage
history. Write-up: `docs/deals.md` ("Pipeline stages & the Board").

## 2026-07-21 — Sales dashboard: a dedicated command center for the Sales role

Sales profiles now land on a purpose-built dashboard at `/admin` instead of the generic
`DepartmentDashboard` — the **first department separated out** (admin, engineering and the other
scoped roles keep their current dashboards until each gets its own). It's a **one-screen command
center** (no page scroll on desktop; relaxes into a scrollable stack below `lg`): six KPIs across
the top, then a 4×3 grid — rep leaderboard, deals-by-status and pipeline-by-industry donuts,
a pipeline-by-confidence funnel, **largest open deals**, a quoting-activity trend, forecast
projections (run rate / best / commit), recently won, and derived needs-attention.

Everything is live from the `deals` table via `lib/deals.ts` (new `industryStats` +
`salesProjections` helpers). The three things the board can't feed yet — a sales goal/quota line
and lead/meeting activity — show an honest *"not tracked yet"* state rather than invented numbers.
New shared, **server-safe** chart primitives in `components/dashboards/sales-charts.tsx`
(`SalesDashboardView` composes them; hand-rolled SVG/CSS, no chart library). The dashboards adopt a
measured amount of color — colored KPI chips + multi-hue category donuts — drawn only from the
sanctioned Tone palette, a scoped and documented departure from DESIGN.md's one-accent rule (§2.4
carve-out). Write-up: `docs/dashboards.md`. Commit `08328b8`; prod alias `iatportal.vercel.app`
verified.

## 2026-07-21 — Company Home redesign: the "Lobby"

Rebuilt `/home` from the single-screen bento into a warm, scrolling **lobby** that matches the
shipped dashboard chrome (`/admin`, `/employee/profile`) instead of standing apart from it: a
`zinc-50` canvas with a soft ambient emerald glow, an **emerald→teal gradient greeting hero** with
quick-link buttons, a **company at-a-glance KPI row** (Teammates · Days incident-free · Open roles ·
Next holiday), and equal-height white `rounded-xl` cards for News (featured lead + list), This Week
(holiday + events + who's-out), Our People, Milestones, Open Positions (+ referral), the weekly Core
Value, and the Suggestion box. One emerald accent, used warmly; full light/dark.

No data or routing changes — every card is still live from Supabase with the same "CMS with sensible
defaults" fallbacks. Two small data additions: a live active-staff **`headcount`** (Teammates KPI)
and an editable **`SAFETY.since`** date in `lib/home-content.ts` that drives the auto-incrementing
"days incident-free" counter. The whole design lives in one file — `app/home/HomeContent.tsx`.
Write-up: `docs/company-home.md`.

*Follow-up (same day):* the footer fun-fact chip now **wraps** to show the whole fact instead of
truncating with an ellipsis (`FunFact.tsx`), and was retoned to the zinc/emerald footer.

## 2026-07-20 — Internal Apps: Gas Burner Selection Guide + "Tools" renamed

Added the **Gas Burner Selection Guide** (`public/tools/burner-selection-guide.html`) to the
internal-app launcher. It sizes the AH-MA gas burner length, plenum height, profile-plate gap, and
gas pressure-tap differential from the desiccant wheel and reactivation duty on a job's flow diagram
(with an optional drag-and-drop OCR auto-fill from the flow diagram), and exports a submittal-ready
PDF. Registered as one entry in `lib/tools.ts` (the single source of truth), so it appears in both
`/admin/tools` and the employee launcher (`/employee/resources/tools`); it carries the "New" badge,
which moved off the older Duct Traverse entry.

Renamed the launcher from **"Tools & Apps"** to **"Internal Apps"** everywhere it's user-facing —
admin sidebar, employee sidebar, both page headers, the ⌘K command palette, and the permissions-matrix
label — so it's no longer confused with **Tool Crib** (the warehouse tool check-out registry), which
sat one word away in the permissions matrix. The route (`/admin/tools`, `/tools/*`) and the `tools`
permission are unchanged, so no middleware or seed changes were needed.

## 2026-07-20 — Projected Sales: live sync from the Dryware reporting API

New `/admin/projected-sales` page mirrors the "projected sales by project" feed from the external
**Dryware** system (`dryware.dehumidifiers.com`) — the portal's first live *outbound* API
integration. Sales opens the page and clicks **Sync now**; the server GETs the feed (HTTP Basic auth
via the `DRYWARE_AUTH_HEADER` env var — server-only, never in code), de-duplicates it, and mirrors it
into a new `projected_sales` table (migration `059`). The page reads from that table, so data loads
instantly, persists between syncs, and survives Dryware being down; a one-row `projected_sales_sync`
log drives the "last synced" line. The swap is **atomic** (a Postgres function replaces the whole
table in one transaction) and **fail-safe** (a failed fetch never wipes the last good snapshot). Every
sync is audit-logged. Gated on the existing **`deals`** permission — Sales + admin, no new permission
to seed.

The Dryware endpoint currently returns every project row **twice** (a JOIN fan-out on their side;
flagged to their dev); we collapse byte-identical rows on ingest, so the page shows each project once
and surfaces both counts ("95 projects · from 190 source rows") rather than hiding it. Verified
end-to-end against the live endpoint before ship (190→95 rows, ~$18.9M quoted / ~$5.7M weighted, ~1s
round-trip). Full write-up: `docs/projected-sales.md`. Deferred: a scheduled ~6am auto-sync (via
Supabase pg_cron) — manual "Sync now" only for v1.

## 2026-07-20 — Company Home: real core values, one featured per week

The Core Values tile now carries all nine of IAT's actual core values (from
dehumidifiers.com/core-values) and features **one per week** — "Core Value of the Week."
It auto-rotates each Monday (Eastern), holds steady all week, and cycles through all nine
(`coreValueOfWeek()` in `lib/home-content.ts`). A manual "pin one for the week" override
(admin picks it, it stays) is a planned follow-up.

## 2026-07-20 — Company Home: single-screen bento dashboard

Redesigned Company Home from a scrolling stack of cards into a **single-screen bento dashboard** —
on desktop it pins to the viewport and never scrolls the page; the two content-heavy tiles (news,
open positions) scroll inside themselves so nothing is lost. A gradient header band carries the
greeting, the "did you know" fun-fact chip, and an Email-IT shortcut; below it a 3×2 grid of tiles,
each with a soft-wash tone accent (news = sky, calendar = violet, positions = emerald, birthdays =
amber, people = brand, values = rose, suggestions = violet). New Employee + Employee Spotlight are
merged into one "Our People" tile; small touches — a time-of-day greeting emoji, a next-holiday
countdown, a one-time fade-up entrance (reduced-motion aware). Both shells pin the grid to the
viewport per-shell (the employee shell subtracts its 56px top bar), since the shells themselves are
built to body-scroll. Below `lg` it relaxes into a normal stacked, scrollable column. Full write-up:
`docs/company-home.md`.

## 2026-07-20 — Company Home: shared intranet landing inside the portal

The SharePoint intranet homepage is rebuilt inside the portal (Quiet Precision design) — company
news, a calendar, birthdays & anniversaries, newest hire, who's out, open roles, and a suggestion
box. **Every internal role now lands here first after login** (`landingForRole`, replacing the old
direct-to-workspace redirect); customers are unaffected and still land on `/customer`. It renders
**inside the portal shell** — the sidebar is present with "Company Home" the active tab — so it's a
per-shell route (`/admin/home` for admin-surface roles, `/employee/home` for base employees), and
the rest of the workspace (Dashboard, Tickets, …) is one sidebar click away.

Content is "CMS with defaults": cards read live from `announcements`, `company_events`,
`job_openings`, `employee_spotlights`, and `employees.birthday` (migration
`058_company_home.sql`), falling back to typed defaults in `lib/home-content.ts` whenever a
table is empty — `/home` is never blank. People-derived cards (anniversaries, newest hire,
who's-out) read existing `employees`/`time_off_requests` data, nothing new. Authors manage
content at `/admin/home-content` (System → Company Home, new `home_content` perm, grantable to
scoped roles from `/admin/permissions`). Full write-up: `docs/company-home.md`.

Both the DB migration and its RLS follow-up patch were verified live before this deploy — see
the entry below.

## 2026-07-20 — Supabase CLI set up; closed customer-read gap on company-home content

The Supabase CLI is now installed (`iat-forms-portal` devDependency), linked to the live
`iat-forms` project, and its migration history repaired to match the 58 migrations already
applied by hand — future migrations can go through `supabase db push` instead of the manual SQL
editor. See `docs/company-home.md` for CLI usage notes.

While verifying migration state against the live DB, confirmed `058_company_home.sql` had in
fact already run (contrary to stale notes saying otherwise) but its known RLS security patch
had not: `announcements`, `company_events`, `job_openings`, and `employee_spotlights` still
granted `authenticated` SELECT, letting a logged-in *customer* session read internal-only
content directly via PostgREST. Ran the documented `DROP POLICY` statements to close it — RLS
stays enabled, app reads are unaffected (they go through the service-role client). Full
write-up: `docs/company-home.md`.

## 2026-07-17 — Production Board: first-class projects under each department

**Needs migration `056_production_projects.sql` run before deploy** (the board and
`/admin/production` query `production_projects` and 500 without it). Extends the board shipped
earlier today. Full write-up: `docs/production-board.md`.

A department now **contains projects**. Until now "project" was a free-text label on a task,
grouped at render time; now it's a real `production_projects` row with a name, free-text
`type`, `detail`, a `status` (active/complete), and a display-only `people` list ("who's on
this build"). Tasks gain `project_id` (NULL = a department-wide **standing duty**, the new
tell for `isStanding` — the old `project` text is deprecated) and an optional `phase` ("Day 1",
"Framing") that sub-groups a project's tasks.

The point: **two builds can share a task list yet track separately.** One department QR shows
standing duties first, then each active project as its own section with its own progress;
`/board/<token>?project=<id>` focuses one. The headline feature is a **Duplicate** button —
copies a project and its task list (titles/details/phases/cadence/priority carry over;
status, done-state, due dates and assignees reset for a fresh build), since most builds start
from a near-identical checklist.

Connected people are **display-only by product decision** — they tag who's on a build but do
NOT narrow the assignee picker, which stays the whole department roster.

`production_projects` is RLS-on / no-policies (service-role only) like every board table — an
anon read policy would expose project rows and, joined, the department tokens. The public
check-off route now also refuses a task whose project is complete/archived, so a stale board
link can't tick off a finished build's work. Cross-department writes are still re-proved
against the token's department.

Demo re-seeded (`scripts/seed-production-board-demo.mjs`) into the two-project scenario:
**Acme Unit A** (dated) and **Beta Unit B** (a fresh duplicate) under Production, both running
the 6-day build phased Day 1–6, plus two standing duties and a starter roster. 21 logic
assertions cover the new project/phase grouping; `groupByPhase`/`buildBoard` are the shared
source both surfaces read.

## 2026-07-17 — Form builder: a WYSIWYG "Form view" for editing long forms

Editing a 100–200-field form as one flat stack of identical rows was brutal, so the builder
(`/admin/forms/*/edit`) gets a second view, toggled in the toolbar: **Form view** (new default)
and **List** (the original flat editor, kept unchanged as a fallback). Both write the *identical*
save payload — no schema change, no migration.

**Form view** groups fields into collapsible **sections** (split on Section Header fields), with a
left **outline** to jump around long forms and per-section counts. Each field renders as a WYSIWYG
preview of its real control and is edited inline. Drag reorders within *and across* sections;
sections move as a block. Forms over ~40 fields open collapsed so the overview comes first.

Two real wins over the old right-hand panel:

- **Conditional logic is visible and editable in place.** Every conditional field wears a badge
  (`Heat Type = Electric`), controllers show a "drives N" badge, and the value picker is a chip
  multi-select that finally exposes the **"any of"** capability `show_when_value` always supported
  (pipe-separated `Electric|Natural Gas`) but the old single-`<select>` UI hid.
- **Live warnings for the two label-keyed traps** the model is prone to (see
  `docs/form-conditional-fields.md`): **duplicate field labels** (answers collapse into one and lose
  data) and **dangling/stale `show_when_field`** — the condition that *erases* instead of gating, the
  same failure mode that hid 22 Performance Review questions for ~5 weeks. Neither was caught before.

New code is isolated to the builder: `components/admin/FormCanvas.tsx`,
`components/admin/form-builder-shared.ts`, and the toggle in `components/admin/FormBuilder.tsx`
(also retokened to the DESIGN.md semantic tokens). Verified by mounting the real builder against a
multi-section form seeded with duplicate + dangling conditions before shipping.

## 2026-07-17 — Production Board: a no-login, per-department shop checklist

**Needs migration `055_production_board.sql` run before deploy** (the board and
`/admin/production` both 500 without the tables). Full write-up: `docs/production-board.md`.

A checklist the floor opens by **scanning a QR code — no portal login**. Departments
(Production / Fabrication / Electrical, seeded but editable) each get their own board at
`/board/<token>`; the manager runs them from `/admin/production` behind the new
`production_board` perm.

**Public the same way `/support` is** — `middleware.ts`'s `matcher` is an allowlist and
`/board` isn't on it. Nothing else makes it public, and nothing else protects it: **the URL
token is the credential**, and the name recorded against a check-off is typed on the floor
and unverified. That's the accepted trade for a floor with no accounts, and it sets the rule
for content — **shop work only, nothing you wouldn't pin to the break-room wall.**

The token is 43 chars / 244 bits, minted by the DB (`prod_board_token()`), never sent to the
client, and rotatable from the QR modal (which kills every printed label for that board).
The tables are RLS-on/no-policies — **service-role only, deliberately**: an `anon` read policy
on `production_departments` would expose it over PostgREST, and one request with the
publishable key would dump **every token at once**. Added `noindex` + `Referrer-Policy:
no-referrer` on `/board/:path*` — this app has no `robots.txt` at all, and unguessable
isn't unindexed.

**Standing duties and job work share one table**; `project IS NULL` is the only difference.
Free text on both `project` and `assignee` because there is **no deals → equipment → shop
link in this schema** to FK to, and `employees` holds no floor staff (12 rows, 4 of them
customers, 7 with a null department) — so the roster is its own table of names, not accounts.

**Recurring tasks reset without a cron:** `done_on` stores the *shop-local* date
(`America/New_York`) and a daily task counts as done only while that's today. Keying it on
UTC would have reset the board at 8pm local, mid-second-shift. One implementation —
`effectiveDone()` in `lib/production.ts` — 41 assertions cover it.

`board-check` is rate-limited at 240/10min rather than the house 5–10 for public writes:
the whole shop shares one NAT IP, so the house default would lock the floor out by 9am.
`rateLimit` fails open anyway and is not the control here.

Perm named `production_board`, **not** `production` — that's already a StaffRole (the base
floor tier); same collision class as `tools` vs `tool_crib`. Registered in all five places,
including the `role_permissions` INSERT in `055` that actually grants it.

## 2026-07-16 — Performance Review: 22 department questions were unfillable for ~5 weeks

**Data fix, no code change** — `node scripts/add-perf-review-department-field.mjs --commit`
(dry-run by default, idempotent). Applied to `performance-review-form` and the inactive
`perf-new` copy.

`scripts/update-performance-review.mjs` (2026-06) gated 22 department-specific rating +
explanation fields on a controlling field labeled `Department` — **which never existed on
the form.** The form was hand-built in the builder, so there was no seed to add one to, and
nothing in 314 commits ever created it. `isFieldVisible` reads `answers['Department']`,
which was therefore `undefined` forever, so **all 22 questions were permanently hidden and
nobody could fill them in.** The gate didn't gate; it erased.

Why nobody caught it: **the print views looked correct**, because they fabricate the
controlling answer — `app/print/forms/[id]/page.tsx` reconstructs the department list from
the distinct `show_when_value`s when the controlling field is missing, and
`BlankFormPrint.tsx:145` injects `{ [controllingLabel]: dept }` as a synthetic answer. The
blank questionnaire printed fine while the live form showed nothing.

It was a regression, and it's dated: the **2026-07-07 submission answered two of the
now-hidden fields** (`Office: Accuracy and organization…` = "Superstar"). Before the gating,
every department's questions showed to everyone and the reviewer filled in the relevant
ones — which is also why that submission carries no `Department` key.

**The fix** adds the missing required `select` labeled exactly `Department` at the end of
*Employee Information* (sort_order 3, beside Employee Name / Review Date), shifting the rest
down. Options are **not a free choice** — they're dictated by the form's own questions:
`Office, Engineering, Sales, Marketing, Production, Management`, the distinct
`show_when_value`s on the 22 fields. The script asserts coverage both ways (exits non-zero
if a gated field awaits a value the select doesn't offer; warns if an option has no
questions), which is precisely the guard whose absence caused this.

Verified against the live rows through the real `visibleFields`: all 22 fields reachable,
each by exactly one department, zero cross-department leakage — and confirmed on prod
(picking a department grows the form 11 → 12 steps and reveals only that department's
questions).

Noted, not fixed: three other portal forms each use a **different** department list
(Shipping/Receiving, Administration, Quality Control, IT & Facilities), and
`employees.department` is unset for 9 of 12 people. The perf review has no questions for
those departments — a content gap for Jacob, not something to invent.

## 2026-07-16 — IDP Pre/Post Test Report rebuilt from the live JotForm (18 → 253 fields)

The portal's copy had drifted badly: 18 flat fields, no sections, while the live JotForm
(`232424923646155`) had grown to **230 fields across 21 sections with 19 conditional
rules**. Rebuilt via `scripts/update-idp-test-report.mjs` (dry-run by default, `--commit`
to apply). The form now renders as a **30-step wizard** (32+ once branches open); the two
existing submissions are untouched — they carry no FK to `form_fields`.

Three things the portal's form model couldn't take verbatim, and what was done:

- **Duplicate labels are data loss, not cosmetics.** Answers are keyed by field *label*
  (`lib/forms.ts`), and the JotForm reuses labels heavily — `Notes` ×12, `FLA` ×5,
  `Control Type` ×4. Ported as-is, React Motor Notes would overwrite Air Flows Notes. Every
  label is now section-qualified (`React Motor Notes`, `Pre Heat FLA`). The rebuild script
  asserts label uniqueness, that no condition points at a missing field, and that each
  gated value actually exists on its controlling field — it exits non-zero otherwise.
- **`show_when_value` now accepts several values**, pipe-separated (`Electric|Natural Gas`),
  for the three React Heat fields JotForm shows under both. Single values behave exactly as
  before; no migration (the column is already `text`).
- **`control_matrix` has no portal equivalent.** The PXR controller table (4 rows × 9 cols)
  is flattened to 4 sections × 9 fields, gated on `Controller Type = PXR`.

Fixed while porting (both were accidents in the JotForm, confirmed with Jacob):

- **React Heat `Notes` was gated to `Hot Water` only** — techs running Electric, Natural Gas
  or Steam had nowhere to write React Heat notes.
- **Controllers `Notes` + `Photos` were gated to PXR/Carel only** — Automation Direct,
  Siemens and Allen Bradley units couldn't attach controller photos at all.
- **`Current inlet steam pressure?` had no condition** and showed on every unit, including
  electric ones. Now gated to `Heat Type = Steam` with the rest of its block.
- Form description said IDP = "Industrial Desiccant Products"; it's **Integrated
  Dehumidification Package** (per `scripts/kb-reference/iat-unit-nomenclature.md`).

Two engine fixes this shook out, both benefiting every form:

- **Conditions now resolve up the whole chain.** IDP has real 2-level cascades
  (`Heat Type → Amps? → the no-amps checklist`). Previously a stale answer to a
  now-hidden controlling field stranded its dependants on screen — answer Electric/No,
  switch to Steam, and the no-amps checklist stayed. Cycle-guarded.
- **`groupFieldsIntoSteps` rendered a literal `"null (Cont.)"`** as the section label when
  fields before the first section header spilled past one step. Latent for any such form;
  IDP was the first big enough to trigger it.

Section headers can now carry a **description** (reusing `placeholder`), shown under the
step title and editable in the form builder — this is what carries JotForm's React Heat and
Pre-Cooling Coil explanatory blurbs across.

## 2026-07-16 — Ticket notes follow the `tickets` perm; note authorship recorded

`sales`/`engineering`/`production_manager` could reassign a ticket but **401'd posting a
note** on it. `requireTicketAccess()` — the single boundary behind all four dual-auth
ticket routes — now resolves a third caller, `staff` (holds `tickets`, read live from the
matrix). `admin` is tried **before** `staff`: admins hold every perm, so the other order
would downgrade them into the internal-only branch and cost them customer replies.

- **Internal notes only for scoped roles.** Forced `visibility='internal'` server-side,
  ignoring the client — the same mechanism that forces a customer's note public/customer.
  The "Reply to customer" toggle is hidden for them, but that's honesty, not the control.
  Replying to a customer under IAT's name stays an admin act. Note DELETE stays admin-only.
- **Attachments too** — upload/download/preview. They could previously see an attachment's
  name and size in a note but 401 opening it.
- **Reading internal notes was already open** to any `tickets` holder (the page
  server-renders them via `supabaseAdmin`, ungated), so nothing new is disclosed here.
- **Authorship (migration `054`, pending).** `ticket_notes` recorded only `author_type` —
  every staff note was an anonymous "admin". Adds `author_id` (FK `auth.users`, not
  `employees`) + snapshotted `author_name`, resolved from the session, never the body.
  No backfill: older notes stay unattributed rather than get a guessed author.
- **Closed in passing:** notes are read with `select('*')`, so `author_name` would have
  shipped **staff names to customers**. The GET strips `author_*` for customers and the
  customer ticket page now lists columns explicitly.

⚠️ `054` is additive and **nothing breaks without it** — the insert falls back to saving
notes unattributed. That fallback keys on `PGRST204` **and** `42703`: PostgREST returns
`PGRST204` for an *insert* with a missing column (`42703` is what a *select* returns), and
handling only the latter would have 500'd every note save until the migration ran.

Verified: `tsc --noEmit` + `next build` green; read-only live-DB checks confirmed the
customer column list is valid and leaks no author identity, `054` is not yet applied, and
the real error codes. Probes left zero rows in prod.

## 2026-07-16 — Tickets follow the `tickets` perm; last `is_admin` readers removed

⚠️ **Two findings that invert the earlier write-ups.** (1) The `is_admin` drift everything
called hypothetical is **already live in prod**: `jacob.younker@dehumidifiers.com` (Jacob's
own admin account) and `jacob@dehumidifiers.com` both have `profiles.role = 'admin'` with
`is_admin = false` — promoted by hand in the Supabase dashboard, which skips both writers.
It runs **fail-closed** (zero rows are `is_admin = true` with a non-admin role), so nobody
ever gained access; two real admins were **denied** — silently missing admin digests and
every new-ticket/PTO notification, and unassignable on tickets. The code below fixes them
with no migration. (2) `is_admin` does **not** have zero authorization readers — the RLS
policies still gate on it (see the ⚠️ below). Migration **`053` (pending)** resyncs the
column for those policies' sake.

The ticket-owner picker listed `is_admin = true` staff only, so **only full admins could
own a ticket** — even though `sales`, `engineering` and `production_manager` hold the
`tickets` perm, are let onto the ticket page by middleware, and work the queue daily.
Behind it sat a second bug: `updateTicket` gated on the strict full-admin
`getAdminUser()`, so those roles saw a status/priority/owner form that **always failed on
save**. Both now follow the `tickets` perm, read from the live matrix:

- **`getEmployeesWithPerm(perm)`** (`lib/staff.ts`) builds the picker — "everyone who can
  work this ticket", moved by `/admin/permissions` with no deploy. Fails **closed**
  (empty list), the deliberate inverse of `getCustomerIds()` next to it. Customers and
  profile-less rows are excluded by holding no permission, so no extra filter is needed.
- **`getTicketsActor()`** (`lib/admin-auth.ts`) guards the write — the **second scoped
  write exception** after Deals, and the server-action counterpart to the matrix-backed
  route guards in `lib/api-auth.ts`. Audit logging unchanged.
- **`getAdminRecipients()`** (`lib/staff.ts`) re-sources admin notification email (daily
  digest, `/api/tickets`, `/api/requests`) from `profiles.role = 'admin'`, so a demoted
  admin stops receiving it immediately. It **throws** on an unreadable `profiles` table;
  the two routes catch and fall back to `ADMIN_NOTIFICATION_EMAIL` rather than 500 a
  request whose row is already committed.

Also fixed: `/api/tickets` and `/api/requests` never filtered `is_active`, so
**deactivated admins were still being emailed**; and an owner who no longer qualified had
no matching `<option>`, making an owned ticket render as unassigned (the current owner is
now always kept in the list).

⚠️ **`employees.is_admin` is kept, and the RLS policies are why.** No application code
reads it now, but migrations `001`/`007`/`022` gate `employees`, `time_off_requests`,
`accrual_log` and `us_rotors_orders` policies on it — real access decisions at the DB
layer, mostly dormant only because the server uses the service-role key. Postgres refuses
to drop a column its policies depend on, so rewriting them to join `profiles.role` is a
tracked follow-up. Ticket **notes** stay admin-only (`requireTicketAccess`, the shared
dual-auth boundary) — a scoped role can reassign a ticket but still 401s posting a note;
widening that needs its own decision.

Verified: `tsc --noEmit` + `next build` green; picker/write predicates exercised against
the real `lib/roles.ts` across 13 roles × 5 matrices (150/150), negative-tested by
replaying the old admin-only predicate (reproduces the bug, 24 failures). Read-only live
DB check against the real matrix: picker **4 → 7** (loses nobody), admin mail **4 → 6**,
**0** customers listed despite 4 customer rows in `employees`. No code depends on `053`.

## 2026-07-15 — Admin sidebar color + cool-graphite dark mode

Gave the admin left nav a color identity and retoned dark mode:
- **Light mode:** the sidebar rail is now **deep pine** (a desaturated, warmed brand-green
  950) instead of the plain warm canvas — a dark rail on the light canvas, so the green
  active-row indicator and status pills finally pop. Brand green stays a pure accent (active
  row + 2px left indicator), never a background fill.
- **Dark mode:** the whole dark theme was retoned from the old **warm near-black** to a
  subtle **cool graphite** (blue-slate) surface ladder — canvas, cards, table header bands,
  chips, hairlines, and the nav rail all share one cool family, so dark mode reads as a
  single deliberate surface. In dark mode the rail joins the graphite family (no green
  field); green remains an accent only.
- New semantic tokens: a `--sidebar-*` family (pine in light, graphite in dark) in
  `globals.css` + `tailwind.config.ts`; documented in DESIGN.md §2.2. Light mode `:root`
  content tokens are unchanged. Scope: `iat-forms-portal` admin shell only — the other
  sub-apps still carry the previous dark palette and will be rolled over separately.

## 2026-07-15 — US Rotors calculator: link out to the Desiccant Simulator

Added a **"Desiccant Simulator" tab** to the pricing calculator's tab nav (right-aligned,
external-link icon) that opens the companion sizing tool at **calculator.usrotors.com** in
a new tab — `window.open(…, 'noopener')`, so it doesn't disturb the current view.

## 2026-07-15 — US Rotors 3D: two-sided casing + process/reactivation zone shading

Bossman tweaks to the 3D model:
- The **aluminum casing look is now on both faces** — the "+" cross, center hub, and
  diagonal corner gussets mirror onto the back, so front and back read identically.
- The **wheel face is shaded by airflow zone** (always on, independent of the "Show
  airflow" toggle): the top-right quadrant = **reactivation (red)**, the other three =
  **process (blue)**, rendered as stationary semi-transparent sectors over the spinning
  media so the spokes still read through. The reactivation arrow + legend key are red to match.
- The **airflow arrows are now bold 3D arrows** (thick cylinder shaft + big cone head)
  instead of thin ArrowHelper lines (which WebGL can't thicken), so they read clearly.

## 2026-07-15 — US Rotors 3D model: photo-accurate rotor + cassette

Reworked the calculator's 3D viewer to match IAT's real desiccant cassettes (from
reference photos of a shipped unit), per bossman:
- **Dark charcoal honeycomb media with thin radial spokes** (was a tan wheel), a bright
  **aluminum rim band**, and a **brushed-aluminum square cassette frame that hugs the
  wheel** — square face plates with a round bore, the structural **"+" cross** meeting at
  a **center hub**, **diagonal corner gussets**, box side walls, and a simplified
  **perimeter drive chain**.
- **Reflective metal** via image-based lighting (three `RoomEnvironment` + PMREM) so the
  aluminum reads shiny, not flat.
- **Airflow arrows are now a subtle "Show airflow" toggle** (off by default, cassette
  only) so the model matches the bare unit; the process/reactivation/purge legend follows
  the toggle.
- Still fully parametric and live off the PO inputs (diameter / depth / product-type drive
  the model and the price together); rotor-only shows the bare spoked wheel. Verified the
  render against the photos before ship.

## 2026-07-15 — Support page focus, /forms retired, live 3D US Rotors model

Batch of misc fixes (Jacob).

**Support (`/support`)**
- **Redesigned into a single "do this" landing page.** One live action — Start a
  support request → `/support/equipment-support` — as a big primary card, with a hero
  headline, three reassurance points, an operational-status strip, and a quiet "coming
  soon" note. Rebuilt on the Quiet-Precision semantic tokens (warm canvas, hairline
  cards, brand green only on the one CTA + focus rings; dark mode auto-themes).
- **Removed the customer-facing "Check ticket status" links** from the support landing
  (header + hero) and the "Track this ticket's status" link on the ticket success screen
  (kept only for logged-in customers, as "View this in my portal"). The `/support/status`
  lookup route stays in place, just unlinked. **Emails left unchanged** (per Jacob).
- **Removed the "Request portal access" CTA** from the end of the equipment support
  ticket — the form is now purely: submit a ticket, our team is notified.

**Public forms directory retired**
- **Deleted the public `/forms` index** (and its now-orphaned `FormsPortal` /
  `FormsBrowser` components). Individual forms still live at `/forms/[slug]`.
- The **"All Forms" / "Back to forms"** buttons now **go back to the page you came from**
  (`router.back()`, with a public `/support` fallback when there's no history — never `/`,
  which would bounce an anonymous filler to `/login`) via a new shared `BackLink`. The
  always-visible top-of-form control is labeled **Exit** (distinct from the step-nav "Back").
  The `PublicHeader` logo is now a static brand mark (was → `/forms`). Smoke test updated.

**US Rotors Pricing Calculator — live 3D model**
- Added an **interactive 3D viewer** to `public/tools/us-rotors-pricing-calculator.html`
  that updates live with the purchase-order inputs: a desiccant **rotor** (parametric
  diameter/depth, hub bore, honeycomb face) and, when "Rotor + Cassette" is selected, the
  rotor inside a **sheet-metal cassette** with process / reactivation / (optional) purge
  **airflow arrows**. Diameter is normalized on-screen; depth stays proportional; stainless
  → metallic finish, segmented → segment lines; the wheel spins. Drag to orbit, scroll to zoom.
- Built in vanilla Three.js (CDN import map, mirroring the `/customer/srv` parametric
  approach); driven by a single `update3D(lastCalc)` call at the end of `recalc()`, so the
  model and the price move together. Degrades gracefully (pricing untouched) if the CDN is
  unreachable. `next build` green; live updates verified across size / depth / type / options.

## 2026-07-14 — Annual Review print sheet: rating words restored + total is /48 (12 questions)

Two corrections to the numeric Annual Review sheet, per Jacob:

- **Superstar / Rockstar / Star / Needs Development are back on the back-page
  Performance Scale** (shown as the numeral + word + description), and the scale
  caption / Development-Plan note reference the words again. The 1–4 numbered
  scoring on every row stays.
- **Total is now `/ 48`, not `/ 80`.** Only the **12 review questions** (Sections
  1–3) count toward the score (12 × 4). The **8 Core Values are no longer scored
  into the total** — they keep their 4/3/2/1 rating for feedback, with a note that
  reads "rated for feedback, not counted in the score." The Total-Score label reads
  "sum of the 12 review questions — Sections 1–3."

Static markup only, no migration. Both sheets still fit one page each (landscape
front 702px / back 706px; portrait front 895px / back 815px), verified by rendering
the real markup. `next build` green.

## 2026-07-14 — Annual Review print sheet: 1–4 point score (no more star-picking)

Reworked the bespoke blank Annual Review print sheet (`app/print/annual-review/page.tsx`)
from a pick-a-rating-word form into a numeric point rubric. No migration; static markup only.

- **Rows are now scored 4/3/2/1.** The four rating columns (Sections 1–3 and the
  8 Core Values) show numbered bubbles **④③②①** to circle; the column headers
  are the numerals **4 3 2 1** (green→red) instead of the old trophy/star/bars icons.
- **Back-page scale is numeric** — the Performance Scale cards show the numeral over its
  plain description; the Superstar/Rockstar/Star/Needs-Development **wording is removed
  entirely** (numbers + descriptions only, everywhere on the sheet).
- **Total instead of a pick.** The old "Overall Performance Rating (Select One)" pill
  row is replaced by a **Total Score ___ / 80** tally (20 scored items × 4). The
  scale caption reads "4 = highest, 1 = lowest"; the Development-Plan note reads
  "for any area scored 1."
- **Coaching-note lines** added to Sections 1–3 (5 / 4 / 3 lines, one per question)
  filling the box beside each grid.
- **Still one landscape page each** (front ≈702px / back ≈706px vs ~758px usable),
  verified by rendering the real markup. Portrait toggle + Download-PDF unchanged.
  `next build` green.

## 2026-07-14 — Mobile audit: no sideways-scrolling lists, headers un-hidden, org chart toolbar

Portal-wide mobile sweep (no migration). Three classes of fix:

- **Page headers no longer start behind the fixed mobile top bar.** The admin
  and employee shells rendered an `h-14` spacer as a *flex-row* sibling, so it
  never pushed content down; the spacer is gone and the content column now
  carries `pt-14 md:pt-0` (`app/admin/layout.tsx`, `AdminSidebar.tsx`,
  `EmployeeShell.tsx`).
- **Every admin list now fits the phone viewport — no left-right scroll.**
  `TableScroll` only enforces its min-width floor from `sm` up, and each list's
  grid template is responsive: phones get a reduced column set (identity +
  status/key metric + age, audit-log style), the full grid returns at `sm+`,
  and column headers hide on phones. Rows stay clickable into their detail
  page/modal, which carries the rest of the data. Converted: Submissions,
  Tickets, Forms, Equipment, Gantt, Customers, Presentations, PTO/Sick
  requests (Approve/Deny wrap onto their own line — no detail page there),
  Employees, Accrual (balances keep their header labels), Troubleshooting,
  US Rotors. Deals Pipeline/CRM/Focused keep the top 2–3 metrics per row
  (customer/cost/status · customer/quoted/status · customer/weighted/open) and
  the Pipeline summary strip shows only Total Value + Weighted on phones.
  Bulk-select, kebab menus, and inline-edit fields are desktop-only
  (`SelectBox` gained a `className` passthrough for this).
- **Forms page was fully broken on phones** — 572px of fixed grid tracks inside
  an `overflow-hidden` card crushed the `1.7fr` name column to zero width,
  leaving just category/toggle/count. Phones now get name / toggle / Edit, and
  the tabs+status-pills header row stacks instead of squeezing.
- **Org chart:** the chart toolbar (title, Chart/List toggle, Edit/Erase, zoom
  cluster) wraps on phones instead of crushing into one 56px row, and the page
  wrapper dropped its hard `h-screen` (it overflowed by the top bar's 56px and
  clipped the canvas bottom).

Pattern notes in `docs/mobile.md`. `next build` green; Playwright smoke suite
9/9 passed; all new responsive utilities verified present in the compiled CSS.
Visual spot-check on a phone still recommended (admin pages are auth-gated, so
the sweep was verified structurally, not eyeballed page-by-page).

## 2026-07-13 — Deals: hand-picked Focused (★), follow-up calendar, rep bands, project type (migration 048)

Four sales-requested changes to `/admin/deals`, plus a new **Calendar** tab
(now five views: Dashboard · Pipeline · CRM · Focused · Calendar).

- **Focused is now a hand-picked list.** A ★ in the Pipeline rows (and the deal
  modal header) toggles `deals.focused`; the Focused tab filters on the flag
  instead of the old derived "confidence≥60 OR projected OR notes" predicate —
  so it clears itself on switchover and reps curate what they're working.
- **Follow-up calendar.** New deals auto-schedule a reminder 2 weeks out
  (Monday-parity automation; date computed in the browser's timezone so it
  doesn't drift on the UTC server). A "Schedule Follow-up" button in the deal
  modal adds dated ones; the Calendar tab is the month grid (overdue = rose,
  due-today = brand green, scheduled = sky, done = muted), with mark-done /
  open-deal / delete. Bulk imports deliberately don't auto-generate.
- **Rep separator cleanup.** Pipeline's group-by-rep toggle → filter pills
  (All / MAIN / JACOB / MIKE / DAVE) + a proper per-rep band (initials, count,
  $ + weighted totals) in "All" mode.
- **Project type dropdown** on the New Deal + edit forms (industry field,
  placeholder set in `lib/deals.ts PROJECT_TYPES`, swappable), shown as a modal
  header chip + field.
- **Migration `048_deal_focus_followups.sql`** (run in the Supabase SQL editor):
  `deals.focused`, `deals.project_type`, `deal_follow_ups` table (RLS on, no
  policies — service-role, same posture as deals). Everything degrades before
  it runs (friendly hints, clean optimistic reverts). Re-import carry-over now
  also preserves focused/project_type/follow-ups (matched by customer+job+group)
  and the import preview discloses them.

Adversarially reviewed (multi-agent) before ship; 12 confirmed findings fixed —
notably the replace-import wiping focused/project_type, New Deal breaking
pre-048, a follow-up temp-id delete/complete race, invalid-date 500s, and design
drift (RepBand gradient, New Deal modal shell, calendar tone/green). `tsc` +
`next build` green; rendering + graceful-degradation verified in-browser. Files:
`supabase/migrations/048_deal_focus_followups.sql` (new),
`app/api/admin/deals/follow-ups/route.ts` + `[id]/route.ts` (new),
`app/admin/deals/CalendarView.tsx` (new), `DealsClient.tsx`, `PipelineView.tsx`,
`FocusedView.tsx`, `DealDetailModal.tsx`, `SalesDashboard.tsx`,
`app/api/admin/deals/route.ts` + `[id]/route.ts` + `validate.ts` + `import/route.ts`,
`lib/deals.ts`, `lib/supabase.ts`, `docs/deals.md`.

## 2026-07-13 — Security: force Next's bundled postcss to ≥ 8.5.10 (Dependabot #26)

Dependabot alert #26 (GHSA-qx2v-qp2m-jg93 / CVE-2026-41305, moderate) flagged
the postcss copy that Next pins for itself at
`node_modules/next/node_modules/postcss` — 8.4.31, vulnerable to XSS via an
unescaped `</style>` in its stringifier output when that output is embedded
into an HTML `<style>` block. Not actually exploitable here (Next only
stringifies our own trusted Tailwind/global CSS at build time — no
attacker-controlled CSS enters that pipeline), but the real fix is cheap.
Waiting on Next wasn't viable: every 15.5.x (including the final backport
release, 15.5.20) pins 8.4.31, and even Next 16.2.10 stable still does — only
the 16.3 canary has moved to 8.5.10.

- New npm **`overrides`** entry (scoped to `next` only) forces its postcss to
  `^8.5.10`; it dedupes onto the root postcss 8.5.16, leaving a **single**
  postcss copy in the entire lockfile.
- npm quirk worth remembering: changing `overrides` does **not** invalidate an
  existing lockfile entry — `npm install`, `npm dedupe`, and
  `npm update postcss` (npm 11.13) all left the stale nested 8.4.31 in place,
  merely flagging it `invalid`. Fixed by deleting the nested entry from
  `package-lock.json` plus the directory, then re-running `npm install`.
- Drop the override once we're on a Next release whose own pin is ≥ 8.5.10
  (16.3+).

No code changes, no migration. Verified: `npm ci` from the updated lockfile
green (`npm audit`: 0 vulnerabilities); `next build` green; Playwright smoke
suite 9/9 against a local `next start` prod server. Files: `package.json`,
`package-lock.json`.

## 2026-07-10 — SRV batch: required failure photos, My Requests, admin per-section view

Fixes to the interactive Start-Up Readiness Verification (`/customer/srv`) and
its admin review, per Jacob:

- **Required failure photo, per item.** Marking any checklist item **Fail** now
  reveals an inline "Photo of this issue required" capture tile directly under
  that item (only on fail); it gates section completion and is validated
  server-side. Stored in `submissions.data` under `<item label> — Failure photo`
  keys (deliberately not in `form_fields`) and rendered inline under the failed
  item on the admin detail page. Note: photo-restricted sites can't submit an SRV
  containing a failure; and these photos appear in the admin web view but not the
  PDF/print export.
- **Electrical "Recorded readings" removed.** The L1–L2 … L3–G voltage inputs are
  gone from the Electrical Power section — in code (`lib/srv.ts`) and in the
  live, admin-edited `srv_config` row (`scripts/strip-electrical-readings.mjs`,
  backup gitignored). The gas section keeps its readings.
- **SRV now appears in the customer "My Requests" list** (matched on the
  `_customer_id` stamp; superseded revisions folded out). A returned SRV links
  back to `/customer/srv?resume=<id>` to fix flagged items.
- **Admin detail: one collapsible card per section.** The former single "More
  responses" accordion is now a card per form section, each with a **red
  fail-count badge** so failures are visible without expanding. (Applies to all
  forms; the badge only shows where a form has "Fail" answers.)
- **Empathetic intro** added atop the SRV intro stage.

## 2026-07-10 — Dependency refresh: Dependabot PR #25 (15 minor/patch bumps)

Merged the Dependabot minor-and-patch group. Notables: `@anthropic-ai/sdk`
0.104.2 → 0.110.0 (all Jerry/AI routes use plain `messages.create`; the
0.105–0.110 releases are additive — new model IDs and managed-agents/beta
surfaces we don't call), `@supabase/supabase-js` 2.108.2 → 2.110.2, tiptap
3.26.0 → 3.27.3, Next 15.5.19 → 15.5.20 (patch), and **three 0.170.0 →
0.185.1** (+ matching `@types/three`) — the widest jump; audited both three
consumers (`components/customer/srv/UnitScene.tsx`,
`components/admin/ReactorSun.tsx`): they touch only stable core APIs
(Vector3, Mesh, ShaderMaterial, AdditiveBlending, BackSide), and the pinned
r3f 9.6.1 / drei 10.7.7 support three 0.18x. Also react-hook-form 7.81,
postal-mime 2.7.5, autoprefixer 10.5.2, postcss 8.5.16, eslint-config-next
15.5.20. One new (unused) transitive optional dep, `@dimforge/rapier3d-compat`,
arrives with three's physics addon.

No code changes, no migration. Verified: `npm ci` + `next build` green on
the merged tree; Playwright smoke suite 9/9 against a local `next start`
prod server; Vercel preview deploy READY pre-merge. Files: `package.json`,
`package-lock.json`.

## 2026-07-10 — Deal workflow: follow-up checklist, quick actions & activity log (migration 047)

The deal detail modal now matches the deal card the sales team works from
(per their screenshot): **Deal Progress** (`N/5 completed` bar), **Quick
Actions** (Log Call / Send Email / Schedule Meeting / Send Proposal — each
opens a one-line composer and writes an activity entry), the fixed 5-step
**Follow-up Checklist** (Preliminary Submittal Sent → Quote Sent → Initial
Follow-Up → 2nd Follow-Up → Job/PO Award; toggles persist per deal and log
auto-entries), and a reverse-chronological **Activity Log** with actor +
relative time.

- **Migration `047_deal_workflow.sql`** (run in the Supabase SQL editor):
  `deals.checklist` jsonb + `deal_activity` table (RLS on, no policies,
  service-role only — same posture as deals). Until it runs, the modal shows
  a run-the-migration hint and checklist toggles revert cleanly — nothing
  crashes.
- Checklist rides the normal deals PATCH (`checklist` whitelisted;
  full-replace semantics, step keys + booleans enforced in validate.ts);
  activity via new `GET`/`POST /api/admin/deals/[id]/activity`
  (requireDealsAuth, actor from the session).
- **Replace-imports keep workflow data**: the importer snapshots checklists +
  activity before the wipe and carries them onto re-imported rows matched by
  customer + job + group; the import preview shows what's at stake first.
- Step KEYS are the storage contract (`lib/deals.ts CHECKLIST_STEPS`) —
  relabel steps freely without a migration.

Verified in-browser pre-migration (sections render with real deals, composer
opens, optimistic check → revert + banner on rejected persist, zero console
errors); `next build` green. Files: `supabase/migrations/047_deal_workflow.sql`
(new), `app/api/admin/deals/[id]/activity/route.ts` (new),
`app/admin/deals/DealDetailModal.tsx`, `app/admin/deals/SalesDashboard.tsx`,
`app/api/admin/deals/import/route.ts`, `app/api/admin/deals/validate.ts`,
`app/api/admin/deals/[id]/route.ts`, `lib/deals.ts`, `lib/supabase.ts`,
`docs/deals.md`.

## 2026-07-10 — Deal detail modal: click into any deal (Monday-style item card)

`/admin/deals` deals now open in a center modal from every list view — the
monday.com "View" habit, without per-deal pages. Click a row in **Pipeline**
or **CRM**, or the ⤢ icon in **Focused** (those rows keep their inline edits).

- View mode: money strip (cost/weighted/confidence), one-click Active/Won/Lost
  segmented status, all fields, an **Updates & notes** panel with a dated
  "Add update" composer (prepends "7.10.26 — …" lines to `notes`, the sheet's
  own convention — no schema change, survives re-imports), created/updated
  meta, Delete.
- "Edit deal" flips the card to the same form as New Deal (shared field styles
  in `app/admin/deals/form.ts`); Save PATCHes only the changed fields, Cancel
  discards.
- Prev/next chevrons + ←/→ keys page through the opening view's current
  filter/sort order ("14 / 440"); Esc closes. Deleted deals drop out of the
  browse order silently.
- Persistence rides the existing optimistic patchLocal → persist →
  revert-on-fail machinery — verified end-to-end in-browser (optimistic value,
  forced 401, revert + error banner, plus modal open/navigate/edit/cancel
  across all three tabs). `formatDateOnly` promoted to `lib/utils` (CRM's
  local copy removed).

No migration; `next build` green. Files: `app/admin/deals/DealDetailModal.tsx`
(new), `DealsClient.tsx`, `PipelineView.tsx`, `CRMView.tsx`, `FocusedView.tsx`,
`form.ts` (new), `lib/utils.ts`, `docs/deals.md`.

## 2026-07-10 — Sales Dashboard + monday.com board import (the real numbers are in)

`/admin/deals` grew a **Dashboard** tab (now the default) and a real Excel
importer, and the deals table now holds the sales team's actual forecasting
board — **440 deals, ~$91.3M raw / ~$23.6M weighted** — replacing the 5
migration-043 demo seeds.

- **Dashboard** (`app/admin/deals/SalesDashboard.tsx`): weighted-forecast hero
  with blended confidence, KPI row, $-quoted-per-month activity chart,
  pipeline-by-confidence funnel, Won/Open/Lost donut, group leaderboard
  (share of expected value), projected-close buckets parsed from the board's
  free-text `projected` column, largest open deals, a blended-confidence
  gauge, and derived "Needs attention" signals (stale >90-day quotes, big
  deals at ≤10% confidence, $0-value rows, undated rows). Every figure is
  computed live from the deals table — no sample numbers anywhere; cards that
  need data the board doesn't carry (quotas, activity counters) wait until
  Sales provides it. Quiet Precision throughout.
- **Importer**: `lib/deals-import.ts` parses the monday.com export's group
  blocks and maps columns by name; `POST /api/admin/deals/import` does
  dry-run preview → commit with Replace-board (default) or Add-on-top modes,
  `requireDealsAuth`-gated + audit-logged (`deal.import`); the Dashboard's
  "Import from Excel" modal shows per-group counts/$ and row warnings before
  writing. `scripts/import-sales-forecast.mts` (npx tsx) is the same-parser
  backfill path used for the initial load — per-group totals verified to the
  dollar against the sheet's own summary rows.
- **Deps/safety**: SheetJS pinned to the fixed 0.20.3 CDN tarball (npm's
  0.18.5 carries unfixed high advisories); `/docs/*.xlsx|xls|csv` gitignored
  so real pipeline exports can never land in this public repo; SVG trig
  coordinates rounded to dodge a Node-vs-browser `Math.sin` ulp
  hydration mismatch.

`next build` green; dashboard verified in-browser against the live import
(totals, funnel, buckets, attention signals) with zero console errors. Files:
`app/admin/deals/SalesDashboard.tsx`, `app/admin/deals/DealsClient.tsx`,
`app/api/admin/deals/import/route.ts`, `lib/deals-import.ts`, `lib/deals.ts`,
`lib/utils.ts`, `scripts/import-sales-forecast.mts`, `docs/deals.md`.

## 2026-07-09 — Annual Review print sheet: wider coaching notes, no core-values footer, + a portrait option

Follow-up tweaks to the bespoke `/print/annual-review` sheet:

- **Rating columns pulled left, coaching notes widened.** Each review section's
  ratings now sit in a fixed column right after the criteria text instead of being
  pushed to the far right, so the coaching-notes box grows from 212px → ~458px
  (landscape) — far more writing room. (`.sec .body` → `flex:none` + a fixed `.grid`
  first column of 340px; `.coach` → `flex:1`.)
- **Removed the core-values footer band** from the back (second) page.
- **Portrait option.** A Landscape/Portrait toggle in the on-screen top bar
  (`?orientation=portrait`, hidden in print) swaps the `@page` size and merges in a
  new `PORTRAIT_STYLE` — core values reflow 4-up and the fit-to-page compaction is
  relaxed since portrait has ~998px of vertical room. The "Download PDF" button + the
  printed page size follow the selection.

Both orientations verified to fit one sheet per page at 100% (measured on the actual
markup): landscape front 722px / back 671px (≤758px); portrait front 914px / back
781px (≤998px); no wrapped text, no overflow. `next build` green. Files:
`app/print/annual-review/page.tsx`, `docs/form-print-pdf.md`.

## 2026-07-09 — Annual Review print sheet: content edits + fits one landscape sheet per page

Requested edits to the bespoke `/print/annual-review` sheet (blank branded Annual
Review, front/back landscape):

- Removed the person icons from **Employee Name** and **Reviewer**.
- Added **"Follows IAT safety protocols"** to *Results & Execution* and **"Attendance
  and punctuality"** to *Teamwork & Communication*.
- Renamed the lowest rating **Performer → Needs Development** (performance-scale card,
  Overall Performance Rating pill, and the Development Plan note "(if rating is Needs
  Development)").
- **Development Goal → Development Goals** in the Overall Summary.
- Dropped **"Work with Excellence"** from the **Colossians 3:23** core value.

**Pagination fix for reliable duplex printing.** The sheet already ran taller than one
landscape Letter page at 100% (front ~946px / back ~849px vs ~758px usable) — so each
page spilled onto a second physical sheet unless the print dialog was set to "Fit to
page," which broke the front/back pairing. Added a **fit-to-page compaction** override
block to `STYLE` (tighter section padding, 1px rating-circle row gaps, smaller
header/title/core-value icons). Each sheet now measures **front ≈722px / back ≈719px**,
under the ~758px budget with ~⅜in headroom, so it prints as clean front/back at 100%
(flip on short edge). Content unchanged; verified by rendering the actual markup at the
print box model (front + back screenshots). `next build` green. File:
`app/print/annual-review/page.tsx` (+ `docs/form-print-pdf.md`).

## 2026-07-09 — Admin nav: "Employee Forms" merged into "Forms"

Removed the standalone **Employee Forms** item from the admin sidebar (Employees
section). It was redundant — `/admin/forms` already opens & fills any form via the ↗
preview arrow, so a second fill-gallery tab wasn't needed. The nav item is now
`hidden: true` in `AdminSidebar.tsx` (comment left explaining the merge), and the ⌘K
command-palette entry was delisted with its search keywords (`jotform / fill / submit /
resources / library`) folded into the **Forms** entry so search still lands there.
**Kept intact:** the `/admin/employee-forms` route, the `employee_forms`
role/permission, and the shared `EmployeeFormsView` — which still powers the
employee-facing `/employee/resources`. Re-enable the nav item by removing `hidden:
true`. No route/data/migration change. `tsc --noEmit` + `next build` green. Files:
`components/admin/AdminSidebar.tsx`, `components/admin/CommandPalette.tsx`.

Alongside it, a read-only forms audit (57 forms): 52 open via the ↗ arrow; the 5 that
show "This form is not available" are all **paused on purpose** (Annual Time Request &
Sick Time Form → replaced by the dedicated PTO/Sick request system; Annual Review
`[perf-new]` → throwaway test copy; Copy of Customer Satisfaction Survey → duplicate;
Customer Order Form → old/superseded) — left as-is per Jacob. No duplicate slugs, no
empty forms.

## 2026-07-09 — Gantt: sales onboarding (guided PDF + hover tooltips)

Sales loved the Gantt tool but couldn't drive it, so two **onboarding-only** layers
landed (no scheduling logic, data model, or migration touched):

- **Guided tutorial PDF** — a 12-page, branded, plain-English field guide for Sales
  at [docs/guides/gantt-sales-guide.pdf](docs/guides/gantt-sales-guide.pdf) (source
  `gantt-sales-guide.html`, regen `node docs/guides/render.mjs`). Covers the
  forecast-not-a-promise idea, a 60-second version, every control, which date to
  quote (P80), a customer do/don't script, and a pin-up quick-reference card.
- **Hoverable "?" reminders in the tool** — a shared `InfoTip` (CSS-only, keyboard-
  accessible, hidden in print) on the three top stats, the anchor, Baseline, the
  What-if row, Start date, and the Confidence / Assumptions / Tasks headers, plus a
  one-hover summary on the Gantt list page. Non-technical copy, accuracy-checked
  against `lib/gantt.ts`.

Copy went through a 4-lens review (accuracy vs. source, plain-language, coverage,
and a "software-shy sales rep" persona); the persona fixes — "which green box do I
read," "how do I set the anchor," "can I break it / there's no undo," "clicking a
what-if is safe," and "who owns the quoted date" — are baked into both deliverables.
The in-tool tooltips shipped to prod; the PDF guide lives in `docs/guides/`
(repo-only, not app-served). See [docs/gantt.md](docs/gantt.md).

## 2026-07-08 — Annual Review: dedicated branded print sheet

A fixed, branded two-page (front/back, **landscape**) print sheet for the Annual
Review at `/print/annual-review`. Front: logo letterhead, three review sections
(Results & Execution, Teamwork & Communication, Continuous Improvement) and the
eight IAT core values, each rated Superstar / Rockstar / Star / Performer with a
coaching-notes area. Back: the performance-scale legend, overall summary
(strength / opportunity / development goal), overall rating, employee comments,
a development plan, signatures, and a core-values footer.

Unlike the generic `/print/forms/[id]` view this is **not** field-driven — it's a
one-off branded layout (static markup, inline SVG icons, logo from `/public`).
The Annual Review form's "Download PDF" button (slug `perf-new`) now opens it;
every other form keeps the generic blank print. Admin-gated. See
[docs/form-print-pdf.md](docs/form-print-pdf.md).

## 2026-07-08 — Jerry's Brain v3: the reactor core is now a real plasma sun

The CSS-gradient wheel at the heart of `/admin/knowledge` is replaced with a
**real-time shader plasma sun** (Jacob's Doc-Ock reference, IAT edition) —
`components/admin/ReactorSun.tsx`, react-three-fiber (already a dependency via
the SRV 3D scene), no new packages. Custom GLSL: domain-warped noise for molten
convection, a roiling displaced silhouette, deep-teal → emerald → white-gold
heat ramp with crackle filaments, fresnel rim + additive corona. While Jerry
reads a document it visibly **boils harder and brighter** ("FEED ME" mode); an
absorb **blooms it white** for a beat. Loads client-side with the old CSS wheel
as the loading/WebGL fallback; honors `prefers-reduced-motion`. Verified via a
throwaway local shader harness: zero GLSL compile errors, idle/feed/flash states
confirmed visually.

## 2026-07-08 — Jerry's Brain v2: scrub preview gate + immersive reactor

Same-day follow-up to Jerry's Brain (below), on Jacob's direction. Two changes:

- **Scrub preview — nothing enters the pool without approval.** Feeding a file is
  now two phases: `POST /api/admin/kb/analyze` transcribes it (Claude, scans
  included) and returns a **scrub report** — competitor names (authoritative
  local check + the model flagging other HVAC brands), emails, phone numbers,
  customer-company and person names, plus a one-line summary — without writing
  anything. A **review card** shows the findings (competitors struck-through as
  "removed automatically"; PII as amber flags), lets the admin pick *Staff only*
  vs *Customer-facing* right there (warning if customer-facing + flagged names),
  then Approve sends the transcript to `POST /api/admin/kb/ingest` (now the
  commit phase) or Discard throws it away. The unconditional competitor scrub at
  chunk time is unchanged — the preview is a human gate on top. Verified live: a
  planted test doc's competitor name, customer, person, email, and phone were all
  flagged, and the committed text was confirmed competitor-free.
- **The reactor became the page.** The desiccant wheel now sits alone mid-screen —
  bigger, tilting toward the mouse (3D parallax), ambient emerald motes drifting
  across the scene, charging while it reads, pulsing on absorb, still growing
  with the pool. The explainer ("how this works"), live activity, stats, and the
  full document inventory moved to a collapsible **"Jerry's knowledge" panel
  pinned top-right**. Honors `prefers-reduced-motion`.

## 2026-07-08 — "Jerry's Brain": drag-and-drop documents into the knowledge base

A page where staff **feed documents straight into Jerry's knowledge** — the
Doc-Ock reactor the bossman described: drop a doc on the machine and Jerry learns
it. `/admin/knowledge` (admin-only) shows an animated **desiccant-wheel reactor**
that grows a hair with every passage learned, IAT-emerald motes orbiting, an
"absorb" pulse when a doc lands — plus the live list of everything in the pool.
Full docs: `docs/kb-rag-assistant.md`.

- **How it works** (reuses the Submittal-scanner pattern — no local binaries):
  signed upload URL → the file goes **straight to a private `kb-uploads` bucket** →
  the ingest route reads it back and has **Claude transcribe it** (vision-based, so
  **scanned/image docs work too** — this is why the CLI's `pdftotext` path couldn't
  run serverless) → chunk + competitor-scrub (`lib/kb-chunking.mjs`, shared with the
  CLI) → insert into the same `kb_documents`/`kb_chunks` pool Jerry retrieves from.
  Jerry can cite it in the very next answer.
- **Per-upload visibility toggle:** *Staff only* (default — internal Jerry only) vs
  *Customer-facing* (the customer assistant too). Delete = Jerry forgets it (chunks
  cascade).
- **No migration, no manual setup.** The `kb-uploads` bucket was provisioned
  programmatically (private). Verified end-to-end on the live pool: a doc was
  uploaded → transcribed → chunked → retrieved by the internal assistant, and
  confirmed hidden from the customer pool.
- The CLI `scripts/ingest-kb-docs.mjs` stays the bulk loader for the doc folder;
  this page is for ad-hoc additions. New nav item "Jerry's Brain" + `knowledge`
  permission (admin-only).

## 2026-07-08 — Internal Jerry: attach a photo/PDF to diagnose

The **internal** Jerrys — the standalone `/admin/jerry` page and the per-ticket
assistant — now let a staff member **attach a photo or PDF for Jerry to look
at and help diagnose** (a controller fault code, a nameplate, a wiring panel, a
submittal, a PO), the "like ChatGPT" flow. `claude-sonnet-4-6` is vision-capable,
so the file rides along on the same call alongside the retrieved manual excerpts
and (on a ticket) that unit's record. Full docs: `docs/kb-rag-assistant.md`.

- **Internal-only by construction.** Only `JerryWidget` callers passing
  `allowAttachments` show the upload UI, and only the two admin routes read
  attachments — the customer assistant ignores them.
- **UI:** paperclip / drag-drop / paste in the shared `JerryWidget`. Images are
  **downscaled in the browser** (long edge ≤ 1568px, JPEG) to stay under Vercel's
  ~4.5MB body cap and cost less; PDFs pass through (≤ 4MB). 4 files/turn, ~3.8MB
  total. Attachments persist in history so follow-ups keep the image in context.
- **Server (`lib/assistant-attachments.ts`):** re-validates media type / size /
  count and builds the Anthropic vision content (document/image blocks then text);
  the system prompt has Jerry read visible model/serial/error text, cross-check the
  ticket's equipment, and treat attachments as reference-only (never instructions).
- **No new deps, model, storage, or migration.** Verified end-to-end against the
  live model — a synthesized unit photo was read back correctly (model, serial,
  error code) with a diagnostic checklist.

## 2026-07-08 — Blank form print: branded letterhead + tidier header

Follow-up to the print/PDF redesign below. The blank-form print header now leads
with the IAT logo (a proper letterhead), and drops the generic, review-specific
"Employee / Reviewer / Date" band that was hard-coded onto every form's print —
forms capture identity via their own fields instead. Consecutive short
single-line fields (e.g. a name + a date) now pair two-per-row rather than each
taking a full line. Print-code only (`app/print/forms/[id]/BlankFormPrint.tsx`);
a form's own `description` still prints when set.

## 2026-07-08 — Blank forms print far shorter + a "Download PDF" button

The blank-form print view (`/print/forms/[id]`) — the fill-by-hand / save-as-PDF
version of any form — was redesigned to print much shorter, and the form editor
now surfaces it as a clear **Download PDF** button instead of a small "Print"
icon. No form's questions, options, scale, or data changed — this is purely how a
*blank* form renders on paper. See [docs/form-print-pdf.md](docs/form-print-pdf.md).

- **Rating matrix**: a run of 2+ choice questions sharing the same options (e.g.
  every Superstar/Rockstar/Star/Performer rating on the Performance Review) now
  prints as one table — the scale printed once as a repeating column header, one
  row per question — instead of relisting the four options under all ~26
  questions. Each rating keeps its own comment line, folded in from its
  "— Brief Explanation" box.
- **Untouched**: one-off choice questions and every other form render exactly as
  before (the matrix only groups 2+ questions sharing a scale); the conditional
  controller (e.g. `Department`) is never matrixed.
- **Result**: the Performance Review prints in ~2 pages (individual contributor)
  / ~3 (manager), down from ~7 / ~9.
- **Files**: `app/print/forms/[id]/BlankFormPrint.tsx` (layout),
  `components/admin/FormBuilder.tsx` (the toolbar "Download PDF" button).

## 2026-07-07 — Admin list views: one shared "Forms-style" design language

Every admin list now speaks the same visual language — the clean, professional
look of the Forms page, applied portal-wide. New shared primitives in
`components/admin/list.tsx` (documented in `docs/design-language.md`); no
migration, presentation-only.

- **New primitives**: `ListPageHeader` (small-caps overline + bold title + light
  count + right-aligned actions, with tabs/filters in the header band),
  `IdentityCell` (the signature bold-title-over-muted-subtitle row identity, with
  `icon`/`leading`/`mono` slots), and shared `tabCx`/`tabCountCx`/`filterPillCx`
  styles so underline tabs and status pills look identical everywhere. The
  shared `ROW` is now airier (`min-h-[52px]`).
- **Converted** (header + stacked identity + simplified columns): Tickets,
  Submissions, Equipment, Customers, Employees, Deals (all three views),
  Employee Forms, PTO/Sick queues, Presentations, Gantt, Audit/Logins, Accrual,
  and the hidden Troubleshooting + US Rotors queues. Each row leads with a bold
  primary line over a muted secondary line; redundant columns (IDs, a rep, a
  category) fold into that subtitle, and low-value columns were dropped so each
  list reads as identity + a few meaningful columns + real actions rather than a
  spreadsheet. All behavior (sorting, bulk-select, filters, modals, links,
  permissions) is unchanged.
- Because `EmployeeFormsView` is shared, the employee-facing `/employee/resources`
  list inherits the same look — consistent by design.

## 2026-07-07 — Jerry: IAT unit-nomenclature internal reference

The **internal Jerry** (the standalone `/admin/jerry` page and the per-ticket
assistant) can now decode any IAT model or serial number. Added a curated
internal reference — **"IAT Unit Nomenclature (2022)"** — to the KB pool from the
2022 nomenclature sheet plus the current product lineup provided by leadership:
the model-number breakdown (nominal CFM, system type `R`/`D`/`B`/`AHU`,
reactivation `E`/`S`/`G`/`HW`, `HC` high-capacity, `/IDP` integrated package,
actual-CFM suffix), the serial-number format (year of sale + perpetual sequence),
and the Compact / Rotor / IDP model lists with worked IDP examples.

- **Internal-only** (`is_internal=true`) — surfaces for the two staff-facing
  Jerrys (`includeInternal: true`), never for the customer assistant. Verified:
  it's the top hit on decode questions for internal, and absent from the customer
  pool.
- **New "curated reference docs" ingest path.** IAT-authored references now live
  as committed Markdown in `scripts/kb-reference/` (unlike the gitignored
  third-party `ocr-cache/`, since this is IAT's own content) and ingest into the
  same pool via `node scripts/ingest-kb-docs.mjs --curated` (also folded into
  `--all`). Data-only — no migration, no app change (the internal routes already
  retrieve with `includeInternal: true`). Full docs: `docs/kb-rag-assistant.md`.

## 2026-07-07 — Deals: sales pipeline MVP ("Forecast Pulse"), the first scoped write

The Monday.com Sales Forecasting board rebuilt natively at `/admin/deals` — a
parallel MVP that runs alongside Monday until Sales proves it out. Requires
migration `043_deals.sql` (applied to prod 2026-07-07 before deploy). Full
docs: `docs/deals.md`.

- **One `deals` table, three tabs.** Pipeline (financial forecast: summary
  strip with total/weighted/win-rate, group-by-rep subtotals, inline
  Won/Lost/Active status), CRM (relationship view: rep + contact + quoted date,
  click-to-expand notes, recent-activity flag), Focused (action list: open
  deals with confidence ≥ 60 / a timeline / notes, inline-editable
  confidence/projected/notes that persist on blur). All three stay mounted so
  each keeps its own filter/sort state across tab switches; sortable columns
  follow the Tickets-queue pattern. New Deal modal + row delete round out CRUD.
- **`weighted` is derived, never stored** — always
  `total_cost × (confidence / 100)`, computed in `lib/deals.ts`
  (`computeWeighted`/`computeSummary`, pure functions via `useMemo`), same
  convention as Gantt's derived values.
- **First scoped write for a non-admin role.** New `deals` permission granted
  to `sales`; its API routes (`app/api/admin/deals`) gate on a new
  `requireDealsAuth()` (`lib/api-auth.ts`) accepting any role with the `deals`
  permission — a deliberate, narrow exception to the "scoped roles are
  view-only" v1 boundary (inline editing by reps *is* the feature). Documented
  in `docs/roles-and-permissions.md`; every other write API still gates on the
  strict admin-only guard.
- Also: `formatCurrency` added to `lib/utils.ts` (first shared currency
  helper), `DEAL_STATUS` tone map in `components/admin/list.tsx`, nav/⌘K/
  department-dashboard wiring.
- **Pre-ship review fixes** (multi-agent review, 18 confirmed findings → 6
  deduped fixes): full field validation on both API routes via a shared
  sanitizer (`app/api/admin/deals/validate.ts` — `total_cost` bounds,
  integer-rounded confidence, null-safe customer check, date format, clean
  400s instead of raw Postgres 500s; PATCH now 404s on a stale/deleted id);
  `date_quoted` formatted as a local calendar date (bare-`date` columns parsed
  UTC render a day early in US timezones); Focused rows stay mounted while an
  inline input has focus (editing confidence below 60 used to unmount the row
  before blur, silently dropping the save); failed/network-dropped saves now
  roll back to the last-known-server value instead of leaving phantom numbers
  in the totals (and the New Deal modal can't wedge in "Creating…");
  expanded CRM notes grow the row instead of painting over rows below;
  grouped-Pipeline corner/divider styling and CRM first-click sort direction
  (A→Z, blanks always last) corrected.

## 2026-07-07 — Form UX: reviewee name in the fill-modal header + field-settings follows the field

Two form editing/filling niceties. No migration.

- **Fill modal header shows who the form is about.** When an "Employee Name" (or
  "Full Name" / "Name") is entered, the `StepFormModal` header reads e.g.
  **"Performance Review Form — Jacob Younker"**, updating live as it's typed. Uses the
  same helper as the draft label, so the header and the "Continue where you left off"
  entry stay consistent. (`components/StepFormModal.tsx`)
- **Form builder: the "Field Settings" panel sticks to the top of the viewport.** Editing a
  field near the bottom of a long form no longer leaves the editor stranded off-screen — the
  right-column settings panel stays pinned at the top of the visible area as you scroll.
  Degrades to the previous top-anchored behavior if a measurement is unavailable (so it's
  never worse than before). (`components/admin/FormBuilder.tsx`)

## 2026-07-06 — Department dashboards, a standalone Jerry page, "View as" fix, mobile pass

A batch of admin-surface fixes and features.

### Added
- **Department dashboards.** Every scoped role (sales/hr/marketing/engineering/
  production_manager) now has `dashboard` in its permission list, so `/admin`
  is a real landing page for them (`homeForRole` sends anyone with `dashboard`
  to `/admin`) instead of redirecting to their first permitted section.
  `app/admin/page.tsx` branches: `admin` still renders the unchanged executive
  dashboard; every scoped role renders the new
  `components/admin/DepartmentDashboard.tsx` — real Supabase counts + a short
  recent-activity list scoped to what that role can see, plus a "Quick Links"
  grid generated from `ADMIN_SECTIONS` filtered by `hasPermission` (stays in
  sync automatically as sections/permissions change). No migration.
- **Jerry gets a standalone, full-page "GPT style" chat** at `/admin/jerry` —
  any admin-surface role can use it (new `jerry` permission, granted to every
  scoped role) to ask internal questions or just try Jerry out. Backed by a new
  general-purpose route (`app/api/admin/assistant/route.ts`, same RAG pipeline
  as the ticket assistant with `includeInternal: true`, gated by the loose
  `getAdminSurfaceUser()` rather than the strict `getAdminUser()`) — deliberately
  separate from the per-ticket Jerry, which stays grounded in one ticket's
  equipment/problem context. `components/shared/JerryWidget.tsx` gained a
  `fullHeight` prop so the same widget renders as either the compact sidebar
  card or a full chat surface with the composer pinned to the bottom. Added to
  `AdminSidebar` (right after Dashboard) and the command palette.
- **A soft, static gradient-orb background** behind the `/admin` executive
  dashboard's content — two large, very-transparent blurred emerald/sky circles
  via a negative-z-index layer, no motion (calm-design convention).

### Fixed
- **The new gradient-orb background wasn't actually visible.** The orb layer sits
  at `-z-10` inside the `/admin` scroll container, but that container has an
  opaque `bg-zinc-50`/`#0a0a0b` fill and was `position: relative` with no
  `z-index`, so it never formed its own stacking context — per the CSS painting
  order the negative-z layer dropped *behind* the container's own background and
  was painted over (the classic "negative z-index child disappears behind the
  parent background" trap). Added `isolate` (`isolation: isolate`) so the
  container owns the stacking context — the negative-z orb now paints over its
  own background and under the content — and nudged the dark-mode opacities up so
  the intended very-transparent glow actually reads (`app/admin/page.tsx`).
- **"View as [role]" dropdown was clipped after 2-3 options.** Root cause: the
  sidebar `<aside>` is `overflow-hidden` (for its rounded/sticky layout), which
  clipped the absolutely-positioned dropdown once it extended past the
  sidebar's own box — not a missing scrollbar. Rebuilt as a `document.body`
  portal with `position: fixed`, measured from the button's own bounding rect,
  so it always escapes ancestor clipping regardless of viewport height
  (`components/admin/ViewAs.tsx`).
- **Removed the `/admin/reset` Data Reset panel** (page, API route,
  `lib/reset-targets.ts`, nav entry, the now-unused `system` permission, and its
  docs section) per request — it was a pre-launch cleanup tool, not something
  meant to stick around.
- **Submissions detail page restyled to match the ticket detail's rhythm.**
  Short answers now render as compact label/value rows (a new shared `Field`
  component in `components/admin/detail-ui.tsx`, also adopted by
  `TicketDetailClient` to drop its own duplicate copy) instead of one
  label-above-value block per field; only the first form section is open by
  default, and every section after that folds into one collapsed "More
  responses" `<details>` accordion — so a long, multi-section form no longer
  reads as one endless scroll. Signatures, file/image values, and long free
  text (>90 chars) still get their own full-width block.
- **Mobile pass on the admin surface.** Added a `TableScroll` wrapper
  (`components/admin/list.tsx`) around the 6 shared-primitive tables
  (Submissions, Tickets, Equipment, Customers, Employees, Troubleshooting) so a
  table with more fixed-width columns than a phone screen scrolls horizontally
  instead of squeezing every column illegible-thin. Reduced fixed `px-8`/`p-8`
  page padding to responsive (`px-4 sm:px-8` etc.) across essentially every
  admin page shell, and added `flex-wrap` to a few header rows that packed a
  title + action button on one line.

`tsc --noEmit` and `next build` both green (all routes registered, including
the new `/admin/jerry`). Auth-gated throughout — no login session was
available to click through interactively this pass, so this was verified by
type-check + production build + careful manual review rather than a logged-in
screenshot; a real click-through (especially the department dashboards,
Jerry's new page, and the mobile table scrolling) is still worth a human pass.

## 2026-07-02 — Multi-select bulk delete across every admin list

Checkbox multi-select + a bulk **Delete** in every list view, for fast cleanup.

### Added
- Multi-select on Submissions, Tickets, Equipment, Employees, Customers, and the
  PTO/Sick time-off queue (checkbox per row + select-all + a floating action bar).
  Submissions & Tickets already had multi-select for status changes — Delete was
  added to their bars (and the misleading "Discard", which only cleared the
  selection, is now "Clear").
- One generic admin-only, audit-logged endpoint (`/api/admin/bulk-delete`) behind
  a two-step confirm. Reuses the per-record safety: account deletes free the email,
  the employees bulk-delete skips your own account, ticket/submission deletes clear
  child notes first, and partial outcomes (skipped/failed) are surfaced.

### Hardened (adversarial review)
- Selection is cleared whenever the visible set changes (filter, tab, search, sort,
  or pagination), so a bulk delete can never act on rows the admin has scrolled or
  filtered out of view.

## 2026-07-02 — Gantt v2.1 "Living Schedule": task status, actuals, computed health

Phase 3 of the Gantt plan: the chart stays honest **during execution**, not just
at planning time. No migration — status lives inside the `tasks` jsonb.

### Added
- **Per-task status** (not started / underway / done) in the task table. Marking
  a task done records its actual end date (seeded from the plan, editable) and
  **pins the chain to reality**: all lanes collapse to the actual, downstream
  reflows, the task's risks leave the Monte Carlo, and the ship window narrows
  as work completes. Done bars render muted with "✓ done <date>".
- **Anchor arrival as fact** — once the long-lead task is done, the drag pill and
  slider are replaced by an "arrived <date>" note; the callout switches from
  "if items arrive by" to "items arrived".
- **Computed health vs baseline** — per task: ≤0.5 wks on-track (silent, calm),
  ≤2 at-risk (amber), >2 slipped (rose), shown as "+X wks vs baseline" in the
  chart labels and print. The "conditional formatting" leadership pictured,
  derived from data instead of hand-painted.
- Progress readouts: "N of M steps complete" in the callout and printed sheet.

### Hardened (adversarial review — 12 findings, all fixed pre-merge)
- **Actuals are absolute dates, not week-offsets.** A completion date is a recorded
  fact; storing it relative to `start_date` (as the first cut did) meant editing the
  chart's start silently rewrote every recorded actual — the exact failure mode
  baselines were made absolute to avoid. `actualEnd` is now a `YYYY-MM-DD` and only
  its axis position depends on `start_date`.
- **Health is plan-vs-plan.** Per-task health now computes on the what-if-stripped
  layout, so firing a scenario chip no longer paints rows "+N wks vs baseline" while
  the variance stat reads "on plan" (and the printed sheet no longer self-contradicts).
- **"Done" seeds from the plan, not the what-if.** Marking a task done takes its
  actual from the fired-risk-stripped layout, so a hypothetical delay can't be baked
  into recorded fact.
- **Duplicate is a clean new plan** — it now strips completion status/actuals too (it
  already reset what-if flags and dropped the baseline), so a copy isn't born
  pre-completed and locked to the source project's history.
- What-if banner / chips / legend / print now count only live (non-done) tasks' fired
  risks — a done task's risks are history and were already excluded by the engines.
- Done label shows the recorded actual date (matching the table) even when the bar
  clamps to the chain; clamped done bars keep a visible sliver.
- Math script grown to 51 assertions (adds: start-edit can't move a recorded actual;
  fired what-if moves layout but not health; late done task reads slipped) — all
  green; tsc + production build pass.

## 2026-07-02 — Per-record delete (individual submissions, tickets, employees, …)

Complements the bulk Data Reset with surgical, one-at-a-time deletion for cleanup.

### Added
- A reusable **Delete** control (two-step confirm) on each record's detail page —
  submissions, tickets, equipment, customers, employees — plus a per-row delete in
  the PTO/Sick time-off queue. Each has its own admin-only, audit-logged `DELETE`
  endpoint.
- Employee and customer deletes remove the Supabase auth login (frees the email for
  re-invite), matching the Data Reset behavior. Employee delete is distinct from
  Deactivate (which stays for offboarding real staff) and refuses to delete your
  own account (the button is also hidden on your own page).
- Ticket/submission deletes remove child notes first so a record with notes can't
  fail on a foreign key.

### Hardened (adversarial review)
- Employee delete only falls back to a direct row-delete on a genuine "user not
  found"; any other auth-API error returns 500 without deleting the row, so a
  transient failure can't orphan the login and leave the email occupied.
- Customer delete removes the company row before the (irreversible) login deletes,
  so a failure leaves the record intact for a clean retry instead of a half-deleted
  "can't log in but still listed" state.

## 2026-07-02 — Roles & permissions, "View as" preview, and Data Reset panel

Go-live prep: replaces the coarse admin/employee split with seven staff roles and
adds an admin-only tool to wipe test data cleanly before launch. Full write-up in
`docs/roles-and-permissions.md`. **Requires migration `042_roles_permissions.sql`.**

### Added
- **Granular staff roles** — `admin, sales, hr, marketing, engineering,
  production_manager, production` (plus external `customer`). The base employee
  tier is renamed to `production`. Each role sees only its permitted admin tabs;
  the permission matrix lives in `lib/roles.ts` (the single source of truth,
  imported by the edge middleware, server, and client alike).
- **Two-layer access control** — the sidebar filters nav by permission AND the
  middleware page-gates scoped roles, so a hidden tab can't be reached by typing
  its URL. Any unmapped `/admin` route fails closed to admin-only.
- **"View as [role]"** — an admin-only sidebar control that previews the portal as
  any role would see it, with zero effect on the admin's real access (client-only).
- **Data Reset panel** (`/admin/reset`, admin-only) — per-dataset bulk delete
  (submissions, tickets, equipment, customers, PTO, sick, employees) behind a
  type-`DELETE` confirm. Account deletes remove the Supabase auth user so the
  email is immediately reusable; the employees wipe preserves all admins.

### Changed
- Role is assignable when inviting an employee and on the employee detail page.
- Login, the root router, and the auth callback each route a user to the correct
  home for their role via the shared `homeForRole()` helper.

### Fixed / hardened (from an adversarial preflight review)
- Removed a legacy `is_admin`→role sync from `/api/employees/[id]` that wrote the
  now-retired `employee` value unchecked — it could have left a demoted admin with
  full access. All role changes flow through the validated role endpoint.
- Migration 042 keeps `employee` as a deprecated transitional CHECK value so the
  old app can't error during the deploy window, and swaps `time_off_requests.
  reviewed_by` to `ON DELETE SET NULL` so the employees wipe can't be silently
  blocked by a foreign key.
- The reset tool now surfaces per-account delete failures and the customers-delete
  error instead of swallowing them.

### Migration
- **042_roles_permissions.sql** (required) — widens the `profiles.role` CHECK,
  migrates existing `employee` rows to `production`, repoints the signup trigger,
  and fixes the `reviewed_by` foreign key.

## 2026-07-02 — Gantt v2 "Honest Schedules": windows, baselines, risk rules, Monte Carlo

Answers leadership's critique of the Gantt tool ("deceptive and deep, with a ton
of nuances and conditional IF-THEN statements") with the mechanisms real
scheduling tools use (LiquidPlanner ranged estimates, MS Project baselines,
Primavera-style P50/P80/P90, RiskyProject probabilistic branching). The chart is
now a **forecast instrument**, not a promise. Full write-up in `docs/gantt.md`.

### Changed
- **Ship windows everywhere** — list cards, editor stats, callout, and print show
  "best – worst" (plan date secondary); the single ship date is gone. Bars draw a
  faded extension to their own worst case; milestones get accumulated
  best–worst whiskers instead of false-precision diamonds.
- **Scenario toggle retired** — it was itself a false-precision machine (click
  "Best case", screenshot it). The always-on window + P80 replaces it; the DB
  column stays for compat.
- **Failure toggle generalized** into per-task **risk rules** `{prob %,
  delayMin–delayMax, note}` — several per task, edited inline in the task table.
  Each risk is a what-if chip; "firing" it cascades the schedule, persists, and
  is loudly labeled on screen + print. Legacy `failure`/`reset_weeks` migrate
  lazily onto the anchor task (`normalizeChart()`); columns deprecated.

### Added
- **Baselines** — freeze the computed schedule as absolute dates (audit-logged);
  ghost bars under live bars; variance chips (emerald/amber/rose); what-ifs
  excluded from variance (plan vs plan).
- **Monte Carlo confidence** — 5,000 seeded client-side simulations (triangular
  durations, Bernoulli risks) → P50/P80/P90 ship dates + histogram + per-risk
  impact ("fires in 25% of runs, avg +7.8 wks"). Copy teaches the discipline:
  commit externally to P80.
- **Assumptions register** — editable, prints with the chart.
- **Print-designed sheet** — window headline, what-if banner, baseline variance
  table, risk register, assumptions, "Forecast, not a commitment" footer.
- Editor split into render-only components (`GanttChartView`, `TaskTable`,
  `ConfidencePanel`, `AssumptionsCard`, `PrintSheet`, `ui`); drag logic unchanged
  and spread-preserving (dragging the anchor keeps a user-entered range).

### Deploy / notes
- Run `041_gantt_ranges_risks.sql` in the Supabase SQL editor **before**
  deploying (autosave writes the new `baseline`/`assumptions` columns).
- Math verified by a 31-check sanity script: legacy charts compute identical
  dates through the new code; MC is deterministic, ordered (P50≤P80≤P90), and
  bounded by the analytic window; histogram binning capped for wide spreads.
- Pre-prod adversarial review (4 dimensions, each finding independently
  verified) caught + fixed 6 issues before ship: cleared start-date stranding
  every autosave; a deleted migrated risk reappearing on reload; the
  duplicate-during-debounce race; the 60-task silent cap; duplicate dropping a
  legacy contingency; and (found in passing) the debounced autosave logging a
  baseline audit event on every keystroke (baseline set/clear is now its own
  audit-logged action, out of the autosave path).

## 2026-07-01 — Gantt / Project Timelines: internal tool for customer project schedules

A new admin-only **Gantt** tab (`/admin/gantt`) for building and tracking customer
project schedules as interactive Gantt charts. Sales asked for a schedule on a
specific customer build; rather than a throwaway file that can't save, it's a
persistent, shareable portal tab. A timeline is a finish-to-start chain with one
**anchor** task (the long-lead / critical-path driver) whose arrival date drives
everything downstream — drag it (or the slider) and the whole tail re-cascades. A
**test-failure** toggle models the schedule reset (replacement long-lead parts,
`reset_weeks`), and ranged durations feed a Best/Likely/Worst scenario toggle.
Full write-up in `docs/gantt.md`.

### Added
- **`gantt_charts`** table (migration `040_gantt_charts.sql`) — one row per
  timeline; tasks stored inline as jsonb. Service-role only (RLS on, no policies).
- **`lib/gantt.ts`** — shared types + pure scheduling math (`layout`, `effDur`) +
  Auckland/blank templates; server-safe, so list and editor compute identical dates.
- **`lib/gantt-data.ts`** + **`app/admin/gantt/actions.ts`** — admin-gated,
  audit-logged reads and mutations (`create`/`update`/`duplicate`/`delete`).
- **`/admin/gantt`** list (cards, est-ship, new-from-Auckland-template) and
  **`/admin/gantt/[id]`** editor (draggable arrival anchor, scenario toggle,
  failure sim, editable task table, live stats, Print/PDF). Edits autosave.
- **Gantt** nav item in the `AdminSidebar` "IAT" section.

### Deploy / notes
- Run `040_gantt_charts.sql` in the Supabase SQL editor **before** deploying.
- Access is admin-only for now; Sales gets in via a temporary `admin` role.
  Role-based permissions (Sales sees Gantt, not PTO/Time Off) are still to come.
- Leadership flagged that a simple Gantt oversimplifies these projects' branching/
  conditional schedules; kept visible to demo. Pausing later = add `hidden: true`
  to the nav item (code, routes, and migration 040 all stay).

## 2026-07-01 — Portal-wide "calming" pass: subtracted visual noise on every surface

The portal — the `/admin` dashboard especially — had started to feel "in your
face." A density review across all nine surfaces found the bones (layout,
spacing, type, the shared card/list kit) were sound; the crowding came from
**decoration without meaning**: accent color used ornamentally (rainbow KPI
icons, six-color palettes, non-semantic rank-bar hues), the same fact rendered
two or three times (status/priority, streak/XP, stacked hero glows), and
animation that never rested (Jerry's idle orb, an alarm-red pulsing badge, an
infinite "Live" pulse, and a fake "⋯" affordance that did nothing). This pass
subtracts that noise everywhere while preserving every piece of information and
all behavior. Principles captured in `docs/design-language.md`.

### Changed
- **Shared DNA** — `AdminSidebar` nav count badges: solid saturated fills → soft
  tinted chips; `list.tsx` `StatusPill`: single soft fill (no border) +
  `semibold`; `PortalHero`: two glow blobs → one. Calms every portal at once.
- **Admin dashboard** (`app/admin/page.tsx`, `ExecutiveBriefing.tsx`) — one
  emerald focal point (flattened the Briefing, single hero glow), removed the
  non-functional `MoreHorizontal` "⋯" from KPI tiles, sparklines only on
  delta-bearing KPIs, Top-Forms/Top-Submitters rank bars recolored to emerald,
  secondary rail cards flattened, section rhythm `space-y-4`→`6`.
- **Customer + Jerry** (`CustomerDashboard.tsx`, `globals.css`) — Jerry's orb is
  calm at idle (one gentle breathe); the spin/orbit/twinkle now run only behind
  `.is-thinking` while he's answering. Cyan removed (pure emerald). Dropped
  redundant counters and muted request pills. Winding-road tracker untouched.
- **Ticket detail** (`TicketDetailClient.tsx`) — Problem Description promoted to
  the top; six read-only intake echoes folded into one collapsed "Intake details"
  disclosure (11 cards → ~5); duplicate status/priority pills removed from the top bar.
- **Support** (`app/support/page.tsx`, `status/StatusClient.tsx`) — alarm-red
  "Start here" badge → quiet emerald; five "coming soon" ghost cards → one-line
  note; static status dot; trimmed the run-on hero subtitle; softened
  secondary-card shadows.
- **Learn** (`app/learn/page.tsx`, `me/page.tsx`, `BadgeIcon.tsx`) — removed the
  duplicate dashboard stat strip; unified the four stat-tile hues to emerald;
  locked badges preview 4 behind "show all"; softened earned-badge tiers.
- **Employee** (`profile/page.tsx`, `EmployeeFormsView.tsx`, `OrgDirectory.tsx`) —
  unified KPI icon color; folded Quick Actions into the hero; muted the amber
  drafts panel; capped directory interest chips at 2 + "+N".

Sibling landing (`iat-home`) and ticketing (`iat-ticketing`) repos got matching
micro-fixes (one-shot "Live" pulse, tag trim; collapsed "coming soon" cards,
lighter review rows). No data, props, or behavior removed — visual noise only.
`tsc` + `next build` green. No migration. — J.Y. + Claude


The "Scan a Submittal PDF" tool in `NewCustomerWizard` sent the file as base64
directly in the POST body to `/api/admin/customers/extract-submittal`. Vercel
caps serverless function request bodies at ~4.5MB, so any Submittal whose
base64 exceeded that — roughly anything over ~3MB raw — was rejected by the
platform itself *before the route ever ran*, regardless of the route's own
(much higher) size check. The browser just got a non-JSON response back,
which surfaced as a generic "Could not read that file." A previous fix had
raised the route's own limit from 6MB to ~11MB, which didn't help — that
ceiling was never the actual constraint. Reported via a 7.1MB real Submittal.

### Fixed
- **`components/admin/NewCustomerWizard.tsx`** — the scan handler now uploads
  the file directly to Supabase Storage via a signed upload URL (new `POST
  /api/admin/customers/submittal-upload`, mirrors the existing
  ticket-attachments pattern) instead of embedding it in the function body.
- **`app/api/admin/customers/extract-submittal/route.ts`** — now accepts a
  Storage `path` instead of inline base64; downloads the file server-side
  (an outbound fetch, not subject to the inbound body-size limit) before
  handing it to Claude, and deletes it right after extraction (best-effort;
  it's not needed afterward and may contain customer PII).
- **New private bucket `admin-submittals`** (migration `035`, 20MB limit —
  comfortably above real-world Submittals, well under Claude's per-file cap).

`tsc` + `next build` green. Requires migration `035` before the fixed upload
path works; degrades to the same "could not read" error if deployed first
(no crash). — J.Y. + Claude

## 2026-07-01 — Self-serve "Request portal access" from support tickets

Customers no longer need a portal account forced on them just to check a
ticket, but can now opt in to one from a ticket they've already submitted —
gated by admin approval, not auto-created.

### Added
- **`RequestAccountCta`** (`components/support/RequestAccountCta.tsx`) — a
  shared CTA on the ticket success screen and the `/support/status` lookup
  result. Re-proves ownership via the same ticket-number + email match the
  status lookup already uses (`POST /api/tickets/request-account`); suppressed
  for already-logged-in portal customers, and shows "already linked" /
  "pending" states instead of re-submitting.
- **`customer_portal_requests`** table (migration `034`) — a pending queue,
  not an auto-created account. Snapshots the requester's details off the
  ticket (not client input) and carries a `suggested_customer_id` signal
  (set when the ticket's equipment serial is already linked to an existing
  customer) so the approving admin can spot a likely second-contact case
  instead of creating a duplicate company.
- **`/admin/customers` → Requests tab** (`CustomerRequestsQueue.tsx`) — pending
  count badge, each row linking back to the originating ticket. **Approve**
  opens `NewCustomerWizard` pre-filled from the request (now accepts an
  `initial` prop + a "attach to this company instead" toggle); **Deny** closes
  the request with an optional reason, no email sent.
- **`tickets.customer_id`** (migration `034`) — approving a request stamps it
  on the triggering ticket and backfills any other historical ticket from the
  same email, additive to `POST /api/admin/customers/invite`
  (`link_ticket_id` / `link_request_id`). Both `/customer` and
  `/admin/customers/[id]` now match tickets on `customer_id OR email OR
  serial` instead of email/serial only.

### Changed
- Confirmation email (`lib/resend-tickets.ts`) gained one line pointing back
  to the status page, where the CTA lives once ownership is re-proven — no
  new link, no email address in a URL.

Migration `034` applied to the DB before deploy. `tsc` + `next build` green.
End-to-end verified live in-browser up through ticket submission + the CTA
render/click; the approve/deny loop needs a post-migration pass. — J.Y. + Claude

## 2026-06-30 — OCR'd the image-only PDFs into Jerry's pool (+9 docs)

16 of the 80 source PDFs are image-only/scanned (no text layer), so they'd always
WARN-and-skip on ingest. They're now folded in via OCR — **no software install**, just
Claude PDF-vision and the existing `ANTHROPIC_API_KEY`.

### Added
- **`scripts/ocr-image-pdfs.mjs`** — transcribes each image-only PDF with Claude
  PDF-vision into a local sidecar `scripts/ocr-cache/<file>.txt` (page-delimited).
  Idempotent (cache-skips); `--force` / `--docs=` to re-run one.
- **`readOcrSidecar()` in the ingest script** — when a PDF extracts to 0 chunks, the
  ingest falls back to its OCR sidecar, so `--all` folds the scanned docs in.

### Changed
- **9 OCR'd docs ingested** (clean vendor-named titles + categories): Maxitrol Selectra
  94 gas valve, Belimo LF24-MFT-S, Belimo TF120, Fasco D215 motor, Fasco approval
  drawing, Control Products HS-70-O/HS-70-D sensor, Phasetronics EZ1 SCR, DRI rotor
  spec, NEMA Premium motor guide. Pool **58 → 67 docs (61 customer-facing), ~3,228
  chunks**. Verified each retrieves + cites correctly through Jerry's real path.
- **5 excluded** via `SKIP_DOCS` — 2 GE HumiTrac scans (already covered by
  `GEH2-D-TT2`/`GEH-S-TT3`/`DP4A`); `MMSQPL` + `Terms Certifigroup-MET Labs` (IAT
  internal business forms — an insurance questionnaire and a pricing quote, not product
  docs); and `ZWN030X6D Cond Unit Manual` (OCR revealed it's the **same Heatcraft
  H-IM-CU condensing-unit manual** already in the pool as `H-IM-CU-0808.pdf` — caught by
  verifying retrieval, the "ZWN…" filename is just an order number).
- **`scripts/ocr-cache/` is gitignored** — this repo is **public**, so full third-party
  manual text + the internal-form transcriptions stay out of git; the text lives only in
  the RLS-locked KB DB after ingest (same posture as the rest of the pool). Also
  gitignored `scripts/_*.mjs` (throwaway dev harnesses).

The OCR'd text is competitor-scrubbed at ingest like everything else. Data is already
live in the DB (ingest is data-only). The big 9 MB `ZWN030X6D` scan needed splitting into
page-batches to OCR (single-call timed out); once transcribed it proved to be a dup (see
above), so it was removed and excluded. `tsc` + `next build` green; no migration.

## 2026-06-30 — Jerry never names a competitor (Munters scrub, 3 layers)

IAT leadership's rule: a **competitor's name must never reach a customer through Jerry**
— not in an answer, not in a cited document's title, nowhere. Munters is the only
competitor in the corpus (component suppliers like Omron/Vaisala/Belimo are kept — those
names are useful and expected).

### Added
- **`lib/competitors.mjs`** — single source of truth (plain `.mjs` so the Node ingest
  script and the TS API route share it). `scrubCompetitors()` neutralizes every brand
  reference, even glued into a URL/email/compound word (`www.MuntersAmerica.com`,
  `info@muntersnv.be`); guarantee: `hasCompetitor()` is false afterward. One-line to add
  the next competitor.

### Changed
- **Ingest** (`scripts/ingest-kb-docs.mjs`) — chunk content is scrubbed before storage
  (so the `tsv` can't even index the brand), and citation titles are de-branded:
  Munters handbook → **"Dehumidification Guide"**, M120 → **"M120 Desiccant Dehumidifier"**.
- **Assistant** (`app/api/customer/assistant/route.ts`) — excerpts + source titles are
  scrubbed before the model sees them; a system-prompt rule forbids naming any competitor
  **and** revealing a referenced doc's publisher/author/address/provenance; the final
  reply is run through `scrubCompetitors()` as a net.
- **Document policy** — the 228-page competitor-authored handbook is held
  **`is_internal=true`** (its front matter leaked the publisher's address/editor — an
  indirect identifier a prompt can't fully launder out of 228 pages). De-branded and
  available to a future employee assistant; re-enable for customers by removing it from
  `INTERNAL_DOCS`. M120 stays customer-facing, de-branded. Customer-facing pool now 52
  docs (6 of 58 internal).

Data already re-ingested against the live DB (pool is Munters-free). **Verification:** a
node harness replays Jerry's real answer path; 31 adversarial probes (direct, oblique,
jailbreak, authority, translation/OCR tricks, footer/metadata extraction, "Swedish
company") were judged by an independent 2-judge panel — **0 direct or indirect leaks**;
supplier controls (Belimo/Vaisala/Omron) still answer correctly. `tsc` + `next build`
green. No migration. Auth-gated — verified via build + node harness, not a logged-in
screenshot.

## 2026-06-30 — Admin: "Employee Forms" sidebar item + unfinished-draft badge

Makes an admin's in-progress form drafts easy to find (the `/admin/employee-forms`
fill library — which carries the "Continue where you left off" resume list — had no
sidebar link, only ⌘K). Now there's a clear entry point with an at-a-glance count of
unfinished work.

### Added
- **"Employee Forms" nav item** in the admin sidebar (Employees section, beside the
  "Forms" *manager*) → `/admin/employee-forms`.
- **Amber draft-count badge** on it — the number of the signed-in admin's in-progress
  drafts (`lib/drafts.ts#getUserFormDraftCount`, wired through the admin layout like the
  other sidebar counts). Matches the amber "Continue where you left off" theme. Lets a
  reviewer doing a batch of reviews see at a glance they have unfinished ones to resume.

Distinct from **Forms** (`/admin/forms`, the builder/manager) and **Submissions**
(`/admin/submissions`, the review queue of completed forms). No migration.

## 2026-06-30 — Save & resume forms across devices (account drafts)

Stop a form mid-fill and pick it up later on any device. Built for performance
reviews — a manager can have several in progress at once and resume any of them.
**Requires migration `033_form_drafts.sql`**; degrades gracefully until it's run
(no crash — drafts are simply inert).

### Added
- **`form_drafts` table (migration 033)** — per-user drafts, multiple per form,
  service-role only.
- **`/api/drafts`** (GET list / PUT upsert / DELETE) — the user is resolved from the
  session, so a user only ever touches their own drafts.
- **Cross-device autosave** — logged-in portal fills autosave to the user's account
  (debounced); the form header shows a "Saved" cue.
- **"Continue where you left off"** on the Employee Forms tab — lists in-progress
  forms (with who/when) to **Resume** or **Discard**; the draft is cleared on submit.
- Anon public-link fills (`/forms/[slug]` while signed out) keep a same-device
  localStorage autosave as a fallback.

### Changed
- **`StepFormModal`** is now dual-mode — account drafts (cross-device) for the
  logged-in portal, localStorage otherwise — with a resume banner + "Start over".
  See `docs/form-drafts.md`.

## 2026-06-30 — Jerry is now the founder's bobblehead

Swapped the formal headshot avatar for the fun full-body **bobblehead** caricature:
- **Idle hero** ("Hi, I'm Jerry") = the standing bobblehead with a soft emerald aura + ground
  shadow, gently bobbing/floating (new `JerryFigure`).
- **Header + inline** = the **abstract emerald orb** (`Orb`) — Jacob preferred just the orb (no cropped face) in the small spots; only the hero is the bobblehead.
- Source 1024px PNG optimized to a **32 KB `public/jerry-bobble.webp`** (via `sharp`); removed the
  old `jerry.avif`. Also fixed a sizing bug where the avatar `<img>` used `inset` without explicit
  width/height (replaced elements fall back to intrinsic size → the orb avatar was oversized) — now
  a sized, `overflow:hidden` wrapper. `components/customer/CustomerDashboard.tsx`, `app/globals.css`.

## 2026-06-30 — Roadmap revised: gentler flowing road + clickable milestones

The "windier" serpentine shipped earlier today read as too plain/boring, so the customer
build/ship roadmap is reworked to the **gentler flowing curve** with the dashed **center-line
("road") markings back**, a thicker road, and up to **5 stops on a single row** when they fit.
Each stop is now **clickable**, opening a panel with the milestone's status / date / notes and a
**"Documents — coming soon"** section. (The real per-milestone document store + admin upload is the
separate follow-up build.) `Tracker` in `components/customer/CustomerDashboard.tsx`.

## 2026-06-30 — Jerry wears the founder's face + a windier build/ship roadmap

- **Jerry's avatar (#4).** The orb now carries a portrait of the company founder Jerry is named
  for — his photo as the orb's core, with the halo, spinning ring, and orbiting sparks kept and a
  gentle float on the idle hero (the "calm" treatment). `public/jerry.avif`; `Orb` in
  `components/customer/CustomerDashboard.tsx`; `.jerry-face` in `app/globals.css`.
- **Windier roadmap (#5).** The customer build/ship tracker is redrawn as one smooth, meandering
  curve (Catmull-Rom; stops alternately rise and dip) with the racetrack lane-markings removed —
  calmer and curvier. **Visual only** for now; the click-a-milestone-for-documents idea is a
  separate later build (needs per-milestone document storage). `Tracker` in `CustomerDashboard.tsx`.

## 2026-06-30 — Contact Us by department + Jerry reads from the top of long answers

Customer-portal feedback round (bossman review).

- **Contact Us → departments.** The customer "Contact Us" card now asks the customer to pick a
  **department** (Sales / Customer Service / Engineering / Billing) instead of listing staff names.
  Messages route to **iatsupport@dehumidifiers.com** for now, with the department in the subject
  (`[Department] Portal message — Company`) and body so they can be split to per-department inboxes
  later. Department is validated server-side. (`components/customer/CustomerDashboard.tsx`,
  `app/api/customer/contact/route.ts`, `lib/resend-customer.ts`.)
- **Jerry — long-answer scrolling.** When Jerry's answer lands it now scrolls to the **top of that
  answer** instead of the bottom (long replies used to dump you at the very end), and the panel is
  taller (max-h 340→460, min-h 268→340). (`components/customer/CustomerDashboard.tsx`.)

## 2026-06-29 — Print views: per-department form preview + submission printout

Two browser-native print views for the Performance Review (and any conditional form) — the ops
director can **Print** or **Save as PDF**, and both honor the `show_when` department conditions.
Code-only; no migration, no env vars.

### Added
- **`/print/forms/[id]`** — pick a department → preview **only that department's questions** as a
  blank questionnaire (universal sections + that department's gated questions) before sending to
  team leads. Linked from the form-builder toolbar (next to Tally). Works for any conditional form;
  non-conditional forms just print the whole form.
- **`/print/submissions/[id]`** — a clean printout of a completed submission showing only the fields
  that applied to that person's department, to hand to the employee. Linked from the submission
  detail (next to Download PDF).
- Standalone `/print/*` routes (no admin chrome → clean output), self-gated with `getAdminUser()`;
  shared `components/PrintFrame` + `PrintButton`; reuses `lib/forms.ts` visibility so the printout
  matches the live form. `tsc` + `next build` clean.

## 2026-06-29 — Jerry refinements (light-first, serif voice, tuned orb, real name) + KB pool to 58 docs

Follow-up polish after scaling Jerry's KB pool to the full documentation folder.

- **KB pool** — ran `ingest-kb-docs.mjs --all` (now **58 docs / ~3,164 chunks** after pruning 6
  duplicate source files via a new `SKIP_DOCS` set). Recovered `PXR3.pdf` (NUL-byte fix in
  `cleanText`), sealed a customer-PII doc (`References.pdf` → internal), and added vendor-named
  citation titles. See `docs/kb-rag-assistant.md`.
- **Light-first customer portal** — the customer portal now defaults to **light** for a browser
  that has never chosen a theme (scoped effect in `CustomerDashboard`; admin/employee keep the
  global `system` default; a customer who toggles to dark is still respected).
- ~~Jerry's serif "voice"~~ — tried a serif for his greeting + answers; **reverted same day**
  (didn't read well), so the answers stay in the portal's sans.
- **Tuned orb** — calmer/slower idle breathing + halo, a richer core/ring gradient, and a gentle
  floating drift on the large idle hero orb (`app/globals.css`; still honors `prefers-reduced-motion`).
- **Real name in the prompt** — the assistant's system prompt now introduces itself as **Jerry**
  (was "the IAT Assistant") so it answers to its name (`app/api/customer/assistant/route.ts`).

## 2026-06-29 — Customer assistant becomes "Jerry" + light/dark toggle

Reskinned the customer-portal AI assistant from a chat-bubble bot into **Jerry** — an animated
"presence" (a breathing emerald orb that spins up while it reads the docs), with typeset answers
and cited "receipts" (document + page) instead of speech bubbles. Same RAG underneath — only the
experience changed.

- **Jerry** (`components/customer/CustomerDashboard.tsx`; orb styles in `app/globals.css`) — idle
  hero with a large orb + greeting, a persistent orb in the header that energizes while loading,
  answers as clean text with source chips, an "Ask Jerry…" composer. Honors `prefers-reduced-motion`.
- **Light/dark toggle** — the existing `ThemeToggle` (Sun/Moon) is now surfaced in the customer-portal
  header. The portal already supported dark mode via Tailwind; it just wasn't exposed to customers.
  Built light-first.

## 2026-06-29 — Customer AI Assistant: documentation RAG with citations

The customer-portal **IAT Assistant** can now answer from IAT's documentation. PDFs are ingested
into a searchable pool; the assistant retrieves the most relevant excerpts, answers **grounded only
in them**, and **cites the source (document + page)** as chips under each answer — or says it's not
in the documentation and routes to support. It never guesses product specifics. **Lean POC: Postgres
full-text search only** — no new vendor, no embeddings key (semantic vectors are the planned upgrade).

- **Data (migration `030_kb_rag.sql`)** — `kb_documents` + `kb_chunks` (generated `tsvector` + GIN
  index), both service-role only; a `match_kb_chunks()` SQL function ranks chunks **TF-IDF-style** so
  a rare, distinctive term (`humidistat`, `e5cn`, `overcurrent`) outweighs a common one (`set`,
  `alarm`) and the document that actually covers the question wins.
- **Ingest** — `scripts/ingest-kb-docs.mjs` extracts each PDF **per page** (page numbers preserved
  for citations) with `pdftotext`, chunks it, and inserts via the service role; idempotent per file,
  internal/company docs flagged `is_internal` (hidden from customers). POC pool: **10 docs, ~2,114
  chunks**. (`A1094 Manual.pdf` is image-only/scanned — excluded pending OCR.)
- **Retrieval layer** — `lib/kb-rag.ts` (`retrieveChunks` + helpers) is reusable (an internal
  assistant can reuse it with `includeInternal: true`) and **degrades to no-op** until the pool exists.
- **Assistant** (`app/api/customer/assistant/route.ts`) injects the excerpts, cites doc+page by exact
  label, and returns the cited sources; `components/customer/CustomerDashboard.tsx` shows them as chips.
- Docs: **docs/kb-rag-assistant.md**. Deploy: apply `030_kb_rag.sql`, then run the ingest script. No new env vars.
- **Follow-up (same day):** widened the retrieval window **6 → 10 chunks** — a specific answer page can
  rank just outside the top few when it doesn't repeat the product name (e.g. the Omron E5CN "Current
  Value Exceeds" error table, p.230, which never says "E5CN"). Semantic (vector) search remains the
  durable fix for deep-manual needles.

## 2026-06-26 — Forms round 4: review tweaks, equipment-form dropdowns/photos, new ticket numbers, roadmap tracker

A batch of form changes plus two redesigns.

- **Performance Review** — removed the **Employee Signature** field (supervisor signature kept;
  existing submissions keep whatever they captured). Each individual submission page
  (`/admin/submissions/[id]`) now shows a **per-review ratings tally** — the Superstar / Rockstar /
  Star / Performer counts for that one person — complementing the form-wide tally page. It renders
  only when a submission has answers on that scale, so the other forms are unaffected.
- **Equipment Support form** — the sample-label photo is larger / more prominent; the **pre- and
  post-cooling "type"** fields are now **dropdowns** (Chilled water coil, DX, Glycol, Evaporative,
  City/well water, Cooling tower water) with an **"Other…"** free-text fallback; the **Wheel & Seals**
  step shows **reference-photo placeholders** for the desiccant wheel and seals (drop the real images
  into `public/support/` and set `src` on the two `<ReferencePhoto>` calls).
- **Ticket numbers** — new format **`IAT-YYYY-NNNN`** (e.g. `IAT-2026-0042`), sequential per year,
  replacing the old `TKT-<timestamp>-<random>`. Generated atomically in the DB (`next_ticket_number`
  RPC + `ticket_counters` table, **migration 029**) so simultaneous tickets can't collide, and seeded
  above any existing numbers. The route falls back to a timestamp-based number if the RPC is absent.
- **Customer build/ship tracker** — rebuilt from a vertical stepper into a **winding-road roadmap**:
  milestone "stops" along a road that snakes through the card, with a truck parked at the current
  stop. Same stages and in-order logic — a visual redesign (`components/customer/CustomerDashboard.tsx`).

## 2026-06-26 — Submittal reader: larger PDF limit

Raised the "New from Submittal" PDF size cap (`extract-submittal`) from ~4MB to **~11MB** — the old
limit was rejecting Submittals the platform itself accepts. The forwarded base64 stays well under
Claude's ~32MB request cap. (For PDFs beyond that, the next step would be routing the upload through
Supabase Storage instead of the request body.)

## 2026-06-26 — Admin nav: "Forms" link to the form builder

Replaced the admin sidebar's **Employee Forms** item (`/admin/employee-forms`) with a **Forms** link
to the admin form builder/manager at **`/admin/forms`**. The `/admin/employee-forms` page still
resolves by URL (now nav-orphaned).

## 2026-06-26 — Form engine: conditional fields + ratings tally (Performance Review)

Two new form-builder capabilities, both **additive** — a field with no condition behaves exactly as
before, so the other ~40 forms are unaffected.

- **Conditional fields** — a field can show only when another field has a given value (builder field
  settings → **"Show only when…"**). The multi-step renderer (`StepFormModal`), the embed renderer
  (`FormRenderer`), and the server-side submit validation (`/api/submit`) all respect it: hidden
  fields aren't required and their values are dropped from the submission; empty sections collapse to
  no step. Schema: `form_fields.show_when_field` / `show_when_value` (**migration 028**). Visibility
  logic lives in `lib/forms.ts` (`isFieldVisible` / `visibleFields` / `stripHiddenAnswers`).
- **Ratings tally** — **`/admin/forms/[id]/tally`** (linked from the builder toolbar) counts how many
  **Superstar / Rockstar / Star / Performer** each employee received across all rating questions in
  their reviews, grouped by the "Employee Name" field — for reviews and bonuses.

**Performance Review form** data changes ship via `scripts/update-performance-review.mjs` (run after
migration 028; dry-run by default, `--commit` to apply, idempotent): removes 5 first-page/doc fields
(position title, supervisor, review period, position description + doc), swaps the rating scale to
**Superstar / Rockstar / Star / Performer** (drops Performance Gap, adds Superstar), and gates the
**Department-Specific** questions by **Department** (Engineering questions only show for Engineering,
etc.). The general competencies, Safety/Initiative/Growth, Summary & Goals, and Signatures stay
universal.

## 2026-06-25 — Hotfix 2: the real fix for the `/customer ↔ /login` loop (unlinked customer logins)

The cookie fix below was correct hardening but **not** the root cause. The loop's real driver: the
`/customer` page server-redirected to `/login` whenever `getCustomerUser()` returned null — which
happens for a customer login **not linked to a company** (`profiles.customer_id` is null; the FK is
`ON DELETE SET NULL`, so deleting a `customers` row orphans its logins). Middleware sees `role=customer`,
lets `/customer` through and bounces `/login` → `/customer`, so the page's redirect looped forever.
Fix: `/customer` now renders a client `CustomerSessionError` that **signs out locally** (clears the
session) then routes to `/login` — no server redirect, so the loop is impossible. Find orphaned
logins to clean up: `SELECT id FROM profiles WHERE role='customer' AND customer_id IS NULL;`

## 2026-06-25 — Hotfix: production auth redirect loop (`/customer ↔ /login`)

A logged-in customer whose session token needed refreshing could hit an infinite `/customer ↔
/login` redirect loop (ERR_TOO_MANY_REDIRECTS) on the live domain. Cause: `middleware.ts` returned
redirects without carrying over the refreshed Supabase auth cookies that `getUser()` sets, so the
refreshed session was dropped on each redirect and the auth gate oscillated (logged-in → `/customer`,
unresolved → `/login`, forever). Fix: a `redirectTo()` helper copies `supabaseResponse`'s cookies
onto every redirect (the documented Supabase SSR pattern). Also: the root router (`app/page.tsx`)
now sends customers to `/customer` (was `/employee/profile`). Latent middleware bug — surfaced by an
aging customer session on prod, not by a specific feature change. Code-only; no migration.

## 2026-06-25 — Status lookup: prefill + request picker for signed-in customers

`/support/status` is now session-aware (like the support form). A logged-in customer gets their
**email prefilled** and a **"Your requests"** quick-picker — one tap looks up any of their own
tickets / checklists (matched by their account email, so the lookup always verifies). Anonymous
visitors get the unchanged public lookup — `/support/status` is **not** gated. Split into a server
`page.tsx` + `StatusClient.tsx`; `getStatusCustomerContext` in `lib/support-context.ts`. No migration.

## 2026-06-25 — Support form: prefill for signed-in customers (public form stays open)

When a logged-in portal customer opens the support form (`/support/equipment-support`) it now
prefills their account email + contact details and shows a **"Your account & equipment"** card —
pick a unit to fill in its serial / model / voltage (auto-filled when they have a single unit);
everything stays editable. The page is **session-aware**, so **anonymous, non-portal customers see
the exact same public form** — `/support` is not gated. Prefilling the exact serial also makes the
resulting ticket auto-link to the right equipment record. New `lib/support-context.ts`
(`getSupportCustomerContext`); the support page renders per-request. Code-only; no migration.

## 2026-06-25 — Admin tracker: one-click canned notes

The Build & Shipping tracker editor (admin equipment detail) now offers 2–3 customer-facing
**note presets per stage** (one click fills the note) alongside the existing free-text note — so
staff don't write an update from scratch for every unit. Presets live in `lib/customer.ts`
(`notePresetsFor`), with a generic fallback for custom stages. Code-only; no migration.

## 2026-06-25 — Customer portal: live IAT Assistant (read-only)

The dashboard's "IAT Assistant" placeholder is now a working chat. Code-only; **no migration**.

- `POST /api/customer/assistant` (Anthropic `claude-sonnet-4-6`) answers grounded in the logged-in
  customer's equipment (serials, warranty, build/ship milestones) + IAT's published KB, assembled
  server-side. **Read-only** — it can't open tickets or change anything, is told to route actionable
  requests to Submit a request / Contact Us, and won't invent serials, dates, or status.
- Right-rail chat panel with suggestion chips, a typing indicator, and a "can make mistakes" note.
- Uses the existing `ANTHROPIC_API_KEY` (same as the Submittal reader) — no new env vars.

## 2026-06-25 — Customer portal: unit photos, Contact Us + message form

Dashboard build-out (stacked on the admin front door below). Code-only; **no migration**.

- **Unit photos** — admin uploads build & QC photos on `/admin/equipment/[id]` (new uploader
  `components/admin/EquipmentPhotos.tsx`; browser → Supabase Storage `ticket-photos` bucket, then
  PATCH `equipment.photo_urls`). They render as an expandable lightbox gallery on the customer
  dashboard.
- **Contact Us** card on the customer dashboard — the IAT team roster (Kacy Orr, Crystal Hill,
  Jacob Reagan, James Pope) plus a small **message form**. Submissions email
  `jacob.younker@dehumidifiers.com` via Resend (`POST /api/customer/contact`,
  `sendCustomerContactEmail`); the sender's company / contact / email are attached server-side.

## 2026-06-25 — Customer portal: admin front door (Customers section + Submittal wizard)

A **customer-first** way to provision portal access, alongside the existing equipment-first
"Invite to portal" card. Code-only; **no migration**.

- New **Customers** entry in the admin nav + **`/admin/customers`** list (search, Active/Inactive
  filters, unit counts) and a **`/admin/customers/[id]`** detail page (linked units, contact details).
- **New Customer wizard** (`components/admin/NewCustomerWizard.tsx`): scan a Submittal → review the
  pulled **customer + unit** fields → one click creates the `customers` row, the login, the
  `equipment` row, seeds the build/ship tracker, and emails the temp-password invite — all through
  the existing `POST /api/admin/customers/invite` (which already accepted a full `equipment` object).
- The same wizard is the equipment list's **"New from Submittal"** button, so there's a single
  create-from-Submittal path (Submittal PDF + manual entry only — no DW integration).
- **Resend invite** (`POST /api/admin/customers/[id]/resend-invite`) resets the temp password,
  re-sends the email, and re-activates the account; **Remove from portal**
  (`POST /api/admin/customers/[id]/remove`) deletes the login and marks the customer inactive
  (equipment + history kept). Both audited.
- `genTempPassword` extracted to `lib/temp-password.ts` (shared by invite + resend).

## 2026-06-25 — Legacy troubleshooting intakes migrated into Tickets

The retired Troubleshooting Checklist's intakes (`troubleshooting_intakes`) now live in the
unified **Tickets** queue. Each row was copied into `tickets` keeping its original `TSC-…`
reference as the ticket number — so the origin is obvious in the queue and the move is
**idempotent** (a `TSC-` ref already in tickets is skipped) and **reversible**
(`DELETE FROM tickets WHERE ticket_number LIKE 'TSC-%'`). Dates and status are preserved
(`new→open`, `reviewed→in_progress`, `closed→closed`); the checklist-only diagnostics
(onset, wheel/seals, external factors, …) map 1:1 thanks to migration 027.

All 6 rows were internal **test** submissions (J.Y. + Kacy, Jun 23–24), moved at the user's
request; the source `troubleshooting_intakes` table is left intact as a backup (retire it in a
later cleanup). Data-only — ran against the live DB via the service role, no code deploy.
Script: `scripts/migrate-troubleshooting-to-tickets.mjs` (dry-run by default; `--commit` to write).

## 2026-06-24 — Portal cleanup batch: nav trim, milestone ordering, customer simplification, org-chart list, sectioned submissions

A pass across all four portals (admin, customer, employee, support). Code-only; no migrations.

### Admin
- Hid the **US Rotors** nav (kept for future use behind a `hidden` flag) and **deleted the
  one-item Actions** section (New Form is still in ⌘K and at `/admin/forms`).
- **Troubleshooting** folded into **Tickets** — the two customer forms now feed one pipeline;
  legacy `troubleshooting_intakes` remain reachable at `/admin/troubleshooting` by URL.
- **Equipment list** PM column shows the full year (`Jun 26, 2027`) instead of `Jun 26, 27`.
- **Build & Shipping tracker** enforces **in-order** milestones (client blocks the change with
  an inline error; the milestones API re-validates and returns 409) and was redesigned with a
  stepper + breathing room. Equipment detail `<main>` got `space-y-4` so its cards stop butting
  together.
- **`/admin/org-chart`** gained the same **Chart / List toggle** the employee directory has
  (extracted to a shared `components/org-chart/OrgDirectory.tsx`).
- **Submission detail** now renders a **card per form section** (grouped by `section_header`)
  instead of one endless "Responses" list — mirrors the ticket detail.

### Customer
- Removed the redundant **"Support & resources"** card grid: the single support form
  ("Submit a request") and "Check status" live in the hero, and the Knowledge Base lives in the
  right rail (was 2 KB blocks + 2 form cards). Reflects the merged support form; spacing tightened
  toward a single-screen layout.

### Employee
- Hid the **US Rotors** nav section and the dashboard "US Rotors order" quick-action (kept for future).

### Support
- Removed the **US Rotors** brand option from the equipment support form (IAT-only now).

### Responsive
- Form grids that were a fixed two columns (cramped on phones / narrow laptops) now stack to
  one column below `sm` — the customer support form (`EquipmentTicketForm`) and the admin
  equipment & employee detail forms. (Best-effort pass; the dashboard KPIs already ship a
  separate mobile layout, and the detail two-column breakpoints stay `xl` because the admin
  sidebar takes 240px.)

## 2026-06-24 — Hardening: gate `/tools/*`, fix the inert router-cache config, add a smoke suite

Shipped the two genuinely-new fixes that had been stranded (done on a branch, never
deployed) on `chore/cleanup-hardening`. Cherry-picked to `main`; that branch's duplicate
Employee-Forms and support-rebrand commits were dropped (already live) and the branch deleted.

### Security
- **Gated `/tools/*.html` behind authentication** (security item 8.3). The internal static
  calculators (order-status card, voltage scaling, US Rotors pricing) were public by URL;
  `middleware.ts` now redirects anonymous visitors to `/login`, and any signed-in employee or
  admin may use them. Added `/tools/:path*` to the middleware matcher.

### Fixed
- **The admin Router-Cache setting was silently inert in production.** `staleTimes` had been
  moved to the **top level** of `next.config.js` during the 14→15 upgrade on the belief it had
  gone stable — but in Next 15 it's still `experimental.staleTimes`, so a top-level key is
  ignored (confirmed against the installed config schema and the build's "Experiments" banner).
  Moved it back under `experimental`, so `staleTimes.dynamic: 0` takes effect again (pairs with
  `RefreshOnNavigate`). Also set `outputFileTracingRoot: __dirname` so Next stops walking up to
  the stray repo-root `package-lock.json` when inferring the workspace root.
- **Troubleshooting CS-alert email** now links the live `/admin/troubleshooting` queue instead
  of the stale "a dedicated admin view is coming in Phase 2" copy.

### Added
- **Playwright smoke suite** (`e2e/smoke.spec.ts`, `playwright.config.ts`, `npm run test:e2e`):
  non-mutating checks that public entry points load, anonymous auth boundaries redirect, and the
  new `/tools/*` gate holds. Read-only by design (the dev server talks to prod Supabase).

### Removed
- **Dead code:** the legacy `/admin/test` design-preview dashboard (503 lines) and the no-op
  `/api/admin/auth` stub (login is client-side Supabase now). Nothing referenced either.

## 2026-06-24 — Employee Forms tab added to `/admin`

The "Employee Forms" library (the JotForms brought into the portal) is now available
in the admin portal as well, not just `/employee`. Admins are also employees — this
lets them fill out and submit the same forms (PTO, etc.) without leaving `/admin`.
Code-only change; no migration, no env vars.

### Added
- **`/admin/employee-forms`** — the same fillable forms library employees see: active
  forms grouped by category, category tabs, rows open the `StepFormModal` to submit.
  Distinct from `/admin/forms`, which remains the form *builder/manager* (create, edit,
  QR, embed, toggle active, approval).
- **"Employee Forms" sidebar item** under the admin **Employees** section, plus a matching
  ⌘K command-palette entry.

### Changed
- Promoted the employee `ResourcesFormsView` to a shared `components/EmployeeFormsView.tsx`
  so `/employee/resources` and `/admin/employee-forms` render from one component (added an
  optional `eyebrow` prop; employee output unchanged). No behavior change for employees.

## 2026-06-24 — Customer Portal (Phase 1) — external customer logins

A customer-facing portal at `/customer`. A company that has bought units from IAT
gets a login to track their equipment, build & shipping status, warranty, and
support — branded to IAT. Provisioned by staff from the equipment record, optionally
by scanning a Submittal PDF. Requires migration `026_customer_portal.sql`.

### Added
- **New `customer` role** (`profiles.role`) + `profiles.customer_id`. New tables
  `customers` (one per company) and `equipment_milestones` (staff-updated build→ship
  timeline); `equipment.customer_id` links units to a customer. All service-role only —
  `/customer` reads run server-side scoped to the session's customer, so the browser
  never queries those tables and customers can't see each other's data.
- **`/customer` dashboard** — unit cards (serial / model / warranty), a build & shipping
  tracker, KB + start-up guide, the existing support forms, and "My Requests" (their
  tickets + troubleshooting intakes, now behind a real login). IAT Assistant panel is a
  Phase-3 placeholder.
- **Admin "Customer Portal" card** on `/admin/equipment/[id]`: invite a customer (creates
  the login, links the unit, seeds the tracker, emails a set-password link) + a build &
  shipping milestone editor. Invite can **scan a Submittal PDF** (Claude document
  extraction) to pre-fill company/contact.
- New routes: `POST /api/admin/customers/invite`, `POST /api/admin/customers/extract-submittal`,
  `POST|PATCH /api/admin/equipment/[id]/milestones`; new `/customer/welcome` set-password page.
- Helpers: `lib/customer.ts` (milestone model), `lib/customer-auth.ts` (`getCustomerUser`),
  `lib/resend-customer.ts` (welcome email).

### Changed
- **`middleware.ts`** resolves the session role once and routes the `customer` role to
  `/customer` (and keeps customers out of `/admin`, `/employee`, `/learn`).
  Existing admin/employee routing preserved; `/login` and `/auth/callback` are role-aware.

### Deploy notes
- Run `supabase/migrations/026_customer_portal.sql` (applied 2026-06-24).
- Add `${APP_URL}/auth/callback` to Supabase Auth → URL allowlist (set-password redirect).
- Customer email sends from `onboarding@resend.dev` until a Resend domain is verified; the
  invite dialog shows a copyable set-password link as a fallback. No new env vars. `tsc` clean.

## 2026-06-15 — List-view fixes: kebab clipping + forms column alignment

### Fixed
- **Kebab menu options clipped** on the top rows of Submissions & Tickets — the shared
  `BODY_BOX` had `overflow-hidden` that clipped the vertically-centered dropdown. Removed it;
  rows now self-round their outer corners (`rowCx` → `first:rounded-t-xl last:rounded-b-xl`).
  Shared-kit fix, so it covers Equipment & Employees lists too.
- **Forms list column misalignment** (header labels vs row Status/Subs/Actions) in the flat
  category view — header and rows are separate grids and the template ended in `auto`, which
  sized differently in each. Actions column is now a fixed `232px` so both grids align.

## 2026-06-15 — Detail pages redesigned to the dashboard language

`/admin/submissions/[id]` and `/admin/tickets/[id]` now match the operations
dashboard (zinc surfaces, rounded-xl cards, emerald accents, sticky breadcrumb).

### Changed
- **Submissions detail is now two-column** (was a single scroll-heavy column): a main
  **Responses** card + a sticky right rail with a **Details** summary and **Internal Notes**.
  `section_header` fields render as subheading bands; answered/total count in the header.
- **Tickets detail** restyled to the same language — every section is a titled icon card;
  back button → breadcrumb. Structure and all behavior unchanged.
- New `components/admin/detail-ui.tsx` (`DetailShell`, `DetailTopBar`, `Card`, `CardHead`,
  `MetaRow`) shared by both pages so they stay consistent. Restyled `SubmissionStatus`,
  `SubmissionNotes`, and the PDF-download button to the emerald/zinc palette.

No behavior changes (status picker, PDF, notes, ticket save + resolution-reason gate,
attachment upload all preserved). `tsc` clean.

## 2026-06-15 — Fix: audit log wasn't capturing status changes / form creation

Resolving submissions and creating forms produced no audit entries — those paths
bypassed the instrumented API routes.

### Fixed
- **Server actions weren't logged.** Submission status (`updateSubmissionStatus`) and
  ticket status (`updateTicket`) are Next server actions writing straight to Supabase;
  they now call `logAudit` (`submission.status` / `ticket.status`, only on a real
  transition).
- **Form create/activate/pause weren't logged.** Added `form.create` to `POST /api/forms`
  and `form.activate` / `form.pause` to the `is_active` branch of `PUT /api/forms/[id]`
  (logged only when the active state actually flips).
- Verified the `audit_log` write path was healthy via a live insert/read/delete self-test;
  the table was empty only because nothing had hit a logged path.

### Changed (security)
- `updateSubmissionStatus` and `updateTicket` had **no explicit admin guard** (service-role
  writes relying on middleware alone). Both now call `getAdminUser()` and refuse non-admins.

### Added
- Audit viewer: **Tickets** filter + icons/colors for the new action types; dashboard
  "Admin Activity" dot colors extended to tickets.

## 2026-06-15 — Audit coverage + dashboard Admin Activity feed

Follow-on to the audit log shipped the same day.

### Added
- **Six more audited actions** (10 total): `submission.status`, `employee.invite`,
  `employee.deactivate`, `employee.reactivate`, `accrual.adjust`, `accrual.run` — each with
  before→after metadata.
- **Grouped prefix filters** on `/admin/audit` (Forms / Employees / Accrual) + per-action
  icons and colors for the new types.
- **"Admin Activity" card** in the dashboard right rail — 6 most recent audit entries, read
  in the dashboard server query (degrades to empty if the table is missing).

### Changed
- `/api/submissions/[id]`, `/api/employees/invite`, `/api/employees/[id]`, and
  `/api/admin/run-accrual` now resolve the acting admin via `getAdminUser()` (was a boolean
  `isAdminAuthenticated()` check) so audit entries name who acted. Same admin-only gate.

## 2026-06-15 — Admin: Executive Briefing, Command Palette, Audit Log

Three upgrades to make the admin portal feel like a finished product.

### Added
- **AI Executive Briefing** (`/admin`) — a card where Claude writes a short plain-English
  read of the operation from live metrics. `app/admin/ExecutiveBriefing.tsx` (client) +
  `app/api/admin/briefing/route.ts` (gathers metrics, calls `claude-sonnet-4-6`, **caches
  in-module for 1 hour**; `?refresh=1` bypasses). Never called inline — the dashboard is
  `force-dynamic`, so the card fetches after mount.
- **Command palette** — press **⌘K / Ctrl+K** anywhere in the admin. `components/admin/CommandPalette.tsx`
  (mounted in `app/admin/layout.tsx`): static destinations + actions, plus live search of
  forms/employees/tickets via `app/api/admin/search/route.ts`. Full keyboard nav. A ⌘K chip
  in the dashboard search box opens it (`commandk:open` window event).
- **Audit log** — append-only `audit_log` table (`supabase/migrations/020_audit_log.sql`,
  RLS on / service-role only) + `lib/audit.ts` `logAudit()` (best-effort, never throws),
  wired into the role-change, form-approve, form-delete, and time-off-review routes. Viewer
  at `/admin/audit` with action filters; new **System** section in the sidebar.

### Operational notes
- **Run migration `020_audit_log.sql`** in the Supabase SQL editor (done 2026-06-15).
- The role route now uses `getAdminUser()` (was `requireAdminAuth()`) to capture the acting
  admin — same admin-only gate, returns 403 for non-admins.
- `ANTHROPIC_API_KEY` (already set for the AI form builder) powers the briefing too.

## 2026-06-15 — IAT Learn (Phase 1)

Added **IAT Learn**, an internal training portal that replaces Trainual, served at
`/learn` inside the forms portal with shared Supabase auth (no second login).

### Added
- **`/learn` route group** — searchable category grid, numbered module steppers, and a
  lesson reader with per-module progress and mark-complete.
- **Admin** (`/learn/admin`) — full content tree with publish toggles and a TipTap
  rich-text lesson editor. Gated to `profiles.role = 'admin'`.
- **API** (`/api/learn/*`) — progress upsert (user id taken from the session, never the
  request body), plus admin-only lesson/module CRUD.
- **Migrations**
  - `014_learn_system.sql` — schema (`learn_categories`, `learn_modules`, `learn_lessons`,
    `learn_progress`) + indexes, `updated_at` trigger, `is_learn_admin()` helper, and RLS.
  - `015_learn_seed.sql` — seed of 5 categories, 14 subjects, **357 lessons** imported from
    the Trainual PDF exports. Idempotent (`ON CONFLICT DO NOTHING`). Split into
    `015a`–`015f` chunk files for pasting into the Supabase SQL editor (the combined file
    exceeds the editor's paste limit).
- `middleware.ts` — `/learn` auth gate (admin-gating handled in the `/learn/admin` layout).
- `app/globals.css` — `.learn-prose` reading styles + missing-image placeholder styling.
- `scripts/gen-learn-seed.mjs` — regenerates the seed (and chunk files) from
  `iat-learn/_import/*.json`.

### Known gaps (tracked for follow-up)
- **81 of 357 lessons are heading-only stubs** — those Trainual PDFs exported without body
  text (notably Safety Procedures: 21 of 23). Fill via the admin editor or re-import from a
  higher-fidelity export.
- **154 image/video placeholders** flagged for re-upload via the admin editor.
- Creating categories/modules from the UI isn't built yet (they come from the seed).
- Phase 2 (gamification: points, leaderboards, streaks, badges, quizzes) is deferred; the
  schema is ready for it.

### Operational notes
- Migrations are applied by hand in the Supabase SQL editor (no Supabase CLI wired up),
  same as prior migrations. For this release, run `014` then `015a`–`015f` in order.
- Full build detail lives in `../LEARN_BUILD_NOTES.md`.
