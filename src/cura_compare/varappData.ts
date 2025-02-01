import { readFileSync } from 'fs';

const paths = {
  input_path: `${__dirname}/input/samples.txt`,
  output_folder: `${__dirname}/data/varapp_samples`,
  credential_path: `${__dirname}/data/varappCred.json`,
};
interface sampleDetail {
  name: string;
  group: string;
}

async function get_token() {
  // get username and password from JSON file
  const varappConfig = JSON.parse(
    readFileSync(paths.credential_path, 'utf-8'),
  ) as {
    username: string;
    password: string;
  };
  console.log(varappConfig);

  const response = await fetch(
    'https://varapp.hkgenome.com/backend/authenticate',
    {
      headers: {
        authorization: 'null',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: `username=${varappConfig.username}&password=${varappConfig.password}`,
      method: 'POST',
    },
  );
  interface returnType {
    id_token: string;
  }
  console.log(response.status);
  const result = (await response.json()) as returnType;
  return result.id_token;
}

async function getVcfs(token: string) {
  const response = await fetch(
    'https://varapp.hkgenome.com/backend/singleUserInfo',
    {
      headers: {
        authorization: `JWT ${token}`,
      },
      body: null,
      method: 'GET',
    },
  );
  interface returnType {
    databases: {
      name: string;
    }[];
  }
  const result = (await response.json()) as returnType;
  console.log(result);
  const vcfs = result.databases.map((item) => item.name);
  return vcfs;
}

async function getFamilyDetail(token: string, vcf: string) {
  const response = await fetch(
    `https://varapp.hkgenome.com/backend/${vcf}/samples`,
    {
      headers: {
        authorization: `JWT ${token}`,
      },
      body: null,
      method: 'GET',
    },
  );
  const result = (await response.json()) as sampleDetail[];
  return result;
}

async function downloadTsv(
  token: string,
  vcf: string,
  samples: sampleDetail[] | undefined = undefined,
) {
  if (samples === undefined) samples = await getFamilyDetail(token, vcf);
  let affected_param = '';
  let not_affected_param = '';
  samples.forEach((sample) => {
    if (sample.group === 'affected') {
      if (affected_param == '')
        affected_param = `&samples=affected=${sample.name}`;
      else affected_param = `${affected_param},${sample.name}`;
    } else {
      if (not_affected_param == '')
        not_affected_param = `&samples=not_affected=${sample.name}`;
      else not_affected_param = `${not_affected_param},${sample.name}`;
    }
  });
  const response = await fetch(
    `https://varapp.hkgenome.com/backend/${vcf}/variants/export?format=tsv&fields=chrom,start,end,gene_symbol,hgvsc,hgvsp,impact,impact_severity,gnomadv3_af,gnomadv3_af_xx,gnomadv3_af_xy,gnomadv3_af_afr,gnomadv3_af_ami,gnomadv3_af_amr,gnomadv3_af_asj,gnomadv3_af_eas,gnomadv3_af_fin,gnomadv3_af_mid,gnomadv3_af_nfe,gnomadv3_af_oth,gnomadv3_af_sas,gnomad_af,gnomad_afr_af,gnomad_amr_af,gnomad_asj_af,gnomad_eas_af,gnomad_fin_af,gnomad_nfe_af,gnomad_oth_af,gnomad_sas_af,constraint_mis_z,revel,existing_variation&filter=impact=frameshift_variant,splice_acceptor_variant,splice_donor_variant,start_lost,start_retained_variant,stop_gained,stop_lost,inframe_deletion,inframe_insertion,missense_variant,protein_altering_variant,splice_region_variant&filter=genotype=active&filter=gnomadv3_af%3C=0.005&filter=gnomadv3_af_eas%3C=0.005&filter=gnomad_af%3C=0.005&filter=gnomad_eas_af%3C=0.005${affected_param}${not_affected_param}`,
    {
      headers: {
        authorization: `JWT ${token}`,
      },
      body: null,
      method: 'GET',
    },
  );
  const result = await response.text();
  return result;
}

export async function fetchVarappData() {
  // Read probands from file
  const fs = require('fs');
  const probands = fs
    .readFileSync(paths.input_path)
    .toString()
    .trim()
    .split('\n');
  console.log(`loaded ${probands.length} probands`);

  const token = await get_token();
  const vcfs = await getVcfs(token);

  // for each proband, find vcf and download tsv
  for (const proband of probands) {
    console.log(`Processing proband ${proband}...`);
    const vcf = vcfs.find((item) => item.includes(proband));
    if (vcf === undefined) {
      console.log(`Proband ${proband} not found`);
      continue;
    }
    const samples = await getFamilyDetail(token, vcf);
    const result = await downloadTsv(token, vcf, samples);
    fs.writeFileSync(`${paths.output_folder}/${proband}.tsv`, result);
    console.log(`Proband ${proband} done`);
  }
}
