const DEFAULT_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000' : '/api';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || DEFAULT_BASE_URL;

export interface Video {
  id: string;
  url: string;
  youtubeId: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface ChatSummary {
  id: string;
  createdAt: string;
  latestMessage?: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    createdAt: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface RetrievalChunk {
  content: string;
  similarity: number;
}

export interface ChatStreamTokenEvent {
  type: 'token';
  data: string;
}

export interface ChatStreamDoneEvent {
  type: 'done';
  data: {
    answer: string;
    chunks: RetrievalChunk[];
  };
}

export interface ChatStreamErrorEvent {
  type: 'error';
  data: string;
}

export type ChatStreamEvent =
  | ChatStreamTokenEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent;

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await safeExtractError(response);
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    const message = await safeExtractError(response);
    throw new Error(message);
  }
}

async function safeExtractError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.error?.message) {
      return body.error.message as string;
    }
  } catch {
    // fall through
  }
  return `Request failed with status ${response.status}`;
}

export async function fetchVideos(): Promise<Video[]> {
  const response = await fetch(`${API_BASE_URL}/youtube/videos`);
  return parseResponse<Video[]>(response);
}

export async function importVideo(url: string): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/youtube/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  return parseResponse<{ id: string }>(response);
}

export async function createChat(videoIds: string[]): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/chat/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoIds }),
  });

  return parseResponse<{ id: string }>(response);
}

export async function fetchChats(): Promise<ChatSummary[]> {
  const response = await fetch(`${API_BASE_URL}/chat/chats`);
  return parseResponse<ChatSummary[]>(response);
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  const response = await fetch(
    `${API_BASE_URL}/chat/messages?chatId=${encodeURIComponent(chatId)}`,
  );
  return parseResponse<Message[]>(response);
}

export async function deleteChat(chatId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/chat?chatId=${encodeURIComponent(chatId)}`,
    { method: 'DELETE' },
  );
  await assertOk(response);
}

export async function deleteVideo(videoId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/youtube/video?videoId=${encodeURIComponent(videoId)}`,
    { method: 'DELETE' },
  );
  await assertOk(response);
}

export type StreamChatCallbacks = {
  onEvent: (event: ChatStreamEvent) => void;
  onError: (error: Error) => void;
  onComplete?: () => void;
};

export function streamChat(
  chatId: string,
  question: string,
  callbacks: StreamChatCallbacks,
): () => void {
  const controller = new AbortController();
  let cancelled = false;

  const finalize = () => {
    if (cancelled) return;
    cancelled = true;
    callbacks.onComplete?.();
  };

  const parseEventLines = (chunk: string) => {
    const events = chunk.split('\n\n');
    return events;
  };

  const processPayload = (payload: string) => {
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as ChatStreamEvent;
      if (parsed.type === 'error') {
        const message =
          typeof parsed.data === 'string'
            ? parsed.data
            : 'Streaming failed with an unknown error.';
        callbacks.onError(new Error(message));
        if (!cancelled) {
          cancelled = true;
          controller.abort();
        }
      } else {
        callbacks.onEvent(parsed);
      }
    } catch (error) {
      console.warn('Unable to parse streaming payload', error);
    }
  };

  (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/ask-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ chatId, question }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await safeExtractError(response);
        throw new Error(message);
      }

      const body = response.body;
      if (!body) {
        throw new Error('The streaming response did not include a body.');
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const events = parseEventLines(buffer);
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const lines = rawEvent
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            processPayload(payload);
          }
        }
      }

      buffer += decoder.decode();

      if (buffer) {
        const trailing = buffer
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

        for (const line of trailing) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          processPayload(payload);
        }
      }

      finalize();
    } catch (error) {
      if (controller.signal.aborted) {
        finalize();
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Streaming failed.';
      callbacks.onError(new Error(message));
      finalize();
    }
  })();

  return () => {
    if (cancelled) return;
    cancelled = true;
    controller.abort();
  };
}
