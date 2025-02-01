SELECT
	from_unixtime(p.create_at) AS "Profile Create At",
	p.hkgi_id AS "HKGI ID",
    p.pc_id AS "PC ID",
    wp.name AS "Refer Hospital",
    p.recruitmentSite AS "Recruitment Site",
    p.status AS "Status",
    p.visitDate AS "Date of Visit",
    p.isProband AS "Is Proband",
    IF(ISNULL(h.patient_id), 0, 1) AS "Has HPO",
    IF(ISNULL(c.patient_id), 0, 1) AS "Has Cancer",
    IF(ISNULL(f.patient_id), 0, 1) AS "Has Pedigree"
FROM analytic.patient_view AS p

-- get the referhospital by workspace 
LEFT JOIN (
	SELECT 
		inner_wp.patient_id,
        inner_w.name 
    FROM analytic.workspace_patient_view AS inner_wp
    LEFT JOIN analytic.workspace_view AS inner_w ON inner_wp.workspace_id = inner_w.id
) AS wp ON p.id = wp.patient_id

-- get the hpo info
LEFT JOIN (
	SELECT DISTINCT inner_h.patient_id FROM analytic.patient_hpo_view_view AS inner_h WHERE json_length(inner_h.hpo) > 0
) AS h ON p.id = h.patient_id

-- get the cancer info
LEFT JOIN (
	SELECT DISTINCT inner_c.patient_id FROM analytic.cancer_detail_view AS inner_c WHERE inner_c.isDeleted = 0
) AS c ON p.id = c.patient_id

-- get the pedigree info
LEFT JOIN (
	SELECT DISTINCT inner_f.patient_id
    FROM analytic.file_view AS inner_f 
    WHERE 
		inner_f.is_deleted = 0 AND 
        inner_f.type = "Pedigree"
) AS f ON p.id = f.patient_id

WHERE
	-- update PC as needed
	wp.name IN ('QMH', 'PWH', 'HKCH', 'HKW', 'NTE')
    AND p.create_at < UNIX_TIMESTAMP(?)
ORDER BY p.hkgi_id DESC
;
