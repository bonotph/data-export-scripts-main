import { prismaFetches } from '../common/prismaFetches';
import { ParticipantReferrerQuery } from './types';
import { parseParticipantReferrerStats } from './clinicians';
import { fetchParticipantReferrer } from './prismaFetches';
import { saveReferrerRankingsToXLSX } from './saveToFiles';
import { PrismaClient } from '../../prisma/generated/cf_client';

// function matchParticipantSamples(
//   participants: ParticipantReferrerQuery[],
//   samples: SampledDataMap
// ) {
//   participants.forEach((participant) => {
//     participant.hasSequencedSamples = 0;

//     participant.specimens.forEach((specimen) => {
//       const filename = samples.get(specimen.lab_id);
//       if (filename) {
//         participant.hasSequencedSamples = 1;

//         specimen.isSequenced = 1;
//         specimen.sampleFileKey = filename;
//       } else {
//         specimen.isSequenced = 0;
//         specimen.sampleFileKey = "";
//       }
//     });
//   });
// }

// function saveParticipantReferrersSpecimens(
//   participants: ParticipantReferrerQuery[]
// ) {
//   let result = `Referrer Name, Referrer Type, Is User, HKGI ID, PC ID, Refer Hospital, Status, Is Proband, Refer Department, Refer Division, Create At, hasSequencedSpecimens, Specimens\n`;

//   participants.forEach((participant) => {
//     const {
//       hkgi_id,
//       pc_id,
//       referHospital,
//       status,
//       isProband,
//       referDepartment,
//       referDivision,
//       create_at,
//       referringNonUsers,
//       referringUsers,
//       hasSequencedSamples,
//       specimens,
//     } = participant;

//     const participantDataRow = [
//       hkgi_id,
//       pc_id,
//       referHospital,
//       status,
//       isProband,
//       referDepartment,
//       referDivision,
//       format(new Date(create_at * 1000), "yyyy-MM-dd hh:mm:ss"),
//       hasSequencedSamples,
//       `""${JSON.stringify(specimens)}""`,
//     ]
//       .join(", ")
//       .concat("\n");

//     let row = "";

//     referringUsers.forEach((user) => {
//       row += `"${user.user.displayName}", ${user.type}, 1, ${participantDataRow}`;
//     });

//     referringNonUsers.forEach((nonUser) => {
//       row += `"${nonUser.referrer}", ${nonUser.type}, 0, ${participantDataRow}`;
//     });

//     if (referringUsers.length === 0 && referringNonUsers.length === 0) {
//       row += `"", "", "", ${participantDataRow}`;
//     }

//     result += row;
//   });

//   fs.writeFileSync(
//     `${__dirname}/output/participants_referrer_specimens_${format(
//       new Date(),
//       "yyMMdd"
//     )}.csv`,
//     result
//   );
// }

const cf_prisma = new PrismaClient();

async function main() {
  const [[data]]: [[ParticipantReferrerQuery[]]] = await Promise.all([
    prismaFetches(cf_prisma, [fetchParticipantReferrer], { timer: true }),
    // fetchAndParseSampleList(),
  ]);

  // matchParticipantSamples(data, samples);

  console.time('parse referrer stats');
  const referrers = parseParticipantReferrerStats(data);
  console.timeEnd('parse referrer stats');

  console.time('save to xlsx');
  saveReferrerRankingsToXLSX(referrers, data);
  console.timeEnd('save to xlsx');

  console.log('\ntotal no. of participants: ', data.length);
  console.log('total count of unique referrer names: ', referrers.size);
}

if (require.main === module) {
  main();
}
