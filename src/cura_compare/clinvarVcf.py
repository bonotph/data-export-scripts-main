import vcf
import os
import pdb

cwd = os.path.dirname(os.path.abspath(__file__))
vcf_file = os.path.join(cwd, 'data/clinvar/clinvar_20240107.vcf.gz')
output_file = os.path.join(cwd, 'data/clinvar/clinvar_20240107.tsv')

def get_clinvar_data():
    f = open(output_file, 'w')
    f.write('Position\tID\tClinsig\tConf\n')
    vcf_reader = vcf.Reader(filename=vcf_file, encoding='utf-8')
    for record in vcf_reader:
        pos = f'chr{record.CHROM}:{record.POS}'
        id = record.ID
        clinsig = 'None'
        if 'CLNSIG' in record.INFO:
            clinsig = record.INFO['CLNSIG'][0]
        conf = 'None'
        if 'CLNSIGCONF' in record.INFO:
            conf = record.INFO['CLNSIGCONF'][0]
        f.write(f'{pos}\t{id}\t{clinsig}\t{conf}\n')

get_clinvar_data()