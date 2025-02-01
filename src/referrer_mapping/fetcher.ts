import { PrismaClient } from '../../prisma/generated/cf_client';

export function fetchParticipantReferrer(prisma: PrismaClient) {
  return prisma.patient.findMany({
    select: {
      hkgi_id: true,
      pc_id: true,
      create_at: true,
      referringUsers: {
        select: {
          user: {
            select: {
              displayName: true,
            },
          },
          type: true,
        },
      },
      referringNonUsers: {
        select: {
          referrer: true,
          type: true,
          create_at: true,
          update_at: true,
        },
        where: {
          isDeleted: {
            equals: 0,
          },
        },
      },
    },
    where: {
      workspacePatient: {
        workspace: {
          name: {
            notIn: ['SB', 'BC'],
          },
        },
      },
    },
    orderBy: {
      hkgi_id: 'desc',
    },
  });
}
