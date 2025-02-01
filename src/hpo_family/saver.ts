import { differenceInYears } from "date-fns";
import { saveAoaToXLSX } from "../common/saveToXLSX";
import { FamilyMap } from "../family_view/types";

export function saveToXLSX(families: FamilyMap, fileName: string) {
  const header = [
    "Family No.",
    "HKGI ID",
    "PC ID",
    "Refer Hospital",
    "Recruitment Site",
    "Status",
    "Is Proband",
    "Date of Birth",
    "Age (calculated)",
    "Referring Clinicians",
    "HP:0000717",
    "HP:0000729",
    "is relative of",
  ];

  const rows: (string | number | Date)[][] = [];
  rows.push(header);

  let familyNo = 1;

  Array.from(families.keys())
    .sort((a, b) => b.localeCompare(a))
    .forEach((familyID) => {
      const family = families.get(familyID);
      if (!family) return;

      const { participants, relationships } = family;

      participants
        .sort((a, b) => b.hkgi_id.localeCompare(a.hkgi_id))
        .forEach((participant) => {
          const {
            id,
            hkgi_id,
            pc_id,
            referHospital,
            recruitmentSite,
            status,
            isProband,
            birthDate,
            hpoTerms,
            referringNonUsers,
            referringUsers,
          } = participant;

          const info = [
            familyNo,
            hkgi_id,
            pc_id,
            referHospital ?? "",
            recruitmentSite ?? "",
            status,
            isProband ?? "",
            birthDate ?? "",
            birthDate ? differenceInYears(new Date(), birthDate) : "",
            [
              referringNonUsers.map((nonUser) => nonUser.referrer).join(", "),
              referringUsers.map((user) => user.user.displayName).join(", "),
            ]
              .filter((item) => !!item)
              .join(", "),
            hpoTerms && hpoTerms.hpo.includes("HP:0000717") ? 1 : 0,
            hpoTerms && hpoTerms.hpo.includes("HP:0000729") ? 1 : 0,
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

  saveAoaToXLSX([{ data: rows, sheetOpts: { cellDates: true } }], fileName);
}
