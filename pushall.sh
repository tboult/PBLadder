#!/bin/bash -e -x

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
# Fixed variable name (capitalized DEV_)
DEV_DEPLOYMENT_ID="AKfycbyuY1-ZkbpA2Udpe__rKSE6H4EBfl_OKn_Xep719FJII1u5RxAXhSzU3dyrD0c64diS"
PROD_DEPLOYMENT_ID="AKfycbweTOjVcY0R1sxXrYfbN2S9jqMz4yr5b1alVoz0gjVy3P3ty42rtHlfgfpdjtFnF4nFaQ"

if [ "$TARGET_ENV" = "prod" ]; then
    DEPLOYMENT_ID="$PROD_DEPLOYMENT_ID"
    CLASP_FILE="prodclasp.json"
    THEME_FILE="prodtheme.css"
    echo "🚀 DEPLOYING TO PRODUCTION..."
else
    DEPLOYMENT_ID="$DEV_DEPLOYMENT_ID"
    CLASP_FILE="devclasp.json"
    THEME_FILE="devtheme.css"    
    echo "🛠️ DEPLOYING TO DEVELOPMENT ($DEPLOYMENT_ID)..."
fi

# 4. Ensure target .clasp config file exists before proceeding
if [ ! -f "$CLASP_FILE" ]; then
    echo "❌ Error: $CLASP_FILE not found in root directory."
    exit 1
fi

# 5. Swap .clasp.json to target the correct Apps Script project
cp "$CLASP_FILE" .clasp.json
echo "📋 Copied config to $CLASP_FILE -> .clasp.json  "

# Swap appsscript.json if environment manifests exist
if [ -f "${TARGET_ENV}manifest.json" ]; then
    cp "${TARGET_ENV}manifest.json" appsscript.json
    echo "📱 Copied ${TARGET_ENV}manifest.json -> appsscript.json"
fi


# Swap theme.css
if [ -f "$THEME_FILE" ]; then
    cp "$THEME_FILE" theme.css
    echo "🎨 Copied $THEME_FILE -> theme.css"
fi

# 6. Update CACHE_NAME in sw.js
NEW_VER="v$(date +%Y%m%d%H%M%S)"
sed -i -E "s/const CACHE_NAME = '[^']+';/const CACHE_NAME = 'scpb-ladder-$NEW_VER';/" sw.js
echo "🏷️ Updated sw.js CACHE_NAME to: scpb-ladder-$NEW_VER"

# 7. Push code to Apps Script and update existing deployment version in-place
clasp push --force
clasp deploy -i "$DEPLOYMENT_ID" -d "$COMMIT_MSG ($NEW_VER)"

# 8. Git commit & push after deployment succeeds
git commit -am "$COMMIT_MSG ($NEW_VER) [$TARGET_ENV]"
git push

echo "✅ Successfully updated deployment $DEPLOYMENT_ID for $TARGET_ENV!"
