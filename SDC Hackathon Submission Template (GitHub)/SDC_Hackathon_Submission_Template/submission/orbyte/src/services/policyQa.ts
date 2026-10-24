/**
 * Evidence retrieval helpers for the General Policy Q&A endpoint.
 * These functions deliberately do not provide legal or policy answers; they only
 * split saved source text into passages and rank the passages for retrieval.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
  'for', 'from', 'had', 'has', 'have', 'how', 'in', 'into', 'is', 'it', 'its', 'may', 'of', 'on', 'or',
  'our', 'should', 'that', 'the', 'their', 'them', 'there', 'these', 'this', 'to', 'was', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your', 'apakah', 'bagaimana', 'bila',
  'boleh', 'dan', 'dari', 'dengan', 'di', 'ini', 'itu', 'ke', 'kepada', 'kenapa', 'yang', 'untuk', 'atau',
  'adakah', 'saya', 'kami', 'mereka', 'pada', 'perlu', 'sudah', 'telah', 'akan', 'apa', 'siapa',
  'policy', 'policies', 'polisi', 'current', 'latest', 'official', 'source', 'sources', 'change', 'changes', 'updated', 'update', 'terkini', 'sumber', 'dasar',
]);

export interface PolicyQaPassageCandidate {
  id: string;
  evidenceText: string;
  [key: string]: unknown;
}

export interface RankedPolicyQaPassage<T extends PolicyQaPassageCandidate> {
  passage: T;
  relevanceScore: number;
  matchedTerms: string[];
}

export function tokenizePolicyQuestion(value: string): string[] {
  const matches = String(value || '').toLocaleLowerCase().match(/[a-z]+|\d+(?:[.,]\d+)?/g) || [];
  return matches
    .map((token) => token.replace(/,/g, ''))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** Split extracted PDF/HTML text into compact, traceable excerpts without changing wording. */
export function splitPolicyTextIntoPassages(text: string, maxLength = 1250): string[] {
  const source = String(text || '').replace(/\r/g, '').trim();
  if (!source) return [];

  const paragraphs = source
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\n+/g, ' ').replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean);

  const passages: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxLength) {
      if (paragraph.length >= 20) passages.push(paragraph);
      continue;
    }

    const sentences = paragraph.split(/(?<=[.!?;:])\s+/).filter(Boolean);
    let buffer = '';
    for (const sentence of sentences) {
      if (sentence.length > maxLength) {
        if (buffer.trim().length >= 20) passages.push(buffer.trim());
        buffer = '';
        const words = sentence.split(/\s+/);
        let part = '';
        for (const word of words) {
          const next = part ? `${part} ${word}` : word;
          if (next.length > maxLength && part) {
            if (part.trim().length >= 20) passages.push(part.trim());
            part = word;
          } else {
            part = next;
          }
        }
        if (part.trim().length >= 20) passages.push(part.trim());
        continue;
      }
      const next = buffer ? `${buffer} ${sentence}` : sentence;
      if (next.length > maxLength && buffer) {
        if (buffer.trim().length >= 20) passages.push(buffer.trim());
        buffer = sentence;
      } else {
        buffer = next;
      }
    }
    if (buffer.trim().length >= 20) passages.push(buffer.trim());
  }

  // Some PDF extractors return one giant block with no line/paragraph markers.
  if (passages.length === 0 && source.length >= 20) {
    for (let start = 0; start < source.length; start += maxLength) {
      const part = source.slice(start, start + maxLength).trim();
      if (part.length >= 20) passages.push(part);
    }
  }
  return passages;
}

/**
 * The official FAQ index links several separate PDFs. Keep retrieval balanced across
 * each PDF instead of letting the first/longest FAQ consume the entire evidence window.
 */
export function selectBalancedPolicyFaqPassages(passages: string[], limit = 360, maxPerSource = 40): string[] {
  const groups = new Map<string, string[]>();
  for (const passage of passages) {
    const match = passage.match(/\[FAQ_SOURCE_URL:\s*(https?:\/\/[^\s\]]+)\]/i);
    const key = match?.[1] || '__unmarked_faq_text__';
    if (!groups.has(key)) groups.set(key, []);
    const group = groups.get(key)!;
    if (group.length < maxPerSource) group.push(passage);
  }
  const selected: string[] = [];
  const entries = Array.from(groups.values());
  for (let index = 0; selected.length < Math.max(1, limit); index += 1) {
    let added = false;
    for (const group of entries) {
      if (index < group.length && selected.length < limit) {
        selected.push(group[index]);
        added = true;
      }
    }
    if (!added) break;
  }
  return selected;
}

export function rankPolicyQaPassages<T extends PolicyQaPassageCandidate>(
  candidates: T[],
  question: string,
  expandedTerms: string[] = [],
  limit = 8,
): RankedPolicyQaPassage<T>[] {
  const terms = Array.from(new Set([
    ...tokenizePolicyQuestion(question),
    ...expandedTerms.flatMap(tokenizePolicyQuestion),
  ])).slice(0, 24);
  if (!terms.length) return [];

  const normalizedQuestion = String(question || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const ranked = candidates.map((passage) => {
    const text = String(passage.evidenceText || '').toLocaleLowerCase();
    const docTokens = new Set(tokenizePolicyQuestion(text));
    const matchedTerms = terms.filter((term) => docTokens.has(term));
    if (!matchedTerms.length) return { passage, relevanceScore: 0, matchedTerms };

    const matchRatio = matchedTerms.length / terms.length;
    const occurrenceBoost = matchedTerms.reduce((sum, term) => sum + Math.min(3, text.split(term).length - 1) * 0.06, 0);
    const phrase = normalizedQuestion.length >= 8 && text.replace(/[^a-z0-9]+/g, ' ').includes(normalizedQuestion);
    const relevanceScore = matchedTerms.length + matchRatio * 2 + occurrenceBoost + (phrase ? 2 : 0);
    return { passage, relevanceScore, matchedTerms };
  });

  return ranked
    .filter((item) => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, Math.max(1, limit));
}

export function extractPolicyQaCitationIds(answer: string): string[] {
  const matches = String(answer || '').match(/\[(E\d+)\]/g) || [];
  return Array.from(new Set(matches.map((item) => item.slice(1, -1))));
}

/** Require at least one citation and require every non-empty answer line to cite supplied evidence. */
export function hasValidPolicyQaCitations(answer: string, allowedIds: Set<string>): boolean {
  const lines = String(answer || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return false;
  let totalReferences = 0;
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
    // Require citations at sentence/claim level, not just one source token somewhere in a long paragraph.
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z0-9“”"'‘(])/u).map((part) => part.trim()).filter(Boolean);
    if (!sentences.length) return false;
    for (const sentence of sentences) {
      const ids = extractPolicyQaCitationIds(sentence);
      if (!ids.length || ids.some((id) => !allowedIds.has(id))) return false;
      totalReferences += ids.length;
    }
  }
  return totalReferences > 0;
}
