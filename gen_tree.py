import os
from pathlib import Path

ROOT = Path.cwd()
OUTPUT = ROOT / "tree_full.txt"

EXCLUDE_DIRS = {
    "__pycache__",
    "node_modules",
    "venv",
    ".git",
    "migrations",
    "media",
    "static",
    "dist",
    "build",
    ".vscode",
    ".idea",
    ".mypy_cache",
    ".pytest_cache",
    "coverage",
    ".next",
    ".nuxt",
}

EXCLUDE_EXTS = {
    ".pyc",
    ".pyo",
    ".log",
    ".db-journal",
    ".db-shm",
    ".db-wal",
    ".DS_Store",
    ".map",
}

EXCLUDE_FILES = {
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
    ".gitkeep",
}

lines = []

def add_line(text):
    lines.append(text)

def generate_tree(path: Path, prefix: str = ""):
    try:
        entries = sorted([
            p for p in path.iterdir()
            if p.name not in EXCLUDE_DIRS
            and p.name not in EXCLUDE_FILES
        ])
    except PermissionError:
        return

    for index, entry in enumerate(entries):
        last = index == len(entries) - 1
        connector = "└── " if last else "├── "

        if entry.is_dir():
            add_line(f"{prefix}{connector}{entry.name}/")
            extension = "    " if last else "│   "
            generate_tree(entry, prefix + extension)

        elif entry.is_file():
            if not any(entry.name.endswith(ext) for ext in EXCLUDE_EXTS):
                add_line(f"{prefix}{connector}{entry.name}")

add_line(f"{ROOT.name}/")
generate_tree(ROOT)
OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Written: {OUTPUT}")