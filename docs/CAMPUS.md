# NEXORA University - campus experience

## Audit before this phase (2026-11-19)

| Area | Found | Gap vs. the "real university" brief |
|------|-------|-------------------------------------|
| UI | Glass panels over the 3D world, game-style HUD, teal sci-fi palette | No university identity, no student portal, no ID |
| 3D world | One plaza, 3 academic buildings, 5 future-district gates, hologram monument | No entrance, no people, no day cycle, no interiors |
| Characters | Capsule "robot" avatar, 4 floating robot professors | No believable humans, no classmates |
| Systems reused | World engine (collision/interaction), learning/progression/challenge engines, local persistence, backups | Campus life systems missing |
| Performance risk | Every character ~20 meshes; HTML labels | Crowd must be budgeted per graphics preset; labels only for the nearest classmate |

## What exists now

* **Arrival**: new students spawn outside the gate (z = 86). The monumental gate (canvas-drawn signage, offline), perimeter wall, security booth, ID scanner, flags, gardens, visitor parking and campus shuttle.
* **Security checkpoint (real logic)**: Officer Rahman asks for your ID. No card → directed to the Admission & Visitor Centre. The guard posts the presented card number to `POST /students/{id}/gate/verify`, which compares it with the stored card. Only then is the barrier collider removed (proved in `campus.test.ts`). First entry gets a guided welcome; later entries "Welcome back".
* **Admission & student ID**: pick one of 9 departments and a learning track → `NXU-<year>-<n>` card with name, department, track, enrolment year, academic year and verified rank. The pattern is labelled decorative, not a credential. `I` opens the card anywhere.
* **Student portal** (`O`): ID, current courses, assignments (missions), recent results, skills, learning participation (labelled as not institutional attendance), achievements, projects, classmates. Lists what is not built yet. Carries the non-accreditation disclaimer.
* **Classmates**: 30 adult students (19-27), 10 archetypes, 9 departments, diverse names and appearances. Walkers follow campus paths with varied speeds and pauses; groups chat; students sit on benches with laptops. Talking (`E`) stores the relationship locally (friend after 3 conversations). Dialogue = authored lines + facts read from verified records only.
* **Faculty**: Nova, Atlas, Newton and Neural are now human figures in blazers.
* **Atmosphere**: day/night lighting from the local clock or a setting (morning/afternoon/evening/night), lamps glow at night, fountain replaces the hologram monument. Lighting never gates lessons.

Performance budget: walkers + idlers per preset = low 8+6, medium 14+10, high 20+10. Characters beyond 45 m stop animating; beyond 110 m they are hidden. FPS on baseline hardware is **not measured yet**.

## Not built yet (next phases)

Lecture halls with lectures, department interiors, library, hostels (rooms, roommates), cafeteria, sports, clubs/events, study groups, ambient sound, weather, GLB/PBR assets and realistic character models (needs licensed assets - a decision for the project owner), scene streaming.
