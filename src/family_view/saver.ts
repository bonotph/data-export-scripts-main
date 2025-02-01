import { saveAoaToXLSX } from "../common/saveToXLSX";
import { FamilyMap } from "./types";

export function saveFamiliesToXLSX(families: FamilyMap, fileName: string) {
  saveAoaToXLSX(
    [
      {
        data: saveFamilies(families),
        sheetOpts: {
          cellDates: true,
        },
      },
    ],
    fileName
  );
}

/**
 * save the parsed families into XLSX
 * @param families
 */
function saveFamilies(families: FamilyMap) {
  const header = [
    "Family No.",
    "HKGI ID",
    "PC ID",
    "Status",
    "Is Proband",
    "Analysis Types",
    "is relative of",
  ];

  const rows: (string | number)[][] = [];
  rows.push(header);

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
          const { id, hkgi_id, pc_id, status, isProband, analysisTypes } =
            participant;

          const info = [
            familyNo,
            hkgi_id,
            pc_id,
            status,
            isProband ?? "",
            analysisTypes ? analysisTypes.toString() : "",
          ];

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

          rows.push([...info, relatives.join(", ")]);
        });

      familyNo++;
    });

  return rows;
}
