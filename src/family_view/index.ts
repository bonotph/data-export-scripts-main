import { format } from "date-fns";

import { prismaFetches } from "../common/prismaFetches";
import { parseFamilies, verifyFamilies } from "./parser";
import { fetchParticipants, fetchRelationships } from "./fetcher";
import { saveFamiliesToXLSX } from "./saver";
import { Participant, Relationships } from "./types";
import { PrismaClient as CF_PrismaClient } from "../../prisma/generated/cf_client";

const cf_prisma = new CF_PrismaClient();

async function main({
  timer = false,
}: {
  timer?: boolean;
} = {}) {
  const outputFileName = `${__dirname}/output/${format(
    new Date(),
    "yyMMdd"
  )}_families.xlsx`;

  if (timer) {
    console.time("fetch data from db");
    const [participantData, relationshipData]: [
      Participant[],
      Relationships[]
    ] = await prismaFetches(cf_prisma, [fetchParticipants, fetchRelationships]);
    console.timeEnd("fetch data from db");

    console.time("parse families");
    const familyMap = parseFamilies(participantData, relationshipData);
    verifyFamilies(participantData, relationshipData, familyMap);
    console.timeEnd("parse families");

    console.time("save to XLSX");
    saveFamiliesToXLSX(familyMap, outputFileName);
    console.timeEnd("save to XLSX");
  } else {
    const [participantData, relationshipData]: [
      Participant[],
      Relationships[]
    ] = await prismaFetches(cf_prisma, [fetchParticipants, fetchRelationships]);

    const familyMap = parseFamilies(participantData, relationshipData);
    verifyFamilies(participantData, relationshipData, familyMap);

    saveFamiliesToXLSX(familyMap, outputFileName);
  }

  console.log(`\nOutput file saved to:\n${outputFileName}`);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const timer = argv.includes("-t");

  main({ timer });
}
