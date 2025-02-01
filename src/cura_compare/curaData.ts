import { readFileSync } from 'fs';
const paths = {
  input_path: `${__dirname}/input/samples.txt`,
};
interface Workspace {
  name: string;
  url: string;
  cookie_path: string;
  cookie_str: string;
}
const workspaces: Workspace[] = [
  {
    name: 'pp',
    url: 'https://cura.api.cf-pp.genomeproject.hk',
    cookie_path: `${__dirname}/data/cura_login/cookies_pp.json`,
    cookie_str: '',
  },
  {
    name: 'prod',
    url: 'https://cura.api.cf.genomeproject.hk',
    cookie_path: `${__dirname}/data/cura_login/cookies_prod.json`,
    cookie_str: '',
  },
];
export interface Preset {
  workspace: Workspace;
  filter: string;
  output_folder: string;
}

export function getWorkspace(WorkspaceName: string) {
  const workspace = workspaces.find((w) => w.name === WorkspaceName);
  if (!workspace) throw new Error('workspace not found');

  const cookie = JSON.parse(readFileSync(workspace.cookie_path).toString());
  workspace.cookie_str = Object.entries(cookie)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
  return workspace;
}

async function searchSample(key: string, workspace: Workspace) {
  const response = await fetch(
    `${workspace.url}/interpretation/list?searchText=${key}&page=0&pageSize=500`,
    {
      headers: {
        cookie: workspace.cookie_str,
      },
      body: null,
      method: 'POST',
    },
  );
  const result = (
    (await response.json()) as {
      data: {
        id: string;
        update_at: number;
        status: string;
        samples: { name: string; is_proband: boolean }[];
      }[];
    }
  ).data
    .filter((d) => d.status === 'Ready')
    .filter((d) => d.samples.filter((s) => s.is_proband)[0].name === key);

  // get the id of sample with latest update
  if (result.length === 0) {
    console.log(`sample ${key} not found`);
    return null;
  }
  const sampleId = result.sort((a, b) => b.update_at - a.update_at)[0].id;
  return sampleId;
}

async function fetchVariants(sampleId: string, preset: Preset) {
  const workspace = preset.workspace;
  const response = await fetch(`${workspace.url}/variant?id=${sampleId}`, {
    headers: {
      'content-type': 'application/json',
      cookie: workspace.cookie_str,
    },
    body: `{"id":"${sampleId}","page":"0","pageSize":"5000","filter":${preset.filter},"sort":""}`,
    method: 'POST',
  });
  const result = (await response.json()) as {
    variants: any[];
  };

  return result;
}

function convertVariantToArray(variants: any[]) {
  const header = Object.keys(variants[0]);
  const rows = variants.map((v) => Object.values(v));
  return [header, ...rows];
}

export async function fetchCuraData(preset: Preset) {
  const workspace = preset.workspace;

  // Read probands from file
  const fs = require('fs');
  const probands: string[] = fs
    .readFileSync(paths.input_path)
    .toString()
    .trim()
    .split('\n');
  console.log(`${workspace.name}: loaded ${probands.length} probands`);

  for (const [index, proband] of probands.entries()) {
    console.log(`${workspace.name}: fetching ${proband}`);
    const sampleId = await searchSample(proband, workspace);
    if (!sampleId) continue;

    const result = await fetchVariants(sampleId, preset);
    if (result == null || result.variants.length === 0) {
      console.log(`no variant for ${proband}`);
      continue;
    }

    // store variants to tsv file
    const tsvData = convertVariantToArray(result.variants)
      .map((row) => row.join('\t'))
      .join('\n');
    const output_path = `${preset.output_folder}/${proband}.tsv`;
    if (!fs.existsSync(preset.output_folder)) {
      fs.mkdirSync(preset.output_folder, { recursive: true });
    }
    fs.writeFileSync(output_path, tsvData);
    console.log(`saved ${proband} (${index + 1}/${probands.length})`);
  }
}

export async function fetchSampleList(WorkspaceName: string) {
  const workspace = getWorkspace(WorkspaceName);

  const response = await fetch(
    `${workspace.url}/interpretation/list?page=0&pageSize=500`,
    {
      headers: {
        cookie: workspace.cookie_str,
      },
      body: null,
      method: 'POST',
    },
  );
  if (!response.ok)
    throw new Error(`${workspace.name}: failed to fetch sample list`);
  const result = (await response.json()) as {
    data: {
      samples: { name: string; is_proband: boolean }[];
      status: string;
      batch_no: string;
      update_at: number;
    }[];
  };

  interface Sample {
    proband: string;
    update_at: string;
    batch_no: string;
  }
  let samples = result.data
    .filter(({ status }) => status === 'Ready')
    .map((d) => ({
      proband: d.samples.filter((s) => s.is_proband)[0].name,
      update_at: new Date(d.update_at * 1000).toLocaleDateString(),
      batch_no: d.batch_no,
    }));
  // remove duplicate proband and keep latest update one
  const uniqueSamples: { [proband: string]: Sample } = {};
  samples.forEach((sample) => {
    const proband = sample.proband;
    if (
      !uniqueSamples[proband] ||
      new Date(sample.update_at) > new Date(uniqueSamples[proband].update_at)
    ) {
      uniqueSamples[proband] = sample;
    }
  });
  return uniqueSamples;
}
