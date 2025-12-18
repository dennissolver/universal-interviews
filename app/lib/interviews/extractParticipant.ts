type TranscriptTurn = {
  role: 'agent' | 'user';
  message: string;
};

export function extractParticipantDetails(transcript: TranscriptTurn[]) {
  const result = {
    name: null as string | null,
    company: null as string | null,
    country: null as string | null,
    stage: null as string | null,
    sectors: null as string | null,
  };

  for (let i = 0; i < transcript.length - 1; i++) {
    const current = transcript[i];
    const next = transcript[i + 1];

    if (current.role !== 'agent' || next.role !== 'user') continue;

    const q = current.message.toLowerCase();

    if (q.includes('full name')) result.name = next.message;
    if (q.includes('company') || q.includes('fund'))
      result.company = next.message;
    if (q.includes('country')) result.country = next.message;
    if (q.includes('investment') || q.includes('thesis'))
      result.stage = next.message;
    if (q.includes('sector')) result.sectors = next.message;
  }

  return result;
}
