#!/usr/bin/env bash
set -euo pipefail
backend_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_dir="$backend_root/../frontend/.tools/node-v22.23.3-linux-x64/bin"
if [[ -x "$runtime_dir/node" ]]; then
  export PATH="$runtime_dir:$PATH"
fi
cd "$backend_root"
exec npm "$@"
