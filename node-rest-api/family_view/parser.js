import assert from "node:assert/strict"

export function parseFamilies(participants, relationships) {
  return parseFamilyMap(
    parseParticipantMap(participants),
    parseRelationshipMap(relationships)
  )
}

/**
 * convert the participant array into a map,
 * the key will be the id, and value will be the
 * data for that participant
 * @param rawData
 * @returns
 */
// convert the array data into a map => database_id: { participant_data }
function parseParticipantMap(rawData) {
  const participants = new Map()

  rawData.forEach(participant => {
    participants.set(participant.id, participant)
  })

  assert(
    rawData.length === participants.size,
    "parsed participants and raw data length not match"
  )

  return participants
}

/**
 * convert the relationship array into a map,
 * the key will be the patient_id, and value will be an array
 * of relationships for that patient_id
 * @param rawData
 * @returns RelationshipMap
 */
function parseRelationshipMap(rawData) {
  const relationships = new Map()

  rawData.forEach(relationship => {
    const current = relationships.get(relationship.patient_id)

    if (!current) {
      relationships.set(relationship.patient_id, [relationship])
    } else {
      current.push(relationship)
    }
  })

  return relationships
}

/**
 * create the family map based on the participants and relationships
 * @param participants
 * @param relationships
 * @returns FamilyMap
 */
function parseFamilyMap(participants, relationships) {
  const families = new Map()

  participants.forEach(participant => {
    const { id: p_id, hkgi_id: p_hkgi_id } = participant

    let p_familyID = participant.familyID

    // create empty family and assign family ID if participant has no family
    if (!p_familyID) {
      p_familyID = p_hkgi_id
      participant.familyID = p_familyID

      families.set(p_familyID, {
        participants: [participant],
        relationships: []
      })
    }

    let currentFamily = families.get(p_familyID)

    const p_relationships = relationships.get(p_id)

    // skips if no relationships
    if (!p_relationships?.length) return

    // goes thru the participant's relationships to find relatives
    p_relationships.forEach(relationship => {
      const { relative_id } = relationship

      const relative = participants.get(relative_id)

      const { familyID: r_familyID } = relative
      currentFamily.relationships.push(relationship)

      // if relative has no assigned family,
      // add them into the this family
      if (!r_familyID) {
        relative.familyID = p_familyID

        currentFamily.participants.push(relative)
      } else if (p_familyID !== r_familyID) {
        // merge two families, if the family id is different
        const mergedFamily = mergeFamilies(
          p_familyID,
          r_familyID,
          families,
          participants
        )

        // update local variables after merging
        p_familyID = mergedFamily.largeFamilyID
        currentFamily = mergedFamily.largeFamily
      }
    })
  })

  return families
}

/**
 * merge two families together, keep p_familyID or the larger family
 * @param p_familyID
 * @param r_familyID
 * @param families
 * @param participants
 * @returns
 */
function mergeFamilies(p_familyID, r_familyID, families, participants) {
  const p_family = families.get(p_familyID)
  const r_family = families.get(r_familyID)

  const largeFamily =
    p_family.participants
      .sort((a, b) => a.hkgi_id.localeCompare(b.hkgi_id))[0]
      .hkgi_id.localeCompare(
        r_family.participants.sort((a, b) =>
          a.hkgi_id.localeCompare(b.hkgi_id)
        )[0].hkgi_id
      ) <= 0
      ? p_family
      : r_family

  const smallFamily = largeFamily === p_family ? r_family : p_family

  const largeFamilyID = largeFamily === p_family ? p_familyID : r_familyID
  const smallFamilyID = largeFamilyID === p_familyID ? r_familyID : p_familyID

  largeFamily.participants.push(...smallFamily.participants)
  largeFamily.relationships.push(...smallFamily.relationships)

  // update the familyID for each participants inside the smallFamily
  smallFamily.participants.forEach(({ id }) => {
    participants.get(id).familyID = largeFamilyID
  })

  families.delete(smallFamilyID)

  return { largeFamilyID, largeFamily }
}

/**
 * verify the parsed families
 * 1. no duplicates
 * 2. total count matches with raw data
 * @param participantData
 * @param relationshipData
 * @param families
 */
export function verifyFamilies(participantData, relationshipData, families) {
  const participantsInFamilies = new Set()
  const relationshipsInFamilies = new Set()

  // no duplicate participant / relationship
  families.forEach(({ participants, relationships }) => {
    participants.forEach(({ hkgi_id }) => {
      assert(!participantsInFamilies.has(hkgi_id))
      participantsInFamilies.add(hkgi_id)
    })

    relationships.forEach(({ id }) => {
      assert(!relationshipsInFamilies.has(id))
      relationshipsInFamilies.add(id)
    })
  })

  // total no. of participant / relationship matches
  assert(participantsInFamilies.size === participantData.length)
  assert(relationshipsInFamilies.size === relationshipData.length)
}
