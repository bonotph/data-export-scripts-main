/**
 * key is date, value is the map of samples
 */
export type BCSampledData = Map<string, SampledDataMap>;

/**
 * key is Lib ID, value is the s3 file keys and whether this is a top-up
 */
type SampledDataMap = Map<
  string,
  { fastq_fileKeys: string[]; isTopUp: boolean; folder: string }
>;
