import {
  Patient,
  Specimen,
  ReferringNonUser,
  ReferringUser,
  User,
} from '../../prisma/generated/cf_client';

export type ReferrersMap = Map<
  string,
  {
    referrerName: string;
    userId?: string;
    pc: Set<string>;
    total: number;
    totalIsUser: number;
    totalSampled?: number;
  }
>;

export type ParticipantReferrerQuery = Patient & {
  referringNonUsers: ReferringNonUser[];
  referringUsers: (ReferringUser & {
    user: User;
  })[];
};

export type ParticipantReferrerSpecimens = ParticipantReferrerQuery & {
  hasSequencedSamples: 0 | 1;
  specimens: (Specimen & { isSequenced: 0 | 1; sampleFileKey: string })[];
};

export type SampledDataMap = Map<string, string>;
