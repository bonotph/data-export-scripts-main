import { PrismaClient } from "../../prisma/generated/cf_client";

export function fetchParticipants(prisma: PrismaClient) {
  return prisma.patient.findMany({
    include: {
      hpoTerms: {
        select: {
          hpo: true,
        },
      },
      referringUsers: {
        where: {
          isDeleted: {
            equals: 0,
          },
        },
        select: {
          create_at: true,
          update_at: true,
          type: true,
          user: {
            select: {
              displayName: true,
            },
          },
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
            notIn: ["BC", "SB"],
          },
        },
      },
    },
    orderBy: {
      hkgi_id: "desc",
    },
  });
}
