import os
from pathlib import Path
import sys

def generate_tree(directory, prefix="", ignore_dirs={'venv', 'node_modules', '__pycache__', '.git', '.egg-info'}):
    """Generate a tree structure of the directory"""
    path = Path(directory)
    
    try:
        entries = sorted(path.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    except PermissionError:
        return
    
    # Filter out ignored directories and .dist-info folders
    entries = [e for e in entries if e.name not in ignore_dirs and not e.name.endswith('.dist-info')]
    
    for i, entry in enumerate(entries):
        is_last = i == len(entries) - 1
        current_prefix = "+-- " if is_last else "|-- "
        display_name = entry.name + ("/" if entry.is_dir() else "")
        try:
            print(prefix + current_prefix + display_name)
        except UnicodeEncodeError:
            print(prefix + current_prefix + display_name.encode('ascii', 'ignore').decode('ascii'))
        
        if entry.is_dir():
            next_prefix = prefix + ("    " if is_last else "|   ")
            generate_tree(entry, next_prefix, ignore_dirs)

# Generate tree starting from current directory
print("Backend/")
generate_tree("c:\\Users\\Creed_07\\Desktop\\Backend")


# Generate tree starting from current directory
print("Backend/")
generate_tree("c:\\Users\\Creed_07\\Desktop\\Backend")
