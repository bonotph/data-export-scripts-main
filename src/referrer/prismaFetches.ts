import { PrismaClient } from '../../prisma/generated/cf_client';

// // fetch referrers (users) and their participants, if any
// export function fetchReferringUsers() {
//   const users = prisma.user.findMany({
//     select: {
//       displayName: true,
//       referees: {
//         select: {
//           create_at: true,
//           update_at: true,
//           type: true,
//           patient: {
//             select: {
//               hkgi_id: true,
//               pc_id: true,
//               status: true,
//               isProband: true,
//               referHospital: true,
//               referDepartment: true,
//               referDivision: true,
//               create_at: true,
//             },
//           },
//         },
//         where: {
//           patient: {
//             referHospital: {
//               notIn: ["BC", "SB"],
//             },
//           },
//           isDeleted: {
//             equals: 0,
//           },
//         },
//       },
//     },
//     where: {
//       referees: {
//         some: {
//           patient: {
//             referHospital: {
//               notIn: ["BC", "SB"],
//             },
//           },
//         },
//       },
//     },
//   });

//   return users;
// }

// // fetch referrers (non-users) and their participants, if any
// export function fetchReferringNonUsers() {
//   const nonUsers = prisma.referringNonUser.findMany({
//     select: {
//       referrer: true,
//       type: true,
//       create_at: true,
//       update_at: true,
//       patient: {
//         select: {
//           hkgi_id: true,
//           pc_id: true,
//           status: true,
//           isProband: true,
//           referHospital: true,
//           referDepartment: true,
//           referDivision: true,
//           create_at: true,
//         },
//       },
//     },
//     where: {
//       isDeleted: {
//         equals: 0,
//       },
//       patient: {
//         referHospital: {
//           notIn: ["SB", "BC"],
//         },
//       },
//     },
//   });

//   return nonUsers;
// }

// fetch all participants and their referrers, if any
export function fetchParticipantReferrer(prisma: PrismaClient) {
  return prisma.patient.findMany({
    select: {
      id: true,
      hkgi_id: true,
      pc_id: true,
      status: true,
      isProband: true,
      referHospital: true,
      referDepartment: true,
      referDivision: true,
      create_at: true,
      // specimens: {
      //   select: {
      //     lab_id: true,
      //     nature: true,
      //     collectionDatetime: true,
      //     registrationDatetime: true,
      //   },
      //   where: {
      //     isDeleted: {
      //       equals: 0,
      //     },
      //   },
      // },
      referringUsers: {
        select: {
          type: true,
          user: {
            select: {
              id: true,
              displayName: true,
            },
          },
          create_at: true,
          update_at: true,
        },
        where: {
          isDeleted: {
            equals: 0,
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
