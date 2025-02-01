import {
  Patient,
  ReferringNonUser,
  ReferringUser,
  Relationship,
  User,
} from '../../prisma/generated/cf_client';

export type Participant = Patient & {
  familyID?: string;
  hpoTerms?: { hpo: string[] };
  cancer?: { clinicalSummary: string };
  undiagnosed?: { clinicalSummary: string };
  referringUsers?: (ReferringUser & { user: User })[];
  referringNonUsers?: ReferringNonUser[];
};

export type ParticipantMap = Map<string, Participant>;

export type Relationships = Relationship;

export type RelationShipMap = Map<string, Relationship[]>;

/**
 * key: familyID, value: Family: Participant [ ], RelationShip [ ]
 */
export type FamilyMap = Map<string, Family>;

export interface Family {
  participants: Participant[];
  relationships: Relationship[];
}
