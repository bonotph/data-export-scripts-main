import { format } from "date-fns";

import { prismaFetches } from "../common/prismaFetches";
import { parseFamilies, verifyFamilies } from "../family_view/parser";
import { fetchRelationships } from "../family_view/fetcher";
import { Participant, Relationships } from "../family_view/types";
import { fetchParticipants } from "./fetcher";
import { filterFamilyByHPO } from "./parser";
import { saveToXLSX } from "./saver";

import { PrismaClient as CF_PrismaClient } from "../../prisma/generated/cf_client";

const cf_prisma = new CF_PrismaClient();

async function main() {
  console.time("fetch from DB");
  const [participantData, relationshipData]: [Participant[], Relationships[]] =
    await prismaFetches(cf_prisma, [fetchParticipants, fetchRelationships]);
  console.timeEnd("fetch from DB");

  console.time("parse families");
  const families = parseFamilies(participantData, relationshipData);
  verifyFamilies(participantData, relationshipData, families);
  console.timeEnd("parse families");

  console.time("filter families");
  const filteredFamilies = filterFamilyByHPO(families, [
    "HP:0000717",
    "HP:0000729",
  ]);
  console.timeEnd("filter families");

  console.time("save to xlsx");
  saveToXLSX(
    filteredFamilies,
    `${__dirname}/output/${format(new Date(), "yyMMdd")}_autism_families.xlsx`
  );
  console.timeEnd("save to xlsx");
}

if (require.main === module) {
  main();
}
