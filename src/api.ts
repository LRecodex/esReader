export type StorySummary = {
  id: string;
  title: string;
  subtitle: string;
  synopsis: string;
  language: string;
  genres: string[];
  cover: string;
  chapters: ChapterSummary[];
  progress?: ReadingProgress[];
};

export type ChapterSummary = { id: string; number: number; title: string; wordCount: number };
export type Chapter = ChapterSummary & { content: string };
export type ReadingProgress = { chapterId: string; position: number; updatedAt?: string };
export type Bookmark = { id: string; storyId: string; chapterId: string; position: number; label: string; createdAt: string };

export async function readerRequest<T>(path: string, options?: ReaderRequestOptions): Promise<T> {
  const response = await window.desktop.request<T>(path, options);
  if (response.kind !== 'json') throw new Error('Unexpected image response.');
  return response.data;
}

export async function imageData(path: string): Promise<string> {
  const response = await window.desktop.request(path);
  if (response.kind !== 'image') throw new Error('Unexpected cover response.');
  return `data:${response.contentType};base64,${response.data}`;
}
