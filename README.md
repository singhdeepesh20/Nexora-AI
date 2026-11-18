# Nexora-AI

#### The Open-World University for AI Engineers

Explore. Learn. Experiment. Build. Discover.

With **NEXORA** you explore a 3D campus, run real scientific simulations, complete engineering missions graded by automated tests, and learn from AI professors - entirely on your own computer.

> Explore → Understand → Experiment → Engineer → Debug → Validate → Master

## Principles

1. **AI is optional.** Every learning experience works with no AI model installed. A local [Ollama](https://ollama.com) model can enhance the mentors if you install one yourself; NEXORA never downloads models and never calls paid APIs.
2. **Your data is yours.** Profiles, progress, projects, experiments and mentor conversations live in a local SQLite database and project folders. Export, restore or delete everything from Settings. No accounts, no cloud, no telemetry.
3. **Real engineering.** Simulations compute real results (NumPy / scikit-learn), missions run your code against hidden tests in a sandbox, and mastery comes only from verifiable work.

## What works today (v0.1.0)

| Area | Status |
|------|--------|
| 3D campus: third-person avatar, walk/run, mouse camera, collision, building entry, minimap, graphics presets, FPS monitor | ✅ |
| Districts 01-03 (Foundation City, Machine Learning District, Deep Learning Center) - 12 concepts with lessons, objectives, examples and assessments | ✅ |
| Districts 04-08 present in the world as gates with their planned subjects | 🟡 planned |
| Competency engine: prerequisite graph, deterministic grading, mastery rules, recommendations, review scheduling, skills | ✅ |
| Laboratories: Gradient Descent, Neural Network, Machine Learning, RAG retrieval, Transformer (toy), AI Infrastructure (estimates + real CPU benchmark) | ✅ |
| Missions: Python Fundamentals, Dataset Explorer, Build a Classifier, Train a Neural Network, Build a RAG Retriever | ✅ |
| Monaco code editor (bundled offline), sandboxed Python execution | ✅ |
| AI professors: 8 personas, offline curriculum-grounded answers, optional Ollama | ✅ |
| Backup export / verified import / complete deletion | ✅ |
| Desktop app (Tauri 2) and installers | ⏳ Phase 10 - see [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) |

## Quick start

Requirements: **Node.js 22+**, **Python 3.12**, [**uv**](https://docs.astral.sh/uv/). No GPU, no internet after installation.

```bash
git clone <your fork> nexora && cd nexora
npx pnpm@9.15.9 install
(cd backend && uv sync)
bash scripts/start.sh   # builds the UI on first run, then opens http://127.0.0.1:8765
```

Keep that terminal open while you use NEXORA - closing it (or Ctrl+C) stops the app. Development with hot reload: `bash scripts/dev.sh` (Vite on http://127.0.0.1:5173, API on 8765).

### Controls

`W A S D` move · `Shift` run · click + mouse to look · scroll to zoom · `E` interact · `M` map · `J` dashboard · `K` missions · `L` my lab · `Esc` back / pause

### Optional: local AI mentor

Install Ollama yourself, pull any model (for example `ollama pull llama3.2`), then pick it in **Settings → Local AI mentor**. Without it, professors answer from the curriculum.

## Where is my data?

| OS | Default location |
|----|------------------|
| macOS | `~/Library/Application Support/NEXORA` |
| Windows | `%LOCALAPPDATA%\NEXORA` |
| Linux | `~/.local/share/NEXORA` |

Override with `NEXORA_DATA_DIR`. Updating NEXORA keeps this folder; database migrations take a safety copy first. Uninstalling the app does not delete it - use **Settings → Delete all local data** or remove the folder. The backup format is documented in [docs/BACKUP_FORMAT.md](docs/BACKUP_FORMAT.md).

## Documentation

[ARCHITECTURE.md](ARCHITECTURE.md) · [DEVELOPMENT.md](DEVELOPMENT.md) · [TESTING.md](TESTING.md) · [SECURITY.md](SECURITY.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/LEARNING_MODEL.md](docs/LEARNING_MODEL.md) · [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) · [CHANGELOG.md](CHANGELOG.md)

## License

MIT - see [LICENSE](LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
