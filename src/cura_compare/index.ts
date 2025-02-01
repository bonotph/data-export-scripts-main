import { fetchVarappData } from './varappData';
import { fetchCuraData, fetchSampleList, getWorkspace } from './curaData';
import { Preset } from './curaData';
const fs = require('fs');

const presets: { [key: string]: Preset } = {
  'pp-basics': {
    workspace: getWorkspace('pp'),
    filter: `{"varapp_impact":{"in":["frameshift_variant","splice_acceptor_variant","splice_donor_variant","start_lost","start_retained_variant","stop_gained","stop_lost","inframe_deletion","inframe_insertion","missense_variant","protein_altering_variant","splice_region_variant"]},"gnomadg_af":{"lte":0.005},"gnomadg_eas_af":{"lte":0.005},"gnomadv2_merged_af":{"lte":0.005},"gnomadv2_merged_eas_af":{"lte":0.005}}`,
    output_folder: `${__dirname}/data/cura_samples_pp`,
  },
  'pp-chrM': {
    workspace: getWorkspace('pp'),
    filter: `{"chrom":{"in":["chrM"]}}`,
    output_folder: `${__dirname}/data/cura_samples_pp_chrM`,
  },
};

async function fetchData() {
  await fetchCuraData(presets['pp-basics']);
  // await fetchCuraData(presets['pp-chrM']);
}

// check overlap file from pp and prod (compare consistency)
async function checkOverlapFile() {
  const samplesProd = await fetchSampleList('prod');
  const samplesPp = await fetchSampleList('pp');
  const output_path = `${__dirname}/input/overlap.tsv`;
  let tsvData =
    'proband\tbatch no pp\tlast update pp\tbatch no prod\tlast update prod\n';
  for (let proband in samplesProd) {
    if (samplesPp[proband]) {
      tsvData += `${proband}\t${samplesPp[proband].batch_no}\t${samplesPp[proband].update_at}\t${samplesProd[proband].batch_no}\t${samplesProd[proband].update_at}\n`;
    }
  }
  fs.writeFileSync(output_path, tsvData);
}

fetchData();
