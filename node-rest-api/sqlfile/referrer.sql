SELECT 
	from_unixtime(p.create_at) AS "Profile Create At",
	p.hkgi_id AS "HKGI ID", 
    p.pc_id AS "PC ID", 
    wp.name AS "Refer Hospital", 
    p.recruitmentSite AS "Recruitment Site",
    p.status AS "Status", 
    p.isProband AS "Is Proband",
    p.referDepartment AS "Refer Department", 
    p.referDivision AS "Refer Division", 
    referDisplayName AS "Referrer Name", 
    r.type AS "Referrer Type", 
    r.isUser AS "Referrer Is User",
    r.create_at AS "Referral Create At"
FROM patient_view AS p

-- get the referhospital by workspace 
LEFT JOIN (
	SELECT 
		inner_wp.patient_id,
        inner_w.name 
    FROM workspace_patient_view AS inner_wp
    LEFT JOIN workspace_view AS inner_w ON inner_wp.workspace_id = inner_w.id
) AS wp ON p.id = wp.patient_id

-- get the referrer 
LEFT JOIN (
		(
			SELECT 
				from_unixtime(inner_ru.create_at) AS create_at,
				inner_ru.patient_id, 
                inner_ru.type, 
                inner_u.displayName AS referDisplayName, 
                1 AS isUser
			FROM referring_user_view AS inner_ru
            LEFT JOIN user_view AS inner_u ON inner_ru.user_id = inner_u.id
			WHERE inner_ru.isDeleted = 0
		)
        UNION
        (
			SELECT 
				from_unixtime(inner_rnu.create_at) AS create_at,
				inner_rnu.patient_id, 
                inner_rnu.type, 
                inner_rnu.referrer AS referDisplayName, 
                0 AS isUser
            FROM referring_non_user_view AS inner_rnu
            WHERE inner_rnu.isDeleted = 0
		)
	) AS r ON p.id = r.patient_id
WHERE
	-- update PC as needed
	wp.name IN ('QMH', 'PWH', 'HKCH', 'HKW', 'NTE')
 	AND p.create_at < UNIX_TIMESTAMP(?)
ORDER BY p.hkgi_id DESC
;