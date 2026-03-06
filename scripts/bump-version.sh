#!/bin/bash
# Incrementa la versione patch in apps/web/package.json prima di ogni push
# Uso: ./scripts/bump-version.sh

PKG="apps/web/package.json"
CURRENT=$(node -p "require('./$PKG').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

# Aggiorna package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
"

echo "Version bumped: $CURRENT -> $NEW_VERSION"
git add "$PKG"
