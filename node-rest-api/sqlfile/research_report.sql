
-- update the end date as needed 


SELECT
	P.hkgi_id,
    P.pc_id,
    P.referHospital,
    P.isProband,
    P.healthStatus,
    from_unixtime(F.create_at),
    from_unixtime(F.update_at),
    F.type,
    F.description,
    U.displayName AS 'uploader'
FROM patient_view_2 P
INNER JOIN file_view_2 F ON P.id = F.patient_id
INNER JOIN user_view_2 U ON F.user_id = U.id
WHERE F.is_deleted = 0
	AND F.type = 'Research Report'
    AND P.referHospital IN ('QMH', 'PWH', 'HKCH', 'HKW', 'NTE')
	AND P.create_at < UNIX_TIMESTAMP(?)
ORDER BY P.create_at DESC
;