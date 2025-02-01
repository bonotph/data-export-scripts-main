import { FamilyMap } from "../family_view/types";

export function filterFamilyByHPO(families: FamilyMap, targetTerms: string[]) {
  const filtered: FamilyMap = new Map();

  families.forEach((families, familyID) => {
    if (
      families.participants.some((participant) => {
        if (!participant.hpoTerms) return false;

        return (
          participant.hpoTerms.hpo.filter((hpo) => targetTerms.includes(hpo))
            .length > 0
        );
      })
    ) {
      filtered.set(familyID, families);
    }
  });

  return filtered;
}
