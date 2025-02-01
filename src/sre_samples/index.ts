import { PrismaClient } from '../../prisma/generated/dig_client';
import { format } from 'date-fns';
import fs from 'fs';
import xlsx from 'xlsx';

const samplesFilePath = 'src/sre_samples/samples.txt';
const suffixes = [
  '.cnvkit.vcf.gz.tbi',
  '.cnvkit.vcf.gz',
  '.final.cram.crai',
  '.final.cram',
  '.final.final.vcf.idx',
  '.final.final.vcf',
  '.final.vcf.gz.tbi',
  '.final.vcf.gz',
  '.g.vcf.gz.tar',
  '.insurveyor.genotyped.pass.vcf.gz.tbi',
  '.insurveyor.genotyped.pass.vcf.gz',
  '.survindel2.genotyped.pass.vcf.gz.tbi',
  '.survindel2.genotyped.pass.vcf.gz',
  '.vcf',
];

const digClient = new PrismaClient();

async function main() {
  // load samples from input file
  const fileContents = fs.readFileSync(samplesFilePath, 'utf-8');
  const samples = fileContents.trim().split('\n');

  // check dig file availability of each samples
  const sampleStatus: {
    sample: string;
    availibity: string;
    latest: string;
  }[] = [];
  for (const sample of samples) {
    console.log(`Checking files for sample: ${sample}`);

    // fetch files from dig
    const files = (
      await digClient.file.findMany({
        select: {
          name: true,
        },
        where: {
          name: {
            startsWith: sample,
          },
          isDeleted: false,
        },
        distinct: ['name'],
      })
    )
      .map((file) => file.name)
      .filter((name) =>
        suffixes.some((suffix) => name.substring(name.indexOf('.')) == suffix),
      );

    // count numbers of suffixes included in files
    const suffixCounts = suffixes
      .map((suffix) => (files.some((name) => name.endsWith(suffix)) ? 1 : 0))
      .reduce((acc: number, cur) => acc + cur, 0);
    const availability =
      suffixCounts === suffixes.length
        ? 'complete'
        : suffixCounts === 0
        ? 'missing'
        : 'incomplete';

    // get latest version of the sample
    let latest = '';
    files.forEach((name) => {
      const version = name.substring(0, name.indexOf('.'));
      if (
        version.length > latest.length ||
        (version.length === latest.length && version > latest)
      ) {
        latest = version;
      }
    });

    sampleStatus.push({
      sample,
      availibity: availability,
      latest,
    });
  }

  // export sampleStatus to xlsx file
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(sampleStatus);
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Sample Status');

  const outputFilePath = `src/sre_samples/output/${format(
    new Date(),
    'yyMMdd_HHmmss',
  )}_sampleStatus.xlsx`;
  xlsx.writeFile(workbook, outputFilePath);

  console.log(`Sample status exported to ${outputFilePath}`);
}

main();
