import os
import pdb
import subprocess
import json
import time

clinvar_vcf_file = 'src/cura_compare/data/clinvar/clinvar_20240107.vcf.gz'
gnomad_genome_vcf_file = 'src/cura_compare/data/genomad/genome/gnomad.genomes.r2.1.1.sites.{0}.liftover_grch38.vcf.bgz'
gnomad_exome_vcf_file = 'src/cura_compare/data/genomad/exome/gnomad.exomes.r2.1.1.sites.{0}.liftover_grch38.vcf.bgz'

class allele_data:
    def __init__(self):
        self.an = 0
        self.ac = 0
        self.found = False

def combine_af(data1: allele_data, data2: allele_data):
    an = data1.an + data2.an
    ac = data1.ac + data2.ac
    found = data1.found or data2.found
    if an == 0:
        return 0 if found else -1
    else: return ac / an

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

    # convert variants to dictionary
    vdict = {}
    for variant in variants:
        vdict[variant['hgvsc']] = variant
    return vdict

def get_varapp_variants(sample: str):
    # get list of variants from tsv file
    filename = os.path.join(varapp_folder, sample + '.tsv')
    with open(filename, 'r') as f:
        headers = f.readline().strip('\n').split('\t')
        variants = []
        for line in f.readlines():
            if line.strip():
                line = line.strip('\n').split('\t')
                variant = dict(zip(headers, line))
                variants.append(variant)

    # convert variants to dictionary
    vdict = {}
    for variant in variants:
        vdict[variant['HGVSc']] = variant
    return vdict

def toNumber(numString, digit: int = 6):
    try:
        return f'%.{digit}g'%float(numString)
    except ValueError:
        if numString == '': return '-1'
        return numString

# test GnomAD v2 Exon
def db_001(cura_variant, varapp_variant):
    vc = cura_variant
    vv = varapp_variant

    titlesc = ['gnomade_af', 'gnomade_afr_af', 'gnomade_amr_af', 'gnomade_asj_af', 'gnomade_eas_af', 'gnomade_fin_af', 'gnomade_nfe_af', 'gnomade_oth_af', 'gnomade_sas_af']
    titlesv = ['Gnomad_af', 'Gnomad_afr_af', 'Gnomad_amr_af', 'Gnomad_asj_af', 'Gnomad_eas_af', 'Gnomad_fin_af', 'Gnomad_nfe_af', 'Gnomad_oth_af', 'Gnomad_sas_af']

    test = True
    for i in range(len(titlesc)):
        valuec = toNumber(vc[titlesc[i]])
        valuev = toNumber(vv[titlesv[i]])
        if valuec != valuev:
            print(f"db_001 failed for {vc['hgvsc']} - {titlesc[i]}: {valuec} != {valuev}")
            test = False

    return test

# test GnomAD v2 Combine
def db_002(cura_variant):
    vc = cura_variant
    chr = vc['Chrom']
    pos = vc['Start']
    ref = vc['Ref']
    alt = vc['Alt']

    gvcf = gnomad_genome_vcf_file.format(chr[3:])
    evcf = gnomad_exome_vcf_file.format(chr[3:])

    cura_keys = ['gnomadv2_merged_af', 'gnomadv2_merged_afr_af', 'gnomadv2_merged_amr_af', 'gnomadv2_merged_asj_af', 'gnomadv2_merged_eas_af', 'gnomadv2_merged_fin_af', 'gnomadv2_merged_nfe_af', 'gnomadv2_merged_oth_af', 'gnomadv2_merged_sas_af']
    vcf_subs_full = ['', '_afr', '_amr', '_asj', '_eas', '_fin', '_nfe', '_oth', '_sas']

    # read allele count & allele number from vcf
    def read_vcf(vcf_file, subs):
        entries = []
        vcf_ac_keys = ['%AC'+_ for _ in subs]
        vcf_an_keys = ['%AN'+_ for _ in subs]
        search = r'\t'.join(vcf_ac_keys + vcf_an_keys)+r'\n'
        cmd = f"bcftools query {vcf_file} -f '{search}' -r {chr}:{pos} -i 'CHROM=\"{chr}\" && POS={pos} && REF=\"{ref}\" && ALT=\"{alt}\"' 2>/dev/null"
        out, _ = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE).communicate()
        out = out.decode('utf-8').strip()

        for line in out.split('\n'):
            entry = dict()
            for sub in vcf_subs_full:
                entry[sub] = allele_data()
            if line:
                result = line.split()
                for i in range(len(subs)):
                    entry[vcf_subs_full[i]].ac = int(result[i])
                    entry[vcf_subs_full[i]].an = int(result[i+len(subs)])
                    entry[vcf_subs_full[i]].found = True
            entries.append(entry)

        return entries
    
    gentries = read_vcf(gvcf, vcf_subs_full[:-1])
    eentries = read_vcf(evcf, vcf_subs_full)
    multi = len(gentries) > 1 or len(eentries) > 1
    
    # # combine allele frequency data and get minimum value
    # min_af = None
    # for i in range(len(gentries)):
    #     for j in range(len(eentries)):
    #         af = dict()
    #         for key in vcf_subs_full:
    #             af[key] = combine_af(gentries[i][key], eentries[j][key])
    #         if not min_af or af[''] < min_af['']:
    #             min_af = af

    # combine allele frequency data and get minimum value
    min_af = dict()
    for i in range(len(gentries)):
        for j in range(len(eentries)):
            for key in vcf_subs_full:
                af = combine_af(gentries[i][key], eentries[j][key])
                if key not in min_af or af < min_af[key]:
                    min_af[key] = af

    # compare cura value with vcf value
    test = True
    for i in range(len(cura_keys)):
        valuec = toNumber(vc[cura_keys[i]])
        valuev_1 = toNumber(min_af[vcf_subs_full[i]], 4)
        valuev_2 = toNumber(min_af[vcf_subs_full[i]], 3)
        if valuec not in [valuev_1, valuev_2]:
            multi_str = '' if not multi else ' [multiple mapping]'
            print(f"db_002 failed for {vc['hgvsc']} - {cura_keys[i]}: {valuec} != {min_af[vcf_subs_full[i]]} {multi_str}")
            test = False

    return test

