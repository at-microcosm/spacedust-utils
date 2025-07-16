#!/bin/bash
set -euo pipefail
set +x

git switch gh-pages
git merge --no-ff main -m 'merge main'

cd atproto-notifications
export VITE_NOTIFICATIONS_HOST=https://notifications-demo-api.microcosm.blue
npm run just-build
cd ..

cp docs/CNAME atproto-notifications/dist/
rm -fr docs
mv atproto-notifications/dist docs

mkpage () {
  local page=$1
  mkdir -p "docs${page}"
  cp docs/index.html "docs${page}/index.html"
}

mkpage /admin
mkpage /early

git add docs
git commit -m 'update build'
git push
git switch -
