# Knowledge Base

## Layout

```text
~/Documents/Codex Library/
├── INDEX.md                    # human-readable catalog
├── index.json                  # machine-readable index
├── projects/
│   └── codex-for-mac-1172ca/
│       ├── project.json
│       └── conversations/
│           ├── *.md            # read here
│           └── *.json          # program metadata
├── inbox/                      # unassigned captures
└── _archive/
    ├── manifest.csv            # original -> archived path
    └── test-projects-20261023/ # moved, never deleted
```

The library is intentionally small: one active project and one active conversation after the 2026-10-23 cleanup. Five synthetic/test projects were archived with a reversible manifest.

## Why keep both MD and JSON

- `.md` is the human reading copy.
- `.json` keeps the structured turns and metadata used by `cfm library` and downstream tools.
- `index.json` is the lookup layer; do not rely on directory order.

## Find things

```bash
# full-text search
rg -n "关键词" ~/Documents/Codex\ Library

# list readable conversations
find ~/Documents/Codex\ Library/projects -name '*.md'

# CLI catalog
cfm library list

# open the folder
cfm knowledge
```

## Restore an archived project

1. Read `_archive/manifest.csv`.
2. Move the archived directory back under `projects/`.
3. Restore its entry in `index.json`, or re-export with `cfm library export --force`.
4. Do not overwrite an existing project directory.

The archive contains test conversations only. Keep it until you have confirmed nothing is needed.

## Index rules

- `index.json` is the source for `cfm library list`.
- `INDEX.md` is generated for humans and links to markdown files.
- `project.json` carries the project path and slug.
- `index.json` is written with mode `0600`.

## Safety

- Cleanup used move-only, not delete.
- A full library backup was made before the cleanup.
- If an export re-adds old test sessions from `~/.codex`, archive them again rather than deleting them.
