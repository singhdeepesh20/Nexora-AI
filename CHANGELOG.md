# Changelog

## 0.4.0 - 2026-11-19 (viral loop, unreleased)

### Added
- No-install "Break of the Day" page (`play.html`): real in-browser neural-network training, 7 daily puzzles, 6 tries, Wordle-style honest grid, friend-challenge links, share card and 10-second vertical clip export.
- New students break and fix a network immediately after creating a profile; welcome copy aimed at CS students.
- Manual GitHub Pages workflow to publish the play page.

### Changed
- Build splits React, Three.js and Monaco into separate chunks; the play page loads ~225 KB instead of the 3D engine and editor.

## 0.3.0 - 2026-11-19 (university arrival, unreleased)

### Added
- NEXORA University entrance: gate, perimeter wall, security booth and guard, admission centre, parking, shuttle, flags, gardens, campus directory.
- Working security checkpoint verified against the locally stored student ID; simulated student ID cards (`I`).
- Student portal (`O`) with an explicit non-accreditation disclaimer.
- 30 adult classmates who walk, chat and sit; local conversations and friendships; human faculty figures.
- Day/night lighting from the local clock or a setting; fountain replaces the hologram monument.
- Migration `0003_campus`.

## 0.2.0 - 2026-11-19 (engagement slice, unreleased)

### Added
- First-three-minute onboarding with Professor Nova: break and fix a real neural network.
- Failure spectacle engine: backend event classifier, typed event bus, plaza Experiment Machine, lab event banners, reduced-motion setting.
- 14 Break Challenges plus the onboarding challenge, evaluated against real simulation output.
- Verified share cards (PNG export, clipboard, OS share) for missions, challenges, onboarding, Daily Debug and rank.
- XP ledger with anti-farming keys, levels, evidence-based engineer ranks, time-zone-aware streaks.
- Debug of the Day: 7 puzzles, deterministic local calendar, hidden tests, honest share grid.
- Professors Nova, Atlas, Newton and Neural on campus with progress-aware dialogue; buildings that light up with mastery.
- Migration `0002_engagement`; Alembic now ignores FTS5 tables during autogenerate.

## 0.1.0 - 2026-11-19 (first vertical slice, unreleased)

### Added
- 3D campus with third-person avatar, collision, building interactions, minimap, graphics presets and FPS monitor; 8 districts (3 active).
- Curriculum: 12 concepts with lessons, objectives, worked examples, Socratic prompts and deterministic assessments.
- Competency engine: prerequisite graph, mastery rules, recommendations, review scheduling, skills and achievements.
- Six laboratories: gradient descent, neural network, machine learning, RAG retrieval, transformer (toy), AI infrastructure.
- Five engineering missions graded by hidden tests in a sandbox, with static quality analysis.
- Monaco editor bundled offline; personal project workspaces with sandboxed runs.
- Eight AI professors with offline curriculum-grounded answers and optional Ollama.
- Verified backup export/import, complete data deletion, automatic pre-migration safety copies.
