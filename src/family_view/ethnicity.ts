import { format } from "date-fns";
import * as XLSX from "xlsx";

import { prismaFetches } from "../common/prismaFetches";
import { saveSheetsToXLSX } from "../common/saveToXLSX";
import { parseFamilies, verifyFamilies } from "./parser";
import { fetchRelationships } from "./fetcher";
import { FamilyMap, Participant, Relationships } from "./types";

import {
  Prisma,
  PrismaClient as CF_PrismaClient,
  PrismaClient,
} from "../../prisma/generated/cf_client";

const cf_prisma = new CF_PrismaClient();

function fetchParticipants(prisma: PrismaClient) {
  return prisma.patient.findMany({
    where: {
      workspacePatient: {
        workspace: {
          name: {
            notIn: ["BC", "SB"],
          },
        },
      },
    },
    orderBy: {
      hkgi_id: "desc",
    },
  });
}

function dataToWorksheet(families: FamilyMap) {
  const header = [
    "Family No.",
    "HKGI ID",
    "PC ID",
    "Refer Hospital",
    "Status",
    "Is Proband",
    "Father Ethnicity",
    "Father Province",
    "Father Others",
    "Mother Ethnicity",
    "Mother Province",
    "Mother Others",
    "Cross Ethnicity?",
    "Analysis Types",
    "is relative of",
  ];

  const rows: (string | number)[][] = [];

  let familyNo = 1;

  // print families sorted by familyID
  Array.from(families.keys())
    .sort((a, b) => a.localeCompare(b))
    .forEach((familyID) => {
      const family = families.get(familyID);
      if (!family) return;

      const { participants, relationships } = family;

      // print participants sorted by HKGI ID
      participants
        .sort((a, b) => a.hkgi_id.localeCompare(b.hkgi_id))
        .forEach((participant) => {
          const {
            id,
            hkgi_id,
            pc_id,
            referHospital,
            status,
            isProband,
            fatherEthnicity,
            fatherProvince,
            fatherOthers,
            motherEthnicity,
            motherProvince,
            motherOthers,
            analysisTypes,
          } = participant;

          const info = [
            familyNo,
            hkgi_id,
            pc_id,
            referHospital ?? "",
            status,
            isProband ?? "",
            fatherEthnicity ?? "",
            fatherProvince ?? "",
            fatherOthers ?? "",
            motherEthnicity ?? "",
            motherProvince ?? "",
            motherOthers ?? "",
            fatherEthnicity !== motherEthnicity ? 1 : 0,
            analysisTypes ? (analysisTypes as Prisma.JsonArray).join(", ") : "",
          ];

          // const relatives: string[] = [];
          const relatives: string[] = relationships.reduce(
            (acc: string[], { patient_id, is_a, relative_id }): string[] => {
              if (id !== patient_id) return acc;

              const relative = participants.find(
                ({ id }) => id === relative_id
              );

              return acc.concat(`${is_a} ${relative?.pc_id}`);
            },
            []
          );

          // relationships.forEach(({ patient_id, is_a, relative_id }) => {
          //   if (patient_id === id) {
          //     const relative = participants.find(
          //       (p) => p.id === relative_id
          //     )?.pc_id;
          //     relatives.push(`${is_a} ${relative}`);
          //   }
          // });

          rows.push([...info, relatives.join(", ")]);
        });

      familyNo++;
    });

  const worksheet = XLSX.utils.aoa_to_sheet([header]);
  XLSX.utils.sheet_add_aoa(worksheet, rows, { origin: "A2", cellDates: true });

  return worksheet;
}

async function main() {
  console.time("fetch from DB");
  const [participantData, relationshipData]: [Participant[], Relationships[]] =
    await prismaFetches(cf_prisma, [fetchParticipants, fetchRelationships]);
  console.timeEnd("fetch from DB");

  console.time("parse families");
  const families = parseFamilies(participantData, relationshipData);
  verifyFamilies(participantData, relationshipData, families);
  console.timeEnd("parse families");

  console.time("save to xlsx");
  const fileName = `${__dirname}/output/${format(
    new Date(),
    "yyMMdd"
  )}_families_ethnicity.xlsx`;

  saveSheetsToXLSX([["families", dataToWorksheet(families)]], fileName);
  console.timeEnd("save to xlsx");

  console.log();
  console.log(`output saved to ${fileName}`);
}

main();
