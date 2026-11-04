#!/usr/bin/env bash
# Fetch the Cat Snap release signing key for this build session.
# Needs CATSNAP_BUILD_SECRET, set by the owner in the cloud environment's
# settings (and as the same-named Supabase Edge Function secret).
# Writes android/keystore.properties (git-ignored) and the keystore outside the repo.
set -euo pipefail
: "${CATSNAP_BUILD_SECRET:?Set CATSNAP_BUILD_SECRET in the environment settings first}"
DIR="${CATSNAP_SIGNING_DIR:-$HOME/.catsnap-signing}"
mkdir -p "$DIR" && chmod 700 "$DIR"
curl -fsS -X POST -H "x-build-secret: ${CATSNAP_BUILD_SECRET}" \
  "https://mkabxvbkfwntlpxtoyus.supabase.co/functions/v1/build-key" -o "$DIR/signing.json"
chmod 600 "$DIR/signing.json"
python3 -I - "$DIR" "$(cd "$(dirname "$0")/.." && pwd)" <<'PY'
import base64, json, os, sys
d, repo = sys.argv[1], sys.argv[2]
s = json.load(open(os.path.join(d, 'signing.json')))
ks = os.path.join(d, 'catsnap-release.jks')
with open(ks, 'wb') as f: f.write(base64.b64decode(s['keystore_b64']))
os.chmod(ks, 0o600)
p = os.path.join(repo, 'android', 'keystore.properties')
with open(p, 'w') as f:
    f.write(f"storeFile={ks}\nstorePassword={s['store_password']}\nkeyAlias={s['key_alias']}\nkeyPassword={s['key_password']}\n")
os.chmod(p, 0o600)
PY
rm -f "$DIR/signing.json"
echo "Signing key ready."
