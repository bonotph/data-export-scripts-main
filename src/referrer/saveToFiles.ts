import { format } from 'date-fns';
import * as XLSX from 'xlsx';

import { saveSheetsToXLSX } from '../common/saveToXLSX';
import { ReferrersMap, ParticipantReferrerQuery } from './types';

/**
 * save the referrers' rankings, participants' referrers in
 * a xlsx file with two sheets
 * @param referrers
 * @param participants
 */
export function saveReferrerRankingsToXLSX(
  referrers: ReferrersMap,
  participants: ParticipantReferrerQuery[],
): void {
  saveSheetsToXLSX(
    [
      ['referrer ranking', saveReferrerRanking(referrers)],
      ['entries', saveParticipantReferrers(participants)],
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyMMdd_HHmmss',
    )}_referrers_stats.xlsx`,
  );
}

/**
 * save the referrers' rankings
 * @param referrers: ReferrersMap
 * @returns XLSX.Worksheet
 */
function saveReferrerRanking(referrers: ReferrersMap): XLSX.WorkSheet {
  const header = [
    'user_id',
    'Referrer Name',
    'PC',
    'Total Count',
    'Total Is User',
  ];

  // sort referrers by the count, sort by name if count is same
  const sortedReferrers = Array.from(referrers.keys()).sort((a, b) => {
    const countDiff =
      (referrers.get(b) as any).total - (referrers.get(a) as any).total;
    return countDiff !== 0 ? countDiff : a.localeCompare(b);
  });

  const rows: string[][] = sortedReferrers.map((name) => {
    const referrer = referrers.get(name);
    if (!referrer) return [];

    const { referrerName, userId, pc, total, totalIsUser } = referrer;

    return [
      userId as string,
      referrerName,
      Array.from(pc).join(', '),
      total.toString(),
      totalIsUser.toString(),
    ];
  });

  // insert header and content into worksheet
  const worksheet = XLSX.utils.aoa_to_sheet([header]);
  XLSX.utils.sheet_add_aoa(worksheet, rows, { origin: 'A2' });

  return worksheet;
}

/**
 * saves the participant's referrers
 * @param participants: ParticipantReferrerQuery[]
 * @returns XLSX.Worksheet
 */
function saveParticipantReferrers(
  participants: ParticipantReferrerQuery[],
): XLSX.WorkSheet {
  const header = [
    'participant_id',
    'HKGI ID',
    'PC ID',
    'Refer Hospital',
    'Status',
    'Referrer Name',
    'Referrer Type',
    'Is User',
    'user_id',
    'Referrer Created At',
    'Referrer Last Updated At',
  ];

  const rows = participants.reduce((acc: (string | null)[][], participant) => {
    const {
      id,
      hkgi_id,
      pc_id,
      referHospital,
      status,
      referringUsers,
      referringNonUsers,
    } = participant;

    const info = [id, hkgi_id, pc_id, referHospital, status];
    const result: (string | null)[][] = [];

    referringUsers.forEach(
      ({ user: { id, displayName }, create_at, type, update_at }) => {
        result.push([
          ...info,
          displayName,
          type,
          '1',
          id,
          format(new Date(create_at * 1000), 'yyyy-MM-dd hh:mm:ss'),
          format(new Date(update_at * 1000), 'yyyy-MM-dd hh:mm:ss'),
        ]);
      },
    );

    referringNonUsers.forEach(({ referrer, type, create_at, update_at }) => {
      result.push([
        ...(info as string[]),
        referrer,
        type,
        '0',
        '',
        format(new Date(create_at * 1000), 'yyyy-MM-dd hh:mm:ss'),
        format(new Date(update_at * 1000), 'yyyy-MM-dd hh:mm:ss'),
      ]);
    });

    if (referringUsers.length === 0 && referringNonUsers.length === 0) {
      result.push(info);
    }

    acc.push(...result);
    return acc;
  }, []);

  // insert header and content into worksheet
  const worksheet = XLSX.utils.aoa_to_sheet([header]);
  XLSX.utils.sheet_add_aoa(worksheet, rows, { origin: 'A2' });

  return worksheet;
}
