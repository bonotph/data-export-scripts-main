import os
import pdb
import subprocess
import traceback
import time

pwd = os.path.dirname(os.path.abspath(__file__))
db_folder = os.path.join(pwd, 'data/databases')
paths = {
    'ccre': os.path.join(db_folder, 'encode/encode_ccre.vcf.gz'),
    'mitotip': os.path.join(db_folder, 'mitotip/mitotip.vcf.gz'),
    'apogee': os.path.join(db_folder, 'apogee/apogee.vcf.gz'),
    'genomad_mito': os.path.join(db_folder, 'gnomad_mito/gnomad.genomes.v3.1.sites.chrM.vcf.bgz'),
    'mitomap_helix': os.path.join(db_folder, 'mitomap/mitomap_helix.vcf.gz'),
    'mitomap_fl_cr': os.path.join(db_folder, 'mitomap/mitomap_fl_cr.vcf.gz'),
}

def get_cura_variants(sample: str):
    # load list of variants from tsv file
    filename = os.path.join(cura_folder, f'{sample}.tsv')
    with open(filename, 'r') as f:
        # skip comments
        line = f.readline()
        while line[0] == '#':
            line = f.readline()
        # read headers
        headers = line.strip('\n').split('\t')
        # read variants
        variants = []
        for line in f.readlines():
            if line.strip():
                line = line.strip('\n').split('\t')
                variant = dict(zip(headers, line))
                variants.append(variant)

    return variants

def toNumber(numString, digit: int = 6):
    try:
        return f'%.{digit}g'%float(numString)
    except ValueError:
        return numString

def popen(cmd: str):
    out = subprocess.check_output(cmd, shell=True, executable="/bin/bash")
    out = out.decode('utf8').strip()
    out = out.split('\n') if out else []
    return out

def test_ccre(cura_variant):
    cv = cura_variant
    ref_path = paths['ccre']
    hgvsc = cv['hgvsc']

    ccre_info = {
        'ccre_score': toNumber(cv['encode_ccres_score']),
        'ccre_zscore': toNumber(cv['encode_ccres_zscore']),
        'name': cv['encode_ccres_name'],
        'ccre': cv['encode_ccres_ccre'],
        'encode_label': cv['encode_ccres_encode_label'],
        'ucsc_label': cv['encode_ccres_ucsc_label'],
        'accession_label': cv['encode_ccres_accession_label'],
        'description': cv['encode_ccres_description']
    }
    no_data = all([not ccre_info[key] for key in ccre_info])

    cmd = f'bcftools query {ref_path} -r {cv["chrom"]}:{cv["start"]}-{cv["end"]} -f "%INFO\\n"'
    result = popen(cmd)
    if len(result) > 1:
        print(f"Error: multiple ccre found for {hgvsc}")
        return False
    if len(result) == 0:
        if no_data: return True
        print(f"Error: ccre not found for {hgvsc}")
        return False

    ccre_info_db = dict([ele.split('=') for ele in result[0].split(';')])
    check = True
    for key in ccre_info:
        if ccre_info[key] != toNumber(ccre_info_db[key]):
            print(f"Error: {key} mismatch for {hgvsc}: {ccre_info[key]} vs {ccre_info_db[key]}")
            check = False

    return check

def test_mitotip(cura_variant):
    cv = cura_variant
    ref_path = paths['mitotip']
    hgvsg = cv['hgvsg']
    quartile = cv['mitotip_quartile']

    cmd = f'bcftools query {ref_path} -r {cv["chrom"]}:{cv["start"]}-{cv["end"]} -f "%quartile\\n" -i "ALT=\'{cv["alt"]}\' & REF=\'{cv["ref"]}\'"'
    result = popen(cmd)
    if len(result) > 1:
        print(f"Error: multiple mitotip found for {hgvsg}")
        return False
    if len(result) == 0:
        if quartile == '': return True
        print(f"Error: mitotip not found for {hgvsg}")
        return False

    quartile_db = result[0]

    if quartile != quartile_db:
        print(f"Error: quartile mismatch for {hgvsg}: {quartile} vs {quartile_db}")
        return False
    
    print(f"MitoTIP Quartile Pass: {hgvsg} - {quartile}")
    return True

def test_apogee(cura_variant):
    cv = cura_variant
    ref_path = paths['apogee']
    hgvsg = cv['hgvsg']
    apogee = toNumber(cv['apogee_score'])

    cmd = f'bcftools query {ref_path} -r {cv["chrom"]}:{cv["start"]}-{cv["end"]} -f "%apogee2\\n" -i "ALT=\'{cv["alt"]}\' & REF=\'{cv["ref"]}\'"'
    result = popen(cmd)
    if len(result) > 1:
        print(f"Error: multiple apogee found for {hgvsg}")
        return False
    if len(result) == 0:
        if apogee == '-1': return True
        print(f"Error: apogee not found for {hgvsg}")
        return False

    apogee_db = toNumber(result[0])

    if abs(float(apogee) - float(apogee_db)) > 0.01:
        print(f"Error: apogee_score mismatch for {hgvsg}: {apogee} vs {apogee_db}")
        return False

    return True

