#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_dir="$project_root/.tools/node-v22.23.3-linux-x64/bin"
if [[ -x "$runtime_dir/node" ]]; then
  export PATH="$runtime_dir:$PATH"
fi
cd "$project_root"
exec npm "$@"
