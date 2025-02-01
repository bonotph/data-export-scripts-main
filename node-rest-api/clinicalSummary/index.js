import { PrismaClient } from "../prisma/generated/cf_client/index.js"
import { saveAoaToXLSX } from "../common/saveToXLSX.js"

const prismaClient = new PrismaClient()

const CF_PC = ["HKCH", "PWH", "QMH", "HKW", "NTE"]

// fetch list of participants from CF MySQL
async function fetchParticipants(filedate) {
  const fileDateObj = new Date(filedate);
  const fileDateTimestamp = Math.floor(fileDateObj.getTime() / 1000);
  const dbResult = await prismaClient.patient.findMany({
    include: {
      hpoTerms: {
        select: {
          hpo: true
        }
      },
      cancer: {
        select: {
          clinicalSummary: true
        }
      },
      undiagnosed: {
        select: {
          clinicalSummary: true
        }
      }
    },
    where: {
      workspacePatient: {
        workspace: {
          name: {
            in: CF_PC
          }
        }
      },
      create_at: {
        lt: fileDateTimestamp
      },
    },

    orderBy: {
      create_at: "desc"
    }
  })

  return dbResult.map(({ create_at, ...rest }) => {
    return {
      ...rest,
      create_at: new Date(create_at * 1000)

    }
  })
}

// parse the result into array of array to save as xlsx
function parseResultToAoa(data) {
  const result = data.map(
    ({
      create_at,
      hkgi_id,
      pc_id,
      isProband,
      referHospital,
      healthStatus,
      sex,
      status,
      cancer,
      undiagnosed
    }) => {
      return [
        create_at,
        hkgi_id,
        pc_id,
        referHospital,
        status,
        sex ? sex : "NULL",
        healthStatus ? healthStatus : "NULL",
        isProband ? isProband : "NULL",
        undiagnosed?.clinicalSummary ? undiagnosed.clinicalSummary : "NULL",
        cancer?.clinicalSummary ? cancer.clinicalSummary : "NULL"
      ]
    }
  )

  result.unshift([
    "Profile Created At",
    "HKGI ID",
    "PC ID",
    "Refer Hospital",
    "Status",
    "Sex",
    "Health Status",
    "Is Proband",
    "Undiagnosed Clinical Summary",
    "Cancer Clinical Summary"
  ])

  return result
}

// main function
export async function main(filedate) {
  const participants = await fetchParticipants(filedate)
  const aoaResult = parseResultToAoa(participants);
  const XLSXString = saveAoaToXLSX([{data: aoaResult},]);
  return XLSXString;

}

