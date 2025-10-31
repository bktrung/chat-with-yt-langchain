# YouTube RAG Chat API Documentation

## Base URL

```
http://localhost:3000
```

## Authentication

Currently no authentication required.

---

## Endpoints

### 1. Import YouTube Video

Import a YouTube video and process its transcript for RAG.

**Endpoint:** `POST /youtube/import`

**Request Body:**

```json
{
  "url": "https://youtu.be/VIDEO_ID"
}
```

**Validation:**
- `url` (required): Valid URL, max 2048 characters

**Success Response (201 Created):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Video imported successfully"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid URL format
- `409 Conflict`: Video already imported
- `500 Internal Server Error`: Failed to process video

**cURL Example:**

```bash
curl -X POST http://localhost:3000/youtube/import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtu.be/dQw4w9WgXcQ"}'
```

---

### 2. Get All Videos

Retrieve all imported videos.

**Endpoint:** `GET /youtube/videos`

**Success Response (200 OK):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://youtu.be/dQw4w9WgXcQ",
    "youtubeId": "dQw4w9WgXcQ",
    "title": "Video Title",
    "description": "Video description",
    "createdAt": "2025-10-24T10:30:00.000Z"
  }
]
```

**cURL Example:**

```bash
curl -X GET http://localhost:3000/youtube/videos
```

---

### 3. Delete Video

Delete an imported video and all its associated data (transcript chunks, chat associations).

**Endpoint:** `DELETE /youtube/video?videoId={videoId}`

**Query Parameters:**
- `videoId` (required): Valid UUID of the video to delete

**Success Response (200 OK):**

```json
{
  "message": "Video deleted successfully"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid videoId format
- `404 Not Found`: Video not found

**cURL Example:**

```bash
curl -X DELETE "http://localhost:3000/youtube/video?videoId=550e8400-e29b-41d4-a716-446655440000"
```

**Note:** Deleting a video will:
- Remove the video record
- Delete all transcript chunks (cascade)
- Remove video from all chat associations (cascade)

---

### 4. Create Chat Session

Create a new chat session with one or more videos.

**Endpoint:** `POST /chat/create`

**Request Body:**

```json
{
  "videoIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**Validation:**
- `videoIds` (required): Array of valid UUIDs, minimum 1 video

**Success Response (201 Created):**

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid video IDs or empty array
- `404 Not Found`: One or more videos not found

**cURL Example:**

```bash
curl -X POST http://localhost:3000/chat/create \
  -H "Content-Type: application/json" \
  -d '{
    "videoIds": ["550e8400-e29b-41d4-a716-446655440000"]
  }'
```

---

### 5. Ask Question (Standard)

Ask a question about the videos in a chat session.

**Endpoint:** `POST /chat/ask`

**Request Body:**

```json
{
  "chatId": "770e8400-e29b-41d4-a716-446655440002",
  "question": "What is the main topic discussed in the videos?"
}
```

**Validation:**
- `chatId` (required): Valid UUID
- `question` (required): String, 1-5000 characters

**Success Response (200 OK):**

```json
{
  "answer": "The main topic discussed in the videos is...",
  "chunks": [
    {
      "content": "Relevant transcript snippet (truncated to 100 chars)...",
      "similarity": 0.87
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request`: Invalid chatId or question format
- `404 Not Found`: Chat not found
- `500 Internal Server Error`: LLM processing failed

**cURL Example:**

```bash
curl -X POST http://localhost:3000/chat/ask \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "770e8400-e29b-41d4-a716-446655440002",
    "question": "What is the main topic?"
  }'
```

---

### 6. Ask Question (SSE Streaming)

Ask a question with real-time streaming responses using Server-Sent Events.

**Endpoint:** `POST /chat/ask-stream` (SSE)

**Request Body:**

```json
{
  "chatId": "770e8400-e29b-41d4-a716-446655440002",
  "question": "What is the main topic discussed in the videos?"
}
```

**Validation:**
- `chatId` (required): Valid UUID
- `question` (required): String, 1-5000 characters

**SSE Event Format:**

**Token Event (streaming):**
```json
{
  "type": "token",
  "data": "chunk of text"
}
```

**Done Event (final):**
```json
{
  "type": "done",
  "data": {
    "answer": "Complete answer text",
    "chunks": [
      {
        "content": "Relevant snippet...",
        "similarity": 0.87
      }
    ]
  }
}
```

---

### 7. Get Chat Messages

Retrieve all messages from a chat session.

**Endpoint:** `GET /chat/messages?chatId={chatId}`

**Query Parameters:**
- `chatId` (required): Valid UUID

**Success Response (200 OK):**

```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "content": "What is the main topic?",
    "role": "user",
    "createdAt": "2025-10-24T10:35:00.000Z"
  },
  {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "content": "The main topic is...",
    "role": "assistant",
    "createdAt": "2025-10-24T10:35:05.000Z"
  }
]
```

**Error Responses:**

- `400 Bad Request`: Invalid chatId format
- `404 Not Found`: Chat not found

**cURL Example:**

```bash
curl -X GET "http://localhost:3000/chat/messages?chatId=770e8400-e29b-41d4-a716-446655440002"
```

---

### 8. Get All Chats

Retrieve all chat sessions with their latest messages.

**Endpoint:** `GET /chat/chats`

**Success Response (200 OK):**

```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "createdAt": "2025-10-24T10:30:00.000Z",
    "latestMessage": {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "content": "The main topic is...",
      "role": "assistant",
      "createdAt": "2025-10-24T10:35:05.000Z"
    }
  }
]
```

**cURL Example:**

```bash
curl -X GET http://localhost:3000/chat/chats
```

---

### 9. Delete Chat

Delete a chat session and all its associated messages.

**Endpoint:** `DELETE /chat?chatId={chatId}`

**Query Parameters:**
- `chatId` (required): Valid UUID of the chat to delete

**Success Response (200 OK):**

No response body (void response)

**Error Responses:**

- `400 Bad Request`: Invalid chatId format
- `404 Not Found`: Chat not found

**cURL Example:**

```bash
curl -X DELETE "http://localhost:3000/chat?chatId=770e8400-e29b-41d4-a716-446655440002"
```

**Note:** Deleting a chat will:
- Remove the chat record
- Delete all messages (cascade)
- Remove all video associations (cascade)

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ErrorType",
    "message": "Human-readable error message",
    "statusCode": 400
  },
  "timestamp": "2025-10-24T10:35:00.000Z",
  "path": "/chat/ask"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server error

---

## RAG Configuration

The system uses optimized retrieval-augmented generation (RAG) parameters:

- **Chunk Retrieval**: 5-20 chunks dynamically selected
- **Similarity Threshold**: 0.7 (configurable)
- **Message History**: Up to 50 messages
- **Chunk Size**: 1000 characters
- **Chunk Overlap**: 200 characters
- **LLM Model**: Gemini 2.0 Flash (1M token context)
- **Temperature**: 0.7

---

## Rate Limiting

Currently no rate limiting implemented. Consider adding rate limiting in production.

---

## CORS Configuration

The API allows requests from:
- `http://localhost:5173` (default frontend URL)

Configure via `FRONTEND_URL` environment variable.

---

## Environment Variables

Required environment variables:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/yt_chat_rag
GEMINI_API_KEY=your_gemini_api_key
GEMINI_CHAT_MODEL=gemini-2.0-flash-exp
GEMINI_EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSION=768
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info
```

---