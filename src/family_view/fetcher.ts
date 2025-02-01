import { PrismaClient } from "../../prisma/generated/cf_client";

export function fetchParticipants(prisma: PrismaClient) {
  const participants = prisma.patient.findMany({
    where: {
      workspacePatient: {
        workspace: {
          name: {
            notIn: ["SB", "BC"],
          },
        },
      },
    },
    orderBy: {
      hkgi_id: "desc",
    },
    // include: {
    //   relationshipsAsPatient: {
    //     include: {
    //       relative: true,
    //     },
    //   },
    // },
  });

  return participants;
}

export function fetchRelationships(prisma: PrismaClient) {
  const relationships = prisma.relationship.findMany({
    where: {
      isDeleted: {
        equals: 0,
      },
      patient: {
        workspacePatient: {
          workspace: {
            name: {
              notIn: ["SB", "BC"],
            },
          },
        },
      },
    },
  });

  return relationships;
}