# test GnomAD v3 Gnom
def db_003(cura_variant, varapp_variant):
    vc = cura_variant
    vv = varapp_variant

    titlesv = ['Gnomadv3_af', 'Gnomadv3_af_afr', 'Gnomadv3_af_ami', 'Gnomadv3_af_amr', 'Gnomadv3_af_asj', 'Gnomadv3_af_eas', 'Gnomadv3_af_fin', 'Gnomadv3_af_mid', 'Gnomadv3_af_nfe', 'Gnomadv3_af_oth', 'Gnomadv3_af_sas']
    titlesc = ['gnomadg_af', 'gnomadg_afr_af', 'gnomadg_ami_af', 'gnomadg_amr_af', 'gnomadg_asj_af', 'gnomadg_eas_af', 'gnomadg_fin_af', 'gnomadg_mid_af', 'gnomadg_nfe_af', 'gnomadg_oth_af', 'gnomadg_sas_af']

    test = True
    for i in range(len(titlesc)):
        raw_valuec = vc[titlesc[i]]
        raw_valuev = vv[titlesv[i]]
        valuec = toNumber(vc[titlesc[i]])
        valuev = toNumber(vv[titlesv[i]])
        if valuev == '-1': valuev = '0'
        if valuec == '-1': valuec = '0'

        if valuec != valuev:
            rate = abs(float(valuec) - float(valuev)) / float(valuev)
            if rate > 0.001:
                print(f"db_003 failed for {vc['hgvsc']} - {titlesc[i]}: {raw_valuec} != {raw_valuev}")
                test = False

    return test

# test GnomAD v2 Z-score
def db_004(cura_variant, varapp_variant):
    vc = cura_variant
    vv = varapp_variant

    zscoresc = vc['gnomadv2_constraint_all_scores']
    if zscoresc:
        zscoresc = [_.split(',')[0].split('[')[1] for _ in zscoresc.split('],')]
        zscoresc = [toNumber(_) for _ in zscoresc]
    else: zscoresc = []

    zscorev = toNumber(vv['Constraint_mis_z'])
    if zscorev and zscorev not in zscoresc:
        print(f"db_004 failed for {vc['hgvsc']}: {vc['gnomadv2_constraint_all_scores']} != {zscorev}")
        # pdb.set_trace()
        return False
    return True

# test REVEL
def db_005(cura_variant, varapp_variant):
    vc = cura_variant
    vv = varapp_variant

    revelc = toNumber(vc['revel'])
    revelv = toNumber(vv['Revel'])
    if revelc != revelv:
        print(f"db_005 failed for {vc['hgvsc']}: {revelc} != {revelv}")
        return False
    return True

