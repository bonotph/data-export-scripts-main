# Data Export Scripts

## Description

This is the repository storing the data export scripts for CF, DIG, etc... The scripts are written using TypeScript with Prisma as the ORM. It is assumed that pnpm will be used as the package manager for installing packages and running the scripts.

## Index

1. [Requirements](#requirements)
2. [Environment Variables](#environment-variables)
3. [Usage](#usage)
4. [Scripts](#scripts)

## Requirements

The scripts can be used either natively / with Docker. For usage with Docker, a Dockerfile is provided to create the necessary environment image for running the scripts.

- Native Usage (without Docker)
  - Node.js 18+
  - pnpm
- With Docker
  - Docker 20+

## Environment Variables

An .env.example is also provided. Simply copy into a file named .env and fill in the variable for the scripts to work.

### Prisma

https://www.prisma.io/docs/reference/database-reference/connection-urls

| Key           | Description                                                               | Default |
| ------------- | ------------------------------------------------------------------------- | ------- |
| CF_MYSQL_URL  | Connection string for Prisma to connect to the Clinical Frontend MySQL    | ---     |
| DIG_MYSQL_URL | Connection string for Prisma to connect to the DIG MySQL                  | ---     |
| DB_PSQL_URL   | Connection string for Prisma to connect to the Stats Dashboard PostgreSQL | ---     |

### AWS

| Key                    | Description                                                 | Default                                                 |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| AWS_REGION             | AWS Region of the S3 bucket                                 | ap-east-1                                               |
| AWS_ACCESS_KEY_ID      | AWS access key id                                           | ---                                                     |
| AWS_SECRET_ACCESS_KEY  | AWS secret access key                                       | ---                                                     |
| VARAPP_LAMBDA_API_LINK | API link for Varapp lambda, for fetching Varapp sample data | https://stats-dashboard-api.hkgi-dataplatform.com/files |
| VARAPP_LAMBDA_API_KEY  | API key for accessing the Varapp lambda                     | ---                                                     |

## Usage

### Natively

```bash
# install all packages
$ pnpm install

# optionally, generate the runtime Prisma client
$ pnpm run prisma_gen

# the ts scripts can be started by prefixing with 'pnpm start', whicg will run the script with ts-node
# for example running the script to get the latest DIG backup status
$ pnpm start src/digBackupProgress
```

### With Docker

```bash
# build the image
$ ./docker_build.sh

# getting the latest DIG backup status
$ ./dig_backup_progress.sh

# for the scripts below, the generated xlsx report is saved in the ./result folder
# ***
# the user group specified in the scripts are hard-coded for use in the office 20E Linux server shared folder,
# update as needed
# ***

# generating the clinical summary data report from CF
$ ./cf_clinical_summary.sh

# generating the family hpo data report from CF
$ ./cf_hpo_family.sh
```

### 20E Linux Server

The repository is available in the path `/home/shared/data-export-scripts` which is a shared folder. Run the scripts under [With Docker](#with-docker) and the corresponding xlsx report will be generated under the `result` folder. The provided sh scripts are hard-coded with the required user and group for use in the shared folder. Modify as needed if running in another environment.

## Scripts

### Major Scripts

1. [digBackupProgress](#srcdigbackupprogressindexts)
2. [hpo_family](#srchpo_familyindexts)

### `src/digBackupProgress/index.ts`

Extract and process the latest status of DIG cold backup to the AWS S3 cold storage bucket.

The script first extract the list of files that needs to be backed up from the DIG MySQL replica. Then it fetches the list of files in the AWS S3 cold storage bucket. It goes through the DIG file list one by one to record the total number of files & jobs, and the amount of data that has been backed up to the S3 bucket.

Finally, it prints the result in the stdout & stderr.

For the DIG backup file list, it looks for files (not deleted) from the jobs (not deleted) from projects (not deleted) in the workspace 'Testing', 'CPOS', 'HKGI'. The job status should be '2' which means completed, and the pipeline should be 'fq2vcf+SV'.

The AWS S3 bucket object naming convention is as follows:

`s3://hkgi-dig-cold-data-store/{workspace name}/{job name}/{project name}/{job ID}/{file ID}__{file name}`

The script can be executed via the following command natively.

```bash
$ pnpm start src/digBackupProgress
```

Since the data size is quite large, this script require quite a lot of memory. It is recommended to run it in the 20E Linux server via the `dig_backup_progress.sh` script.

### `src/hpo_family/index.ts`

Extract the family hpo report from CF MySQL replica.

It fetches the list of participants and relationships from CF MySQL. Then it group the participants into families using the relationships to form the disjoint sets. The smallest HKGI ID of the participant in a family is used as the family ID as an identifier.

The resulting report also contains the HPO term ID and full HPO term name. The HPO term mapping is done using the `src/hpo_family/hpoMap.json` which is extracted from the CF codebase.

The xlsx report is saved inside the `src/hpo_family/output` folder.

The script can be executed via the following command natively.

```bash
$ pnpm start src/hpo_family
```

### Common utils

### `src/common/saveToXLSX.ts`

Contain the wrapper functions (saveSheetsToXLSX, saveAoaToXLSX) to save data into an .xlsx file using the sheetjs library.

### `src/common/awsFetches.ts`

Export the fetchS3ObjectList function, which is a function to fetch the list of objects in the specified AWS S3 buckets.

---
