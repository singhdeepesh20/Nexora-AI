 



An optional local Ollama installation can enhance professor conversations. NEXORA never automatically downloads models or requires paid APIs.

### 02 — Your work belongs to you

Your profiles, progress, projects, experiments and mentor conversations remain on your computer.

- Local SQLite database.
- Local project folders.
- Backup and restore.
- Complete data deletion.
- No mandatory registration.
- No cloud database.
- No telemetry.

### 03 — Engineering over appearances

- Scientific simulations calculate actual results.
- ML experiments use NumPy and scikit-learn.
- Missions execute code against automated tests.
- Competency progression is evidence-based.
- Simulated estimates are clearly distinguished from real measurements.

---

# 🚀 WHAT CAN YOU ACTUALLY USE TODAY?

\<p align="center">
&#x20; \<img src="docs/assets/nexora-dashboard.png" width="100%" alt="NEXORA application dashboard">
\</p>

**v0.1.0 — Current implementation**

| Capability                                 | Status |
| ------------------------------------------ | ------ |
| 3D campus, avatar and building entry       | ✅      |
| Minimap, graphics presets and FPS monitor  | ✅      |
| Foundation, ML and Deep Learning districts | ✅      |
| 12 concepts with lessons and assessments   | ✅      |
| Competency and prerequisite engine         | ✅      |
| Gradient Descent Laboratory                | ✅      |
| Neural Network Laboratory                  | ✅      |
| Machine Learning Laboratory                | ✅      |
| RAG Retrieval Laboratory                   | ✅      |
| Transformer Laboratory                     | ✅      |
| AI Infrastructure Laboratory               | ✅      |
| Five engineering missions                  | ✅      |
| Monaco editor and Python execution         | ✅      |
| Eight professor personas                   | ✅      |
| Offline curriculum-grounded answers        | ✅      |
| Optional Ollama integration                | ✅      |
| Backup, verified restore and deletion      | ✅      |
| Failure spectacle and Break Challenges     | ✅      |
| Share cards, XP, ranks and streaks         | ✅      |
| Daily Debug challenge                      | ✅      |
| University gate, guard and student ID      | ✅      |
| Student portal, classmates and day/night   | ✅      |
| Lectures, library, hostels and cafeteria   | ⏳      |
| Advanced districts                         | ⏳      |
| Desktop application and installers         | ⏳      |

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for detailed progress.

---

# ⚡ GET YOUR UNIVERSITY RUNNING

## Requirements

| Dependency | Requirement |
| ---------- | ----------- |
| Node.js    | 22+         |
| Python     | 3.12        |
| uv         | Required    |
| pnpm       | 9.15.9      |

No GPU required. Internet is not needed after dependencies and assets have been installed.

## Installation

**1. Clone the university**

```bash
git clone <YOUR_REPOSITORY_URL> nexora
cd nexora
```

**2. Install frontend dependencies**

```bash
npx pnpm@9.15.9 install
```

**3. Set up the backend**

```bash
cd backend
uv sync
cd ..
```

**4. Start NEXORA**

```bash
bash scripts/start.sh
```

Open:

```text
http://127.0.0.1:8765
```

Keep the terminal open while using the application. Press `Ctrl+C` to stop it.

### Developer mode

```bash
bash scripts/dev.sh
```

