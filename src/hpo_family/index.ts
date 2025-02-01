import { format } from 'date-fns';
import { PrismaClient } from '../../prisma/generated/cf_client';
import { saveAoaToXLSX } from '../common/saveToXLSX';
import { parseFamilies } from '../family_view/parser';
import HPO_MAP from './hpoMap.json';

const prismaClient = new PrismaClient();

const CF_PC = ['HKCH', 'PWH', 'QMH', 'HKW', 'NTE'];

// fetch participant list from CF MySQL
async function fetchParticipants() {
  const dbResult = await prismaClient.patient.findMany({
    include: {
      hpoTerms: {
        select: {
          hpo: true,
        },
      },
    },
    where: {
      workspacePatient: {
        workspace: {
          name: {
            in: CF_PC,
          },
        },
      },
    },
    orderBy: {
      hkgi_id: 'asc',
    },
  });

  return dbResult;
}

// fetch relationship list from CF MySQL
function fetchRelationships() {
  return prismaClient.relationship.findMany({
    where: {
      isDeleted: 0,
      patient: {
        workspacePatient: {
          workspace: {
            name: {
              in: CF_PC,
            },
          },
        },
      },
    },
  });
}

// parse the family map into AOA for saving as xlsx
function parseFamilyMapToAoa(data: ReturnType<typeof parseFamilies>) {
  const result: (string | number | undefined | null)[][] = [];
  Array.from(data.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([, { participants, relationships }]) => {
      let probands = participants.filter(({ isProband }) => isProband === 1);

      let familyProbandId: string;
      if (probands.length < 1) {
        familyProbandId = participants.sort((a, b) =>
          a.hkgi_id.localeCompare(b.hkgi_id),
        )[0].hkgi_id;
      } else {
        familyProbandId = probands.sort((a, b) =>
          a.hkgi_id.localeCompare(b.hkgi_id),
        )[0].hkgi_id;
      }

      result.push(
        ...participants.map(
          ({
            id,
            hkgi_id,
            pc_id,
            isProband,
            healthStatus,
            sex,
            hpoTerms,
            status,
          }) => {
            const relatives = relationships.reduce<string[]>(
              (acc, { patient_id, is_a, relative_id }) => {
                if (id !== patient_id) return acc;

                const relative = participants.find(
                  ({ id }) => id === relative_id,
                );

                return acc.concat(`${is_a} ${relative?.hkgi_id}`);
              },
              [],
            );

            return [
              familyProbandId,
              hkgi_id,
              pc_id,
              hpoTerms?.hpo.join(', '),
              hpoTerms?.hpo
                // @ts-ignore
                .map((hpoId) => `${HPO_MAP[hpoId]} (${hpoId})`)
                .join(', '),
              status,
              sex,
              healthStatus,
              isProband,
              relatives.join(', '),
              relationships
                .filter(
                  ({ relative_id, is_a }) =>
                    relative_id === id && is_a === 'mother of',
                )
                .map(({ patient_id }) => {
                  return participants.find(({ id }) => id === patient_id)
                    ?.hkgi_id;
                })
                .join(', '),
              relationships
                .filter(
                  ({ relative_id, is_a }) =>
                    relative_id === id && is_a === 'father of',
                )
                .map(({ patient_id }) => {
                  return participants.find(({ id }) => id === patient_id)
                    ?.hkgi_id;
                })
                .join(', '),
            ];
          },
        ),
      );
    });

  result.unshift([
    'Smallest Proband ID',
    'HKGI ID',
    'PC ID',
    'HPO terms ID',
    'HPO terms ID and annotation',
    'Status',
    'Sex',
    'Health Status',
    'Is Proband',
    'Relationships',
    'Mother HKGI ID',
    'Father HKGI ID',
  ]);

  return result;
}

// main function
async function main() {
  const participants = await fetchParticipants();
  const relationships = await fetchRelationships();

  // @ts-ignore
  const familyMap = parseFamilies(participants, relationships);

  saveAoaToXLSX(
    [
      {
        data: parseFamilyMapToAoa(familyMap),
      },
    ],
    `${__dirname}/output/${format(new Date(), 'yyMMdd_HHmmss')}_familyHPO.xlsx`,
  );
}

if (require.main === module) {
  main();
}
