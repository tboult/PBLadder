#!/bin/bash -x

# 1. Capture the first argument safely using double quotes
COMMIT_MSG="$1"

# 2. Check if a commit message was actually provided
if [ -z "$COMMIT_MSG" ]; then
    echo "Error: No commit message provided."
    exit 1
fi

# 3. Update CACHE_NAME in sw.js before committing/pushing
NEW_VER="v$(date +%Y%m%d%H%M%S)"
sed -i -E "s/const CACHE_NAME = '[^']+';/const CACHE_NAME = 'scpb-ladder-$NEW_VER';/" sw.js
echo "Updated sw.js CACHE_NAME to: scpb-ladder-$NEW_VER"

# 4. Commit to Git, push to GitHub, push to Clasp, and Deploy
git commit -am "$COMMIT_MSG ($NEW_VER)"
git push
clasp push
clasp deploy -i AKfycbweTOjVcY0R1sxXrYfbN2S9jqMz4yr5b1alVoz0gjVy3P3ty42rtHlfgfpdjtFnF4nFaQ -d "$COMMIT_MSG"
