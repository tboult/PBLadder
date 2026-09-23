#!/bin/bash -e

# 1. Capture arguments
COMMIT_MSG="$1"
TARGET_ENV="${2:-dev}" # Defaults to 'dev' if not specified

# 2. Check if a commit message was provided
if [ -z "$COMMIT_MSG" ]; then
    echo "❌ Error: No commit message provided."
    echo "Usage: ./deploy.sh \"commit message\" [dev|prod]"
    exit 1
fi

# 3. Define Deployment IDs & Config Files
DEV_DEPLOYMENT_ID="AKfycbyuY1-ZkbpA2Udpe__rKSE6H4EBfl_OKn_Xep719FJII1u5RxAXhSzU3dyrD0c64diS"
PROD_DEPLOYMENT_ID="AKfycbweTOjVcY0R1sxXrYfbN2S9jqMz4yr5b1alVoz0gjVy3P3ty42rtHlfgfpdjtFnF4nFaQ"

if [ "$TARGET_ENV" = "prod" ]; then
    DEPLOYMENT_ID="$PROD_DEPLOYMENT_ID"
    CONFIG_FILE="prodclasp.json"
    MANIFEST_FILE="prodmanifest.json"    
    THEME_FILE="prodtheme.css"
    echo "🚀 DEPLOYING TO PRODUCTION..."
else
    DEPLOYMENT_ID="$DEV_DEPLOYMENT_ID"
    CONFIG_FILE="devclasp.json"
    MANIFEST_FILE="defmanifest.json"
    THEME_FILE="devtheme.css"    
    echo "🛠️ DEPLOYING TO DEVELOPMENT..."
fi

# 4. Ensure target .clasp config file exists before proceeding
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: $CONFIG_FILE not found in root directory."
    exit 1
fi

# 5. Swap .clasp.json to target the correct Apps Script project
cp "$CONFIG_FILE" .clasp.json
echo "📋 copied config to .clasp.json -> $CONFIG_FILE"

if [ -f "$MANIFEST_FILE" ]; then
    cp "$MANIFEST_FILE" manifest.json
    echo "📱 copied manifest.json -> $MANIFEST_FILE"
fi    

# Swap theme.css
if [ -f "$THEME_FILE" ]; then
    cp "$THEME_FILE" theme.css
    echo "🎨 copied $THEME_FILE -> theme.css"
fi

# 6. Update CACHE_NAME in sw.js
NEW_VER="v$(date +%Y%m%d%H%M%S)"
sed -i -E "s/const CACHE_NAME = '[^']+';/const CACHE_NAME = 'scpb-ladder-$NEW_VER';/" sw.js
echo "🏷️ Updated sw.js CACHE_NAME to: scpb-ladder-$NEW_VER"

# 7. Git commit & push
git commit -am "$COMMIT_MSG ($NEW_VER) [$TARGET_ENV]"
git push

# 8. Push code to Apps Script and deploy new version to exec URL
clasp push
clasp deploy -i "$DEPLOYMENT_ID" -d "$COMMIT_MSG ($NEW_VER)"

echo "✅ Successfully deployed to $TARGET_ENV!"
