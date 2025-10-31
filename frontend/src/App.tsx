import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchVideos,
  importVideo as importVideoRequest,
  createChat,
  fetchChats,
  fetchMessages,
  streamChat,
  deleteChat,
  deleteVideo,
  type ChatSummary,
  type Message,
  type RetrievalChunk,
  type Video,
} from './lib/api';
import './App.css';

type ImportState = 'idle' | 'loading' | 'success';

interface VideoImportFormProps {
  onImport: (url: string) => Promise<void>;
  status: ImportState;
  error: string | null;
}

interface VideoGalleryProps {
  videos: Video[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  loading: boolean;
  onDelete: (id: string) => void;
  deletingIds: Set<string>;
}

interface ChatHistoryProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelect: (chatId: string) => void;
  loading: boolean;
  onDelete: (chatId: string) => void;
  deletingIds: Set<string>;
}

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
}

interface ChatInputProps {
  disabled: boolean;
  onSend: (message: string) => Promise<void>;
  pendingQuestion: string;
  onChangePending: (value: string) => void;
}

interface SourcesProps {
  sources: RetrievalChunk[];
  visible: boolean;
  onToggle: () => void;
}

function VideoImportForm({ onImport, status, error }: VideoImportFormProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim()) return;

    await onImport(url.trim());
    setUrl('');
  };

  return (
    <form className="video-import" onSubmit={handleSubmit}>
      <label className="video-import__label" htmlFor="video-url">
        Import a YouTube video
      </label>
      <div className="video-import__controls">
        <input
          id="video-url"
          type="url"
          placeholder="https://youtu.be/..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="video-import__input"
          required
        />
        <button
          type="submit"
          className="video-import__button"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Importing…' : 'Import'}
        </button>
      </div>
      <div className="video-import__feedback">
        {status === 'success' && <span>Video imported successfully.</span>}
        {error && <span className="error-text">{error}</span>}
      </div>
    </form>
  );
}

function VideoGallery({
  videos,
  selectedIds,
  onToggle,
  loading,
  onDelete,
  deletingIds,
}: VideoGalleryProps) {
  if (loading) {
    return (
      <div className="video-gallery__empty">
        Loading your video library…
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="video-gallery__empty">
        There are no videos yet. Import a link to get started.
      </div>
    );
  }

  return (
    <div className="video-gallery">
      {videos.map((video) => {
        const isSelected = selectedIds.has(video.id);
        const thumbnail = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
        const isDeleting = deletingIds.has(video.id);

        return (
          <button
            key={video.id}
            className={`video-card ${isSelected ? 'video-card--selected' : ''}`}
            onClick={() => onToggle(video.id)}
            type="button"
          >
            <div className="video-card__actions">
              <button
                type="button"
                className="video-card__action"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(video.id);
                }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
            <div className="video-card__badge">
              {isSelected ? 'Selected' : 'Tap to use'}
            </div>
            <div className="video-card__media">
              <img
                src={thumbnail}
                alt={video.title || `YouTube video ${video.youtubeId}`}
                loading="lazy"
              />
            </div>
            <div className="video-card__body">
              <h3>{video.title || video.url}</h3>
              {video.description && (
                <p className="video-card__description">{video.description}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ChatHistory({
  chats,
  activeChatId,
  onSelect,
  loading,
  onDelete,
  deletingIds,
}: ChatHistoryProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span className="sidebar__title">Chats</span>
      </div>
      <div className="sidebar__content">
        {loading ? (
          <div className="sidebar__placeholder">Loading chats…</div>
        ) : !chats.length ? (
          <div className="sidebar__placeholder">
            No chats yet. Start one from the video library.
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isDeleting = deletingIds.has(chat.id);
            return (
              <button
                key={chat.id}
                type="button"
                className={`chat-history-item ${
                  isActive ? 'chat-history-item--active' : ''
                }`}
                onClick={() => onSelect(chat.id)}
              >
                <div className="chat-history-item__header">
                  <span className="chat-history-item__title">
                    Chat {chat.id.slice(0, 8)}
                  </span>
                  <button
                    type="button"
                    className="chat-history-item__delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(chat.id);
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Removing…' : 'Delete'}
                  </button>
                </div>
                <span className="chat-history-item__snippet">
                  {chat.latestMessage?.content || 'No messages yet'}
                </span>
                <span className="chat-history-item__time">
                  {new Date(chat.createdAt).toLocaleDateString()}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function MessageList({ messages, streaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  return (
    <div className="chat-thread" ref={containerRef}>
      {!messages.length ? (
        <div className="chat-thread__empty">
          <h2>Chat about your videos</h2>
          <p>
            Pick one or more videos from the library, start a chat, and ask
            questions. Answers will stream in real-time.
          </p>
        </div>
      ) : (
        messages.map((message) => (
          <article
            key={message.id}
            className={`chat-message chat-message--${message.role}`}
          >
            <div className="chat-message__avatar">
              {message.role === 'assistant' ? 'AI' : 'You'}
            </div>
            <div className="chat-message__content">
              <div className="chat-message__meta">
                <span className="chat-message__role">
                  {message.role === 'assistant' ? 'Assistant' : 'You'}
                </span>
                <span className="chat-message__time">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p>{message.content}</p>
              {streaming &&
                message.role === 'assistant' &&
                !message.content.endsWith('…') && (
                  <span className="chat-message__cursor" />
                )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function ChatInput({
  disabled,
  onSend,
  pendingQuestion,
  onChangePending,
}: ChatInputProps) {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingQuestion.trim() || disabled) return;
    await onSend(pendingQuestion.trim());
    onChangePending('');
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <textarea
        placeholder="Ask anything about the selected videos…"
        value={pendingQuestion}
        onChange={(event) => onChangePending(event.target.value)}
        disabled={disabled}
        rows={3}
      />
      <div className="chat-input__controls">
        <button type="submit" disabled={disabled || !pendingQuestion.trim()}>
          {disabled ? 'Thinking…' : 'Send'}
        </button>
      </div>
    </form>
  );
}

function SourcesList({ sources, visible, onToggle }: SourcesProps) {
  if (!sources.length) {
    return null;
  }

  return (
    <div className="sources-panel">
      <div className="sources-panel__header">
        <h3>Supporting context</h3>
        <button
          type="button"
          className="sources-panel__toggle"
          onClick={onToggle}
        >
          {visible ? 'Hide snippets' : 'Show snippets'}
        </button>
      </div>
      {visible ? (
        <ul>
          {sources.map((chunk, index) => (
            <li key={`${chunk.similarity}-${index}`}>
              <div className="sources-panel__score">
                Similarity {chunk.similarity.toFixed(2)}
              </div>
              <p>{chunk.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sources-panel__preview">
          Hidden by default to keep answers focused. Show snippets to inspect
          the referenced transcript chunks.
        </p>
      )}
    </div>
  );
}

const sortMessagesChronologically = (list: Message[]) =>
  [...list].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<RetrievalChunk[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [deletingChatIds, setDeletingChatIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [deletingVideoIds, setDeletingVideoIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [videoPanelError, setVideoPanelError] = useState<string | null>(null);

  const [importStatus, setImportStatus] = useState<ImportState>('idle');
  const [importError, setImportError] = useState<string | null>(null);

  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const hasActiveChat = Boolean(activeChatId);
  const selectedCount = selectedVideoIds.size;
  const streamAbortRef = useRef<(() => void) | null>(null);
  const streamingLockRef = useRef(false);

  const selectionPreview = useMemo(() => {
    const names = videos
      .filter((video) => selectedVideoIds.has(video.id))
      .map((video) => video.title || video.url);

    if (!names.length) return '';
    if (names.length <= 2) return names.join(', ');

    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  }, [videos, selectedVideoIds]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.();
    };
  }, []);

  useEffect(() => {
    const loadVideos = async () => {
      setIsLoadingVideos(true);
      try {
        const fetchedVideos = await fetchVideos();
        setVideos(fetchedVideos);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingVideos(false);
      }
    };

    const loadChats = async () => {
      setIsLoadingChats(true);
      try {
        const fetchedChats = await fetchChats();
        setChats(fetchedChats);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingChats(false);
      }
    };

    loadVideos();
    loadChats();
  }, []);

  const refreshChats = async () => {
    setIsLoadingChats(true);
    try {
      const fetchedChats = await fetchChats();
      setChats(fetchedChats);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const refreshVideos = async () => {
    setIsLoadingVideos(true);
    try {
      const fetchedVideos = await fetchVideos();
      setVideos(fetchedVideos);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const loadMessagesForChat = async (chatId: string) => {
    setIsLoadingMessages(true);
    setChatError(null);
    try {
      const fetchedMessages = await fetchMessages(chatId);
      setMessages(sortMessagesChronologically(fetchedMessages));
      setSources([]);
      setShowSources(false);
    } catch (error) {
      console.error(error);
      setChatError(
        error instanceof Error ? error.message : 'Failed to load messages',
      );
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleImportVideo = async (url: string) => {
    setImportStatus('loading');
    setImportError(null);
    setVideoPanelError(null);

    try {
      await importVideoRequest(url);
      setImportStatus('success');
      await refreshVideos();
      setTimeout(() => setImportStatus('idle'), 2000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import video';
      setImportError(message);
      setImportStatus('idle');
    }
  };

  const handleToggleVideo = (id: string) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteVideo = async (videoId: string) => {
    const confirmDelete = window.confirm(
      'Remove this video from your library? Chats that used it will no longer reference it.',
    );
    if (!confirmDelete) {
      return;
    }

    setVideoPanelError(null);
    setDeletingVideoIds((prev) => {
      const next = new Set(prev);
      next.add(videoId);
      return next;
    });

    try {
      await deleteVideo(videoId);
      setVideos((prev) => prev.filter((video) => video.id !== videoId));
      setSelectedVideoIds((prev) => {
        if (!prev.has(videoId)) return prev;
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
      await refreshVideos();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to remove video.';
      setVideoPanelError(message);
    } finally {
      setDeletingVideoIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    }
  };

  const handleStartChat = async () => {
    if (!selectedVideoIds.size) return;

    setIsCreatingChat(true);
    setChatError(null);
    try {
      const result = await createChat(Array.from(selectedVideoIds));
      setActiveChatId(result.id);
      setMessages([]);
      setSources([]);
      setShowSources(false);
      setSelectedVideoIds(new Set());
      await refreshChats();
      await loadMessagesForChat(result.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create chat';
      setChatError(message);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleSelectChat = async (chatId: string) => {
    if (chatId === activeChatId) return;
    setActiveChatId(chatId);
    await loadMessagesForChat(chatId);
  };

  const handleDeleteChat = async (chatId: string) => {
    const confirmDelete =
      window.confirm('Delete this chat and its messages permanently?');
    if (!confirmDelete) {
      return;
    }

    setChatError(null);
    setDeletingChatIds((prev) => {
      const next = new Set(prev);
      next.add(chatId);
      return next;
    });

    try {
      await deleteChat(chatId);
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));

      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
        setSources([]);
        setShowSources(false);
      }

      await refreshChats();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete chat.';
      setChatError(message);
    } finally {
      setDeletingChatIds((prev) => {
        const next = new Set(prev);
        next.delete(chatId);
        return next;
      });
    }
  };

  const handleSendMessage = async (question: string) => {
    if (!activeChatId) {
      setChatError('Create or select a chat before asking questions.');
      return;
    }

    if (streamingLockRef.current) {
      return;
    }

    if (streamAbortRef.current) {
      streamAbortRef.current();
      streamAbortRef.current = null;
    }

    streamingLockRef.current = true;
    setIsStreaming(true);

    const timestamp = new Date().toISOString();
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      createdAt: timestamp,
    };
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: timestamp,
    };

    setMessages((prev) =>
      sortMessagesChronologically([...prev, userMessage, assistantMessage]),
    );
    setChatError(null);
    setSources([]);
    setShowSources(false);

    let answerBuffer = '';

    const finishStreaming = () => {
      streamingLockRef.current = false;
      setIsStreaming(false);
      streamAbortRef.current = null;
    };

    try {
      const cancelStream = streamChat(activeChatId, question, {
        onEvent: (event) => {
          if (event.type === 'token') {
            answerBuffer += event.data;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: answerBuffer }
                  : message,
              ),
            );
          } else if (event.type === 'done') {
            const finalAnswer = event.data.answer || answerBuffer;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: finalAnswer }
                  : message,
              ),
            );
            setSources(event.data.chunks || []);
            setShowSources(false);
            refreshChats();
          }
        },
        onError: (error) => {
          console.error(error);
          const message =
            error instanceof Error ? error.message : 'Streaming failed';
          setChatError(message);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    content:
                      'Something went wrong while generating the answer. Please try again.',
                  }
                : msg,
            ),
          );
          setShowSources(false);
          finishStreaming();
        },
        onComplete: () => {
          finishStreaming();
        },
      });

      streamAbortRef.current = () => {
        cancelStream();
        finishStreaming();
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Streaming failed to start.';
      setChatError(message);
      finishStreaming();
    }
  };

  const isChatInputDisabled =
    isStreaming || isLoadingMessages || !hasActiveChat;

  return (
    <div className="app-shell">
      <ChatHistory
        chats={chats}
        activeChatId={activeChatId}
        onSelect={handleSelectChat}
        loading={isLoadingChats}
        onDelete={handleDeleteChat}
        deletingIds={deletingChatIds}
      />

      <main className="main">
        <section className="chat-area">
          <header className="chat-area__header">
            <div>
              <h1>YouTube RAG Assistant</h1>
              <p>
                Stream answers grounded in the transcripts of your imported
                videos.
              </p>
            </div>
            <div className="chat-area__status">
              {isStreaming ? (
                <span className="status status--live">Streaming response…</span>
              ) : hasActiveChat ? (
                <span className="status">Ready for your next question</span>
              ) : (
                <span className="status">
                  Select a chat or start a new conversation
                </span>
              )}
            </div>
          </header>

          <MessageList messages={messages} streaming={isStreaming} />

          {chatError && <div className="error-banner">{chatError}</div>}

          <ChatInput
            disabled={isChatInputDisabled}
            onSend={handleSendMessage}
            pendingQuestion={pendingQuestion}
            onChangePending={setPendingQuestion}
          />

          <SourcesList
            sources={sources}
            visible={showSources}
            onToggle={() => setShowSources((prev) => !prev)}
          />
        </section>

        <section className="video-panel">
          <header className="video-panel__header">
            <h2>Video Library</h2>
            <p>
              Choose the videos you want the assistant to reason over. Start a
              fresh chat to group them.
            </p>
          </header>

          <VideoImportForm
            onImport={handleImportVideo}
            status={importStatus}
            error={importError}
          />

          {videoPanelError && (
            <div className="video-panel__error">{videoPanelError}</div>
          )}

          {selectedCount > 0 && (
            <div className="video-panel__selection">
              <div className="video-panel__selection-details">
                <span className="video-panel__selection-count">
                  {selectedCount} video{selectedCount === 1 ? '' : 's'} selected
                </span>
                {selectionPreview && (
                  <span className="video-panel__selection-preview">
                    {selectionPreview}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleStartChat}
                disabled={isCreatingChat}
              >
                {isCreatingChat ? 'Creating chat…' : 'Start new chat'}
              </button>
            </div>
          )}

          <div className="video-panel__list">
            <VideoGallery
              videos={videos}
              selectedIds={selectedVideoIds}
              onToggle={handleToggleVideo}
              loading={isLoadingVideos}
              onDelete={handleDeleteVideo}
              deletingIds={deletingVideoIds}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
