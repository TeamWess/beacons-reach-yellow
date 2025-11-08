# Bridge-Y

**Yellow-Tier Metadata Coordination Infrastructure**

Bridge-Y is the metadata coordination layer for Beacon's Reach, handling zero-knowledge coordination between Council members without ever touching conversation content.

## Architecture Tier: YELLOW (Trusted)

- **NO conversation content** - only metadata and receipt hashes
- **NO file names** - only coordination signals
- Blind relay through Gateway
- SHA-256 receipts for audit trail

## Endpoints

- `GET /health` - Service health check
- `POST /shelf-meta` - Record shelf organization metadata
- `POST /pulse` - Thread continuity pulse tracking
- `GET /feed` - Recent activity feed by actor
- `GET /receipt/:hash` - Receipt lookup by hash

## Database Schema

Uses PostgreSQL `bridge.*` schema with three tables:
- `bridge.shelf_change` - Organization metadata events
- `bridge.thread_continuity` - Pulse tracking
- `bridge.anchors` - Merkle root anchors (future)

## Deployment

Deployed to Railway as separate service from Business API.

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 8091)
- `NODE_ENV` - Environment (development/production)

## Local Development

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
npm start
```

---

**Part of the Beacon's Reach Yellow-Tier Infrastructure**
