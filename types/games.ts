export type MemeAspect = '1:1' | '4:5' | '16:9';

export type MemeGeneratePayload = {
  idea: string;
  topText?: string;
  bottomText?: string;
  style?: string;
  aspect?: MemeAspect;
};

export type MemeErrorResponse = { error: string; code?: string };

export type MemeResult = {
  b64_png: string | null;
  s3Key?: string | null;
  width: number;
  height: number;
  aspect: MemeAspect;
  cached?: boolean;
};

export type MemeStatusResponse = {
  jobId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  attempts: number;
  error?: string | null;
  result?: MemeResult | null;
};
