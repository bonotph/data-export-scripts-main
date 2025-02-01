import pandas as pd
import os, pdb

chr_sorter = [f'chr{i}' for i in range(1, 23)] + ['chrX', 'chrY', 'chrM']
db_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data/databases/mitomap')
bed_path = os.path.join(db_folder, 'mitomap_helix.csv')
vcf_path = os.path.join(db_folder, 'mitomap_helix.vcf')
tmp_path = os.path.join(db_folder, 'mitomap_helix.tmp.vcf')
fa_path = os.path.join(db_folder, 'chrM.fasta')

convert_table = {
    'R': 'AG',
    'Y': 'CT',
    'S': 'CG',
    'W': 'AT',
    'K': 'GT',
    'M': 'AC',
    'H': 'ACT',
    'B': 'CGT',
    'V': 'ACG',
    'D': 'AGT',
    'N': 'ACGT',
}
with open(fa_path, 'r') as fasta_file:
    chrM = ''
    for line in fasta_file:
        if not line.startswith('>'):
            chrM += line.strip()

info_cols = ['helix_af']
df  = pd.read_csv(bed_path, sep=',', header=0)
df = df.rename(columns={ 
    'tpos':'POS', 
    'ref':'REF',
    'alt':'ALT',
    'helix_af':'helix_af',
})

# switch 0-based to 1-based
df['#CHROM'] = 'chrM'
df['ID'] = '.'
df['QUAL'] = 300
df['FILTER'] = '.'
df['INFO'] = df.apply(lambda row: ';'.join([f'{info}={row[info]}' for info in info_cols]), axis=1)
df['FORMAT'] = 'GT'

df = df[['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO', 'FORMAT']]

drop_indices = []
for index, row in df.iterrows():
    alt = row['ALT']
    if set(alt) <= {'A', 'C', 'G', 'T'}:
        continue
    if alt == ':':
        base_pos = row['POS']-1
        base = chrM[base_pos-1]
        df.at[index, 'POS'] = base_pos
        df.at[index, 'ALT'] = base
        df.at[index, 'REF'] = base + row['REF']
        continue

    alts = [alt]
    for i in range(len(alt)):
        if alt[i] in convert_table:
            new_alts = []
            for old_alt in alts:
                for new_alt in convert_table[alt[i]]:
                    new_alts.append(old_alt[:i] + new_alt + old_alt[i+1:])
            alts = new_alts

    # replace the original row with multiple new rows
    drop_indices.append(index)
    rdict = row.to_dict()
    for new_alt in alts:
        rdict['ALT'] = new_alt
        df = df._append(rdict, ignore_index=True)

df = df.drop(drop_indices).reset_index(drop=True)

# for sorting only
df = df[df['#CHROM'].isin(chr_sorter)]
df['#CHROM'] = df['#CHROM'].astype('category').cat.set_categories(chr_sorter)
df = df.sort_values(by=['#CHROM', 'POS', 'REF', 'ALT']).reset_index(drop=True)

with open(tmp_path, 'w') as vcf:
    vcf.write('##fileformat=VCFv4.1\n')
    for info in info_cols:
        info_type = 'Integer' if info in ['END'] else 'String'
        vcf.write(f'##INFO=<ID={info},Number=1,Type={info_type},Description="{info}">\n')

df.to_csv(tmp_path, sep="\t", mode='a', index=False)
os.system(f'bcftools norm {tmp_path} --fasta-ref {fa_path} > {vcf_path}')
os.system(f'bgzip -f {vcf_path} && tabix -f -p vcf {vcf_path}.gz')
os.system(f'rm {tmp_path}')
