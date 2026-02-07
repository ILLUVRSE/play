export type MemeRequest = {
  idea: string;
  topText?: string;
  bottomText?: string;
  style?: string;
  aspect?: '1:1' | '4:5' | '16:9';
  mode?: 'image' | 'gif';
};

export type MemeResponse = {
  b64_png?: string;
  b64_gif?: string;
  width: number;
  height: number;
  aspect: string;
  error?: string;
};

export async function generateMeme(payload: MemeRequest, openaiKey?: string): Promise<MemeResponse> {
  const res = await fetch('/api/mememachine/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(openaiKey ? { 'x-openai-key': openaiKey } : {})
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate meme');
  }
  return data as MemeResponse;
}
