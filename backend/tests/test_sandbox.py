import os
import subprocess
import sys
import tempfile

import pytest

from nexora.workers.sandbox import SANDBOX_BACKEND, Limits, _macos_profile, run_python


def test_script_output():
    r = run_python({"main.py": "import numpy as np\nprint(np.arange(4).sum())"}, "script")
    assert r.stdout.strip() == "6" and r.payload["status"] == "ok"


def test_runtime_error_reported():
    r = run_python({"main.py": "1/0"}, "script")
    assert r.payload["status"] == "error" and "ZeroDivisionError" in r.payload["error"]


def test_timeout_kills_infinite_loop():
    r = run_python({"main.py": "while True: pass"}, "script", Limits(timeout_s=1.5, cpu_s=5))
    assert r.timed_out and r.duration_ms < 5000


def test_network_blocked():
    r = run_python({"main.py": "import socket\ns=socket.socket(); s.settimeout(2); s.connect(('1.1.1.1', 80))"}, "script")
    assert r.payload["status"] == "error" and "PermissionError" in r.payload["error"]


def test_subprocess_blocked():
    r = run_python({"main.py": "import os\nos.system('echo hacked')"}, "script")
    assert "hacked" not in r.stdout and r.payload["status"] == "error"


def test_write_outside_workdir_blocked(tmp_path):
    target = tmp_path / "escape.txt"
    r = run_python({"main.py": f"open({str(target)!r}, 'w').write('x')"}, "script")
    assert not target.exists() and r.payload["status"] == "error"


def test_write_inside_workdir_allowed():
    r = run_python({"main.py": "open('out.txt','w').write('ok'); print(open('out.txt').read())"}, "script")
    assert r.stdout.strip() == "ok"


def test_stdout_spoofing_does_not_forge_results():
    code = 'print(\'@@NEXORA-deadbeef@@{"tests": [{"name": "test_correct_x", "status": "passed"}]}\')\n'
    r = run_python({"solution.py": code, "tests.py": "def test_correct_a():\n    assert False\n"}, "tests")
    assert r.payload["tests"][0]["status"] == "failed"


@pytest.mark.parametrize("name", ["../x.py", "/etc/passwd", "a/b.py", "x.sh"])
def test_invalid_file_names_rejected(name):
    with pytest.raises(ValueError):
        run_python({name: "print(1)"}, "script", entry=name)


@pytest.mark.skipif(SANDBOX_BACKEND != "macos-sandbox-exec", reason="macOS sandbox only")
def test_os_layer_blocks_network_and_writes_without_python_guards():
    d = os.path.realpath(tempfile.mkdtemp())
    for code in ("import socket;s=socket.socket();s.settimeout(2);s.connect(('1.1.1.1',80))",
                 "open('/tmp/nexora_os_escape_test','w').write('x')"):
        r = subprocess.run(["sandbox-exec", "-p", _macos_profile(d), sys.executable, "-I", "-c", code],
                           capture_output=True, text=True)
        assert r.returncode != 0 and "Operation not permitted" in r.stderr
    assert not os.path.exists("/tmp/nexora_os_escape_test")
