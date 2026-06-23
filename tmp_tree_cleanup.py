from pathlib import Path

root = Path(r'C:/Users/Creed_07/Desktop/Backend')
ignore_dirs = {
    '.git',
    'node_modules',
    '__pycache__',
    '.pytest_cache',
    'venv',
    '.mypy_cache',
    '.idea',
    '.vscode',
    'media',
    'static',
    'migrations'
}
ignore_files = {
    '.env',
    '.env.example',
    '.gitignore',
    'db.sqlite3',
    'db.sqlite3.backup',
    'package-lock.json'
}


def should_ignore(path: Path) -> bool:
    if path.is_dir() and path.name in ignore_dirs:
        return True
    if path.is_file() and path.name in ignore_files:
        return True
    return False


lines = ['Backend/']


def walk(path: Path, prefix: str = ''):
    entries = sorted(
        [p for p in path.iterdir() if not should_ignore(p)],
        key=lambda p: (p.is_file(), p.name.lower())
    )
    for i, entry in enumerate(entries):
        is_last = i == len(entries) - 1
        connector = '└── ' if is_last else '├── '
        if entry.is_dir():
            lines.append(f"{prefix}{connector}{entry.name}/")
            walk(entry, prefix + ('    ' if is_last else '│   '))
        else:
            lines.append(f"{prefix}{connector}{entry.name}")


walk(root)
output = '\n'.join(lines)
Path('tree_clean.txt').write_text(output, encoding='utf-8')
print(output)