def test_genomad_mito(cura_variant):
    cv = cura_variant
    ref_path = paths['genomad_mito']
    hgvsg = cv['hgvsg']
    af = toNumber(cv['gnomadg_mito_af'])
    af_eas = toNumber(cv['gnomadg_mito_eas_af'])

    cmd = f'bcftools query {ref_path} -r {cv["chrom"]}:{cv["start"]}-{cv["end"]} -f "%AF_hom\\t%pop_AF_hom\\n" -i "ALT=\'{cv["alt"]}\' & REF=\'{cv["ref"]}\'"'
    result = popen(cmd)
    if len(result) > 1:
        print(f"Error: multiple genomad found for {hgvsg}")
        return False
    if len(result) == 0:
        if af == '-1': return True
        print(f"Error: genomad not found for {hgvsg}")
        return False

    ele = result[0].split()
    af_db = toNumber(ele[0])
    af_eas_db = toNumber(ele[1].split('|')[4])

    check = True
    if abs(float(af) - float(af_db)) > 0.01:
        print(f"Error: genomad_af mismatch for {hgvsg}: {af} vs {af_db}")
        check = False
    if abs(float(af_eas) - float(af_eas_db)) > 0.01:
        print(f"Error: genomad_eas_af mismatch for {hgvsg}: {af_eas} vs {af_eas_db}")
        check = False

    return check

def test_mitomap_helix(cura_variant):
    cv = cura_variant
    ref_path = paths['mitomap_helix']
    hgvsg = cv['hgvsg']
    helix_afs = cv['mito_helix_af_list']
    helix_afs = [float(_) for _ in helix_afs[1:-1].split(',')] if helix_afs else []
    helix_afs.sort()

    cmd = f'bcftools query {ref_path} -r {cv["chrom"]}:{cv["start"]}-{cv["start"]} -f "%helix_af\\n" -i "ALT=\'{cv["alt"]}\' & REF=\'{cv["ref"]}\'"'
    result = popen(cmd)
    helix_afs_db = [float(_) for _ in result]
    helix_afs_db.sort()

    check = True
    if len(helix_afs) != len(helix_afs_db):
        check = False
    else:
        for i in range(len(helix_afs)):
            helix_af = helix_afs[i]
            helix_af_db = helix_afs_db[i]
            if helix_af == 0:
                check = helix_af_db == 0
            elif abs(helix_af - helix_af_db) > 0.01:
                check = False

    if not check:
        print(f"Error: helix_af mismatch for {hgvsg}: {helix_afs} vs {helix_afs_db}")

    return check

def test_mitomap_fl_cr(cura_variant):
    cv = cura_variant
    ref_path = paths['mitomap_fl_cr']
    hgvsg = cv['hgvsg']

    if cv['mito_fl_af_list'] == '':
        fl_cr_afs = []
    else:
        fl_afs = [float(_[1:-1]) for _ in cv['mito_fl_af_list'][1:-1].split(',')]
        cr_afs = [float(_[1:-1]) for _ in cv['mito_cr_af_list'][1:-1].split(',')]
        fl_cr_afs = [(fl_afs[i], cr_afs[i]) for i in range(len(fl_afs))]
        fl_cr_afs.sort()

    cmd = f'bcftools query {ref_path} -r {cv["chrom"]}:{cv["start"]}-{cv["start"]} -f "%fl_af\\t%cr_af\\n" -i "ALT=\'{cv["alt"]}\' & REF=\'{cv["ref"]}\'"'
    result = popen(cmd)
    fl_cr_afs_db = [(float(_.split()[0]), float(_.split()[1])) for _ in result]
    fl_cr_afs_db.sort()

    check = True
    if len(fl_cr_afs) != len(fl_cr_afs_db):
        check = False
    else:
        for i in range(len(fl_cr_afs)):
            fl_af, cr_af = fl_cr_afs[i]
            fl_af_db, cr_af_db = fl_cr_afs_db[i]
            if fl_af == 0:
                check = fl_af_db == 0
            elif abs(fl_af - fl_af_db) > 0.01:
                check = False
            if cr_af == 0:
                check = cr_af_db == 0
            elif abs(cr_af - cr_af_db) > 0.01:
                check = False

    if not check:
        fl_afs = [_[0] for _ in fl_cr_afs]
        cr_afs = [_[1] for _ in fl_cr_afs]
        fl_afs_db = [_[0] for _ in fl_cr_afs_db]
        cr_afs_db = [_[1] for _ in fl_cr_afs_db]
        # print(f"Error: fl_af mismatch for {hgvsg}: {fl_afs} vs {fl_afs_db}")
        # print(f"Error: cr_af mismatch for {hgvsg}: {cr_afs} vs {cr_afs_db}")

    return check

# get current path
cwd = os.path.dirname(os.path.abspath(__file__))
# cura_folder = os.path.join(cwd, 'data/cura_samples_pp')
cura_folder = os.path.join(cwd, 'data/cura_samples_pp_chrM')
input_file = os.path.join(cwd, 'input/samples.txt')

# get samples from samples.txt
samples = []
with open(input_file, 'r') as f:
    for line in f:
        if line.strip():
            samples.append(line.strip())

for sample in samples:
    print(f'{sample}: start testing')
    cura_variants = get_cura_variants(sample)

    pass_count = 0
    total_count = 0

    start_time = time.time()

    for cura_variant in cura_variants:
        test = True
        # test = test & test_ccre(cura_variant)
        # test = test & test_mitotip(cura_variant)
        # test = test & test_apogee(cura_variant)
        # test = test & test_genomad_mito(cura_variant)
        # test = test & test_mitomap_helix(cura_variant)
        test = test & test_mitomap_fl_cr(cura_variant)

        if test: pass_count += 1
        total_count += 1

        # if (total_count % 100) == 0:
        #     runtime = time.time() - start_time
        #     print(f"{sample}: {pass_count}/{total_count} pass, total: {len(cura_variants)} ({runtime:.2f}s)")

    end_time = time.time()
    runtime = end_time - start_time

    print(f"{sample}: {pass_count}/{total_count} pass, runtime: {runtime:.2f} seconds")
