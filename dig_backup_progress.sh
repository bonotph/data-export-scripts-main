#!/bin/bash

set -euo pipefail

docker run --rm \
  --env-file .env \
  data_export \
  sh -c "pnpm start src/digBackupProgress/"
