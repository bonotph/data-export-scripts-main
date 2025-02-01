import { Job } from "../../prisma/generated/dig_client";

export type DIG_Samples = Map<string, WrappedJob>;

export type WrappedJob = Job & { project: { name: string } };
