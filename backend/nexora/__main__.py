"""Launch NEXORA: `python -m nexora` (or the `nexora` script)."""

from __future__ import annotations

import argparse
import webbrowser


def main() -> None:
    import uvicorn

    from nexora.api.app import create_app
    from nexora.core.config import Settings

    parser = argparse.ArgumentParser(description="NEXORA - the open-world university for AI engineers")
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    settings = Settings() if args.port is None else Settings(port=args.port)
    app = create_app(settings)
    url = f"http://127.0.0.1:{settings.port}/"
    print(f"\n  NEXORA is running at {url}\n  Student data: {settings.data_dir}\n  Press Ctrl+C to stop.\n")
    if settings.static_dir and not args.no_browser:
        webbrowser.open(url)
    # Loopback only - never expose the local API on the network.
    uvicorn.run(app, host="127.0.0.1", port=settings.port, log_level="warning")


if __name__ == "__main__":
    main()