| Service     | Address                                        |
| ----------- | ---------------------------------------------- |
| Frontend    | [http://127.0.0.1:5173](http://127.0.0.1:5173) |
| Backend API | [http://127.0.0.1:8765](http://127.0.0.1:8765) |

---

# 🎮 CAMPUS CONTROLS

| Key       | Action            |
| --------- | ----------------- |
| `W A S D` | Walk              |
| `Shift`   | Run               |
| Mouse     | Look around       |
| Scroll    | Zoom              |
| `E`       | Interact          |
| `M`       | Campus map        |
| `J`       | Dashboard         |
| `K`       | Missions          |
| `B`       | Break Challenges  |
| `P`       | Progress          |
| `I`       | Student ID        |
| `O`       | University portal |
| `L`       | Personal AI lab   |
| `Esc`     | Back / Pause      |

---

# 🧠 OPTIONAL: BRING YOUR OWN LOCAL AI

NEXORA works without a model.

To enable enhanced local AI professor conversations:

1. Install [Ollama](https://ollama.com).
2. Pull a model yourself.

```bash
ollama pull llama3.2
```

3. Open NEXORA.
4. Navigate to `Settings → Local AI Mentor`.
5. Select your installed model.

Without Ollama, professors continue to answer using the built-in curriculum.

NEXORA does not automatically download models.

---

# 🗄️ YOUR DATA. YOUR MACHINE.

| Operating system | Data directory                         |
| ---------------- | -------------------------------------- |
| macOS            | `~/Library/Application Support/NEXORA` |
| Windows          | `%LOCALAPPDATA%\NEXORA`                |
| Linux            | `~/.local/share/NEXORA`                |

Override with:

```bash
NEXORA_DATA_DIR=/your/custom/path
```

Application updates preserve user data. Database migrations create a safety copy first.

Uninstalling the application does not automatically delete your personal data.

See [docs/BACKUP_FORMAT.md](docs/BACKUP_FORMAT.md).

---

# 🏗️ UNDER THE HOOD

\<p align="center">
&#x20; \<img src="docs/assets/nexora-architecture.svg" width="100%" alt="NEXORA local-first system architecture">
\</p>

NEXORA uses a modular, local-first architecture.

```text
                       NEXORA
                          │
              ┌───────────┴───────────┐
              │                       │
        React + Vite             Three.js
        TypeScript                R3F / Drei
              │                       │
              └───────────┬───────────┘
                          │
                     FastAPI
                      Local API
                          │
          ┌───────────────┼───────────────┐
          │               │               │
       Learning       Simulation       Mission
        Engine          Engine          Engine
          │               │               │
          └───────────────┼───────────────┘
                          │
                   SQLite + Files
                          │
                   Optional Ollama
```

### Technology stack

| Layer                | Technology                        |
| -------------------- | --------------------------------- |
| Frontend             | React, TypeScript, Vite           |
| 3D                   | Three.js, React Three Fiber, Drei |
| State                | Zustand                           |
| UI                   | Tailwind CSS                      |
| Backend              | Python, FastAPI                   |
| Validation           | Pydantic                          |
| ORM                  | SQLAlchemy                        |
| Database             | SQLite                            |
| Scientific computing | NumPy, scikit-learn               |
| Code editor          | Monaco                            |
| Local AI             | Optional Ollama                   |
| Desktop roadmap      | Tauri 2                           |

No mandatory cloud infrastructure. No database server.

---

# 🗺️ WHAT'S NEXT?

NEXORA is being developed in verified milestones.

| Phase | Objective                                 | Status |
| ----- | ----------------------------------------- | ------ |
| 01    | Playable campus                           | ✅      |
| 02    | Local profiles and persistence            | ✅      |
| 03    | Learning and competency engine            | ✅      |
| 04    | Scientific simulations                    | ✅      |
| 05    | Missions and code execution               | ✅      |
| 06    | Optional local AI professors              | ✅      |
| 07    | Engagement and achievements               | ✅      |
| 08    | University arrival and campus foundations | ✅      |
| 09    | Advanced university features              | 🔄     |
| 10    | Tauri desktop and installers              | ⏳      |
| 11    | Security and performance hardening        | ⏳      |
| 12    | Cross-platform release                    | ⏳      |

Follow [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

---

# 🧑‍💻 JOIN THE UNIVERSITY

NEXORA is open source. There is room for engineers, educators, designers, researchers and creators.

### What can you contribute?

- Build new 3D campus environments.
- Create interactive scientific simulations.
- Improve AI and ML curriculum.
- Design engineering missions.
- Develop robotics experiences.
- Improve AI professor knowledge.
- Optimize performance.
- Improve accessibility.
- Expand testing and documentation.
- Help package desktop releases.

Start here:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [DEVELOPMENT.md](DEVELOPMENT.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [TESTING.md](TESTING.md)
- [SECURITY.md](SECURITY.md)

Have an idea? Open an issue.

Found a bug? Report it.

Want to build something? Submit a pull request.

---

# 📖 UNIVERSITY HANDBOOK

| Document                                          | What you'll find            |
| ------------------------------------------------- | --------------------------- |
| [Architecture](ARCHITECTURE.md)                   | How NEXORA is built         |
| [Development](DEVELOPMENT.md)                     | Developer setup             |
| [Testing](TESTING.md)                             | Testing strategy            |
| [Security](SECURITY.md)                           | Security principles         |
| [Contributing](CONTRIBUTING.md)                   | How to contribute           |
| [Learning Model](docs/LEARNING_MODEL.md)          | Curriculum and competencies |
| [Engagement](docs/ENGAGEMENT.md)                  | Challenges and progression  |
| [Campus](docs/CAMPUS.md)                          | University environment      |
| [Backup Format](docs/BACKUP_FORMAT.md)            | Data portability            |
| [Implementation Status](IMPLEMENTATION_STATUS.md) | Development progress        |
| [Changelog](CHANGELOG.md)                         | Release history             |

---

# ⭐ HELP BUILD THE FUTURE OF AI EDUCATION

If NEXORA makes you curious, here are five ways to help:

1. ⭐ Star this repository.
2. 🍴 Fork it and explore the code.
3. 🧪 Run an experiment.
4. 🛠️ Build something new.
5. 📢 Share it with someone who loves AI.

Every contribution helps make this vision more real.

---

\<p align="center">
&#x20; \<img src="docs/assets/nexora-closing.gif" width="100%" alt="NEXORA animated university closing scene">
\</p>

# 🎓 YOUR FIRST DAY STARTS NOW.

\<p align="center">

## NEXORA

### THE OPEN-WORLD UNIVERSITY FOR AI ENGINEERS

**Explore the world.**

**Understand the science.**

**Experiment with intelligence.**

**Build real systems.**

**Become an engineer.**

### LEARN AI BY ENGINEERING AI.

\</p>

\<p align="center">
&#x20; \<strong>Built for the next generation of AI engineers.\</strong>
\</p>

---

\<p align="center">
&#x20; \<sub>License: MIT · See \<a href="LICENSE">LICENSE\</a> and \<a href="THIRD_PARTY_NOTICES.md">THIRD_PARTY_NOTICES.md\</a> for licensing information.\</sub>
\</p>

---

## 🎨 README VISUAL ASSET CHECKLIST

The following files are referenced by this README. Add the actual assets to `docs/assets/` before publishing so that GitHub does not display broken images.

| Asset                      | Format   | Purpose                                |
| -------------------------- | -------- | -------------------------------------- |
| `nexora-logo.svg`          | SVG      | University logo                        |
| `nexora-hero.gif`          | GIF      | Cinematic animated campus introduction |
| `break-of-the-day.gif`     | GIF      | Neural network daily challenge         |
| `campus-world.png`         | PNG/WebP | 3D campus overview                     |
| `learning-journey.svg`     | SVG      | Learning progression graphic           |
| `nexora-campus-map.svg`    | SVG      | Illustrated district map               |
| `laboratory-preview.gif`   | GIF      | Laboratory walkthrough                 |
| `gradient-descent.gif`     | GIF      | Gradient descent experiment            |
| `neural-network.gif`       | GIF      | Neural network visualization           |
| `machine-learning.gif`     | GIF      | ML training visualization              |
| `rag-pipeline.svg`         | SVG      | RAG workflow                           |
| `transformer.gif`          | GIF      | Attention visualization                |
| `infrastructure-lab.svg`   | SVG      | Infrastructure concepts                |
| `professors-gallery.png`   | PNG/WebP | Professor characters                   |
| `mission-board.png`        | PNG/WebP | Mission interface                      |
| `achievement-showcase.gif` | GIF      | Achievement progression                |
| `nexora-dashboard.png`     | PNG/WebP | Application dashboard                  |
| `nexora-architecture.svg`  | SVG      | System architecture                    |
| `nexora-closing.gif`       | GIF      | Closing brand animation                |

### Animation and graphics guidelines

- Use optimized GIF or WebP animations for short demonstrations.
- Prefer SVG for diagrams, maps, logos and architecture.
- Use real application captures rather than fabricated product screenshots.
- Keep animations short, loop smoothly and avoid distracting flashing effects.
- Compress images and animations to keep the README fast to load.
- Provide meaningful alt text for accessibility.
- Keep the README compatible with GitHub's Markdown renderer.
- Never present planned features as working product demonstrations.

**The goal:** when someone opens NEXORA's GitHub repository, they should immediately understand the product, see the university world, watch the engineering experience and want to explore the project.
      
