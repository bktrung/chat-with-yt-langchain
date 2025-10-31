import { pgTable, pgEnum, uuid, vector, timestamp, text, index } from "drizzle-orm/pg-core";

const dimension = Number(process.env.EMBEDDING_DIMENSION ?? 768);

// Define role as a PostgreSQL enum for better type safety and database constraints
export const roleEnum = pgEnum('role', ['user', 'assistant']);

export const videos = pgTable(
  'videos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull().unique(),
    youtubeId: text('youtube_id').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('youtube_id_index').using('hash', table.youtubeId),
  ]
);

export const transcriptChunks = pgTable(
  'transcript_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    videoId: uuid('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: dimension }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('embedding_index').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ]
);

export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
);

export const chatVideos = pgTable(
  'chat_videos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('chat_id_video_id_index').on(table.chatId, table.videoId),
  ]
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    role: roleEnum('role').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('chat_id_index').on(table.chatId),
    index('created_at_index').on(table.createdAt),
  ]
);

export type TranscriptChunk = typeof transcriptChunks.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type ChatVideo = typeof chatVideos.$inferSelect;
export type Message = typeof messages.$inferSelect;