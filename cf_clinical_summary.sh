#!/bin/bash

set -euo pipefail

group_id=$(id -g)

# for use in 20E Linux server shared folder, check if the group data exists,
if id data >/dev/null 2>&1; then
  group_id=$(id -g data)
fi

# create the result folder in current directory if not exists
if ! [ -d "$PWD/result" ]; then
  mkdir result
fi

docker run --rm \
  -u $(id -u):$group_id \
  -v $PWD/result:/home/user/project/data-export-scripts/src/clinicalSummary/output/ \
  --env-file .env \
  data_export \
  sh -c "pnpm start src/clinicalSummary/" &&
  echo 'result xlsx is saved in the "result" folder'
