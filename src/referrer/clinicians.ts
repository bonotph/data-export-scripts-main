// import ALIASES from "./aliases";
import { ParticipantReferrerQuery, ReferrersMap } from "./types";

/**
 * Parse the participants data to get the referrers rankings
 * @param participants
 * @returns ReferrersMap
 */
export function parseParticipantReferrerStats(
  participants: ParticipantReferrerQuery[]
): ReferrersMap {
  const result: ReferrersMap = new Map();

  result.set("(blank)", {
    referrerName: "(blank)",
    pc: new Set(),
    total: 0,
    totalIsUser: 0,
  });

  const blankReferrer = result.get("(blank)");

  participants.forEach((participant) => {
    const { referringUsers, referringNonUsers, referHospital } = participant;

    referringUsers.forEach((user) => {
      const {
        user: { id, displayName },
      } = user;

      const referrerName = displayName.trim();

      const referrer = result.get(referrerName);

      if (!referrer) {
        result.set(referrerName, {
          referrerName: referrerName,
          userId: id,
          pc: new Set([referHospital as string]),
          total: 1,
          totalIsUser: 1,
        });
      } else {
        referrer.pc.add(referHospital as string);
        // if record has no userId, i.e. created from non user first, with the same name as user
        if (!referrer.userId) {
          referrer.userId = id;
        }
        referrer.total++;
        referrer.totalIsUser++;
      }
    });

    referringNonUsers.forEach((nonUser) => {
      const { referrer: displayName } = nonUser;

      const referrerName = displayName.trim();

      const referrer = result.get(referrerName);

      if (!referrer) {
        result.set(referrerName, {
          referrerName: referrerName,
          pc: new Set([referHospital as string]),
          total: 1,
          totalIsUser: 0,
        });
      } else {
        referrer.pc.add(referHospital as string);
        referrer.total++;
      }
    });

    if (blankReferrer && !referringUsers.length && !referringNonUsers.length) {
      blankReferrer.pc.add(referHospital as string);
      blankReferrer.total++;
    }
  });

  return result;
}
