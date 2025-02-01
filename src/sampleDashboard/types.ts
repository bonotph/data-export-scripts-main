import { fetchS3ObjectList } from '../common/awsFetches';
import { saveDIGJobs } from './downloadToLocal';

export type AWS_Files = Awaited<ReturnType<typeof fetchS3ObjectList>>;

export type T_DIG_JOBS = Awaited<ReturnType<typeof saveDIGJobs>>;