# test ClinVar ID + Conf + ClinSig
def db_006(cura_variant):
    vc = cura_variant
    chr = vc['Chrom'][3:]
    pos = vc['Start']
    ref = vc['Ref']
    alt = vc['Alt']
    idc = vc['clinvar_id']
    confc = vc['clinvar_clnsigconf']
    clinsigc = vc['clinvar_classification']

    # get clinvar db data
    cmd = f"bcftools query {clinvar_vcf_file} -f '%ID\\t%CLNSIGCONF\\t%CLNSIG\\n' -r {chr}:{pos} -i 'CHROM=\"{chr}\" && POS={pos} && REF=\"{ref}\" && ALT=\"{alt}\"'"
    out, _ = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE).communicate()
    out = out.decode('utf-8').strip()
    if out == '':
        idv = ''
        confv = clinsigv = 'None'
    else:
        # abnormal case: multiple variants are founded
        if '\n' in out:
            print(f"{vc['hgvs c']}: skip due to multiple clinvar records")
            return True
        # convert values in vcf to cura format
        idv, confv, clinsigv = out.split('\t')
        idv = '' if idv == '.' else idv
        confv = 'None' if confv == '.' else confv.replace('|', ', ')
        clinsigv = 'None' if clinsigv == '.' else clinsigv

    # compare vcf entry value with cura value
    test = True
    if idc != idv:
        print(f"db_006 failed for {vc['hgvsc']} - ID: {idc} != {idv}")
        test = False
    if confc != confv:
        print(f"db_006 failed for {vc['hgvsc']} - Conf: {confc} != {confv}")
        test = False
    if clinsigc != clinsigv:
        print(f"db_006 failed for {vc['hgvsc']} - ClinSig: {clinsigc} != {clinsigv}")
        pdb.set_trace()
        test = False
    return test

# test RSID
def db_007(cura_variant, varapp_variant):
    vc = cura_variant
    vv = varapp_variant

    rsidv = vv['Existing_variation'].split('&')[0]
    if rsidv[:2] != 'rs': rsidv = ''
    rsidc = vc['rsid']
    if rsidc != rsidv:
        print(f"db_007 failed for {vc['hgvsc']}: {rsidc} != {rsidv}")
        return False
    return True

# test VarAPP impact + severity
def db_008(cura_variant, varapp_variant):
    vc = cura_variant
    vv = varapp_variant

    impactc = vc['varapp_impact']
    impactv = vv['Impact']
    severityc = vc['varapp_impact_severity']
    severityv = vv['Impact_severity']

    test = True
    if impactc != impactv:
        print(f"db_008 failed for {vc['hgvsc']} - Impact: {impactc} != {impactv}")
        test = False
    if severityc != severityv:
        print(f"db_008 failed for {vc['hgvsc']} - Severity: {severityc} != {severityv}")
        test = False
    
    return test

# test hgvsc and HGVSp
def db_009(cura_variant, varapp_variant):
    vc = cura_variant
    vv = varapp_variant

    hgvscc = vc['hgvsc']; hgvscv = vv['HGVSc']
    if hgvscc != hgvscv:
        print(f"db_009 failed for {hgvscc}: {hgvscv}")
        return False
    hgvspc = vc['hgvsp']; hgvspv = vv['HGVSp']
    hgvspc = hgvspc.replace('(', '').replace(')', '')
    if hgvspc == ' - ': hgvspc = ''
    hgvspv = hgvspv.replace('%3D', '=')
    if hgvspc != hgvspv:
        print(f"db_009 failed for {hgvspc}: {hgvspv}")
        return False

    return True

# get current path
cwd = os.path.dirname(os.path.abspath(__file__))
cura_folder = os.path.join(cwd, 'data/cura_samples_pp')
varapp_folder = os.path.join(cwd, 'data/varapp_samples')
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
    varapp_variants = get_varapp_variants(sample)

    pass_count = 0
    total_count = 0

    start_time = time.time()

    for hgvsc in cura_variants.keys():
        if hgvsc in varapp_variants.keys():
            cura_variant = cura_variants[hgvsc]
            varapp_variant = varapp_variants[hgvsc]

            test = True
            test = test and db_001(cura_variant, varapp_variant)
            # test = test and db_002(cura_variant)
            # test = test and db_003(cura_variant, varapp_variant)
            # test = test and db_004(cura_variant, varapp_variant)
            test = test and db_005(cura_variant, varapp_variant)
            # test = test and db_006(cura_variant)
            test = test and db_007(cura_variant, varapp_variant)
            test = test and db_008(cura_variant, varapp_variant)
            test = test and db_009(cura_variant, varapp_variant)

            if test: pass_count += 1
            total_count += 1

    end_time = time.time()
    runtime = end_time - start_time

    print(f"{sample}: {pass_count}/{total_count} pass, runtime: {runtime} seconds")


