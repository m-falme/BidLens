/**
 * In-memory BM25 (Okapi) over short documents such as PDF pages or extracted list items.
 * Pure and deterministic: equal scores tie-break on the lower document id.
 */

const K1 = 1.2;
const B = 0.75;

const STOPWORDS = new Set(
  (
    "a an and are as at be been by for from has have in into is it its of on or shall that the their this to " +
    "was were which will with all any each may must such than then there these those under upon where who"
  ).split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export interface Bm25Doc {
  id: number;
  text: string;
}

export interface Bm25Hit {
  id: number;
  score: number;
}

export interface Bm25Index {
  search(query: string, k: number): Bm25Hit[];
}

export function createBm25Index(docs: readonly Bm25Doc[]): Bm25Index {
  const termFreqs = docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const token of tokenize(doc.text)) tf.set(token, (tf.get(token) ?? 0) + 1);
    return tf;
  });
  const lengths = termFreqs.map((tf) => [...tf.values()].reduce((sum, n) => sum + n, 0));
  const avgLength = lengths.reduce((sum, n) => sum + n, 0) / Math.max(1, docs.length) || 1;

  const docFreq = new Map<string, number>();
  for (const tf of termFreqs) for (const term of tf.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);

  const idf = (term: string) => {
    const n = docFreq.get(term) ?? 0;
    return Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
  };

  return {
    search(query, k) {
      const terms = [...new Set(tokenize(query))];
      const hits: Bm25Hit[] = docs.map((doc, i) => {
        const tf = termFreqs[i];
        let score = 0;
        for (const term of terms) {
          const f = tf.get(term);
          if (!f) continue;
          score += (idf(term) * f * (K1 + 1)) / (f + K1 * (1 - B + (B * lengths[i]) / avgLength));
        }
        return { id: doc.id, score };
      });
      return hits
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score || a.id - b.id)
        .slice(0, Math.max(0, k));
    },
  };
}
