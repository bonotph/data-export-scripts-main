import { PrismaClient as DIG_PrismaClient } from '../../prisma/generated/dig_client';

export function fetchJobs(prisma: DIG_PrismaClient) {
  return prisma.job.findMany({
    include: {
      project: {
        select: {
          name: true,
        },
      },
    },
    where: {
      isDeleted: {
        equals: false,
      },
      project: {
        workspace: {
          name: {
            in: ['CPOS'],
          },
        },
        name: {
          startsWith: 'CPOS',
        },
      },
    },
  });
}
