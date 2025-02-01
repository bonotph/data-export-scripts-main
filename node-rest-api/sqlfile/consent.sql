SELECT
	from_unixtime(p.create_at) AS "Profile Created At",
	p.hkgi_id AS "HKGI ID",
	p.pc_id AS "PC ID", 
    wp.name AS "Refer Hospital", 
    p.recruitmentSite AS "Recruitment Site",
    p.status AS "Status", 
    p.isProband AS "Is Proband", 
    p.visitDate AS "Date of Visit", 
    p.birthDate AS "Date of Birth", 
    p.isDeceased AS "Is Deceased",
    p.deceasedDate AS "Date of Death",
    timestampdiff(YEAR, p.birthDate, coalesce(p.deceasedDate, curdate())) AS "Current Age (years)",
    p.enrollmentDate AS "Date of Enrollment",
    timestampdiff(YEAR, p.birthDate, p.enrollmentDate) AS "Enrollment Age (years)",
    Date(c.hkgpStaff->>"$.date") AS "Date of signing consent",
    c.type AS "Type of Consent signed", 
    IF(isnull(c.checkeds->>"$.resultAdditionalFindings"), NULL,
		IF(c.checkeds->>"$.resultAdditionalFindings" = "true", 1, 0)) AS "Additional Finding", 
	IF(isnull(c.checkeds->>"$.contactInfoFutureUsage"), NULL,
	IF(c.checkeds->>"$.contactInfoFutureUsage" = "true", 1, 0)) AS "Further Research"
FROM patient_view_2 AS p

-- get the referhospital by workspace 
LEFT JOIN (
	SELECT 
		inner_wp.patient_id,
        inner_w.name 
    FROM workspace_patient_view AS inner_wp
    LEFT JOIN workspace_view AS inner_w ON inner_wp.workspace_id = inner_w.id
) AS wp ON p.id = wp.patient_id

-- get the consent data 
LEFT JOIN (
	SELECT inner_c.* FROM consent_view AS inner_c
	LEFT JOIN file_view AS inner_f ON inner_c.file_id = inner_f.id
	WHERE 
		inner_f.is_deleted = 0 AND
        inner_f.type = "Consent Form"
) AS c ON p.id = c.patient_id
WHERE
	-- update PC as needed
	wp.name IN ('QMH', 'PWH', 'HKCH', 'HKW', 'NTE')
    AND p.create_at < UNIX_TIMESTAMP(?) 
ORDER BY p.hkgi_id DESC
;