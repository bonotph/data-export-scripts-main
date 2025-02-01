#!/bin/bash

set -euo pipefail

python3 src/fastq/generate_input.py
echo -e '\nProcessing...\n'

fail=false
docker run --rm \
	   --env-file .env \
	   -v $PWD/src/fastq/input_data:/home/user/project/data-export-scripts/src/fastq/input_data \
	   -v $PWD/result:/home/user/project/data-export-scripts/src/fastq/output/ \
	   data_export \
	   sh -c "pnpm start src/fastq" &>/dev/null || fail=true

if [ "$fail" = true ]; then
	echo "Failed to run the fastq script"
	exit 1
fi

echo -e "Fastq script ran successfully and saved in result/output.tsv\n"
cat result/output.tsv
echo