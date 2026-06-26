#!/usr/bin/env bash
#
# sync-skills.sh — sincroniza skills compartidas desde mdd145-prog/LIGIER.
#
# Lee .claude/skills/skills.json del repo actual y copia las skills declaradas
# desde LIGIER a .claude/skills/<nombre>/SKILL.md, agregando un banner anti-edición.
#
# La FUENTE ÚNICA DE VERDAD es mdd145-prog/LIGIER. Las copias locales NO se editan.
# Si una skill necesita cambios: editar en LIGIER, push, volver acá y correr este script.
#
# Uso:
#   ./scripts/sync-skills.sh
#
# Dependencias: git, python3 (stdlib).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SKILLS_JSON="$REPO_ROOT/.claude/skills/skills.json"
LIGIER_REPO="${LIGIER_REPO:-https://github.com/mdd145-prog/LIGIER.git}"
CACHE_DIR="${TMPDIR:-/tmp}/ligier-skills-cache"

if [ ! -f "$SKILLS_JSON" ]; then
  echo "✕ no existe $SKILLS_JSON — declarar primero las skills que consume este repo."
  exit 1
fi

if [ -d "$CACHE_DIR/.git" ]; then
  echo "→ Actualizando cache LIGIER en $CACHE_DIR"
  git -C "$CACHE_DIR" fetch --quiet origin
  git -C "$CACHE_DIR" reset --quiet --hard origin/main
else
  echo "→ Clonando LIGIER en $CACHE_DIR"
  rm -rf "$CACHE_DIR"
  git clone --quiet --depth=1 "$LIGIER_REPO" "$CACHE_DIR"
fi

export REPO_ROOT CACHE_DIR
python3 - <<'PY'
import json, os, sys
from pathlib import Path

repo_root = Path(os.environ["REPO_ROOT"])
cache = Path(os.environ["CACHE_DIR"])
skills_json = repo_root / ".claude" / "skills" / "skills.json"

cfg = json.loads(skills_json.read_text())
skills = cfg.get("skills", [])

if not skills:
    print("(skills.json no declara ninguna skill — nada que sincronizar)")
    sys.exit(0)

errors = []
for entry in skills:
    area = entry["area"]
    name = entry["skill"]
    src = cache / area / name / "SKILL.md"
    if not src.exists():
        errors.append(f"  ✕ no existe en LIGIER: {area}/{name}/SKILL.md")
        continue

    dest_dir = repo_root / ".claude" / "skills" / name
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "SKILL.md"

    upstream = src.read_text()
    banner = (
        "<!--\n"
        "  AUTO-GENERADO POR scripts/sync-skills.sh — NO EDITAR ACÁ.\n"
        f"  Fuente de verdad: mdd145-prog/LIGIER/{area}/{name}/SKILL.md\n"
        "  Para cambios: editar en LIGIER, hacer push, volver acá y re-correr el sync.\n"
        "-->\n\n"
    )
    dest.write_text(banner + upstream)
    print(f"  ✔ {area}/{name} → .claude/skills/{name}/SKILL.md")

if errors:
    print("\nErrores:")
    for e in errors:
        print(e)
    sys.exit(1)

print(f"\nListo: {len(skills)} skill(s) sincronizada(s) desde LIGIER.")
PY
