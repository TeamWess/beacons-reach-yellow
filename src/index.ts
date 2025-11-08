import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Fastify app
const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'development' 
      ? { target: 'pino-pretty' }
      : undefined
  }
});

await app.register(cors, { origin: true });

// Health check
app.get('/health', async () => ({ 
  ok: true, 
  ts: new Date().toISOString(),
  service: 'bridge-y'
}));

// Schema definitions
const ShelfMetaBody = {
  type: 'object',
  required: ['actor', 'action', 'shelf', 'receipt_hash'],
  properties: {
    actor: { type: 'string' },
    action: { type: 'string', enum: ['SPLIT', 'MERGE', 'ARCHIVE', 'CREATE', 'MOVE'] },
    shelf: { type: 'string' },
    parent_shelf: { type: 'string' },
    size_before: { type: 'integer' },
    size_after: { type: 'integer' },
    threshold: { type: 'integer' },
    coherence: { type: 'number' },
    receipt_hash: { type: 'string' },
    pulse: { type: 'string', enum: ['steady', 'throb', 'drained', 'lifted'] }
  }
};

const PulseBody = {
  type: 'object',
  required: ['actor', 'thread_tag', 'pulse'],
  properties: {
    actor: { type: 'string' },
    thread_tag: { type: 'string' },
    pulse: { type: 'string', enum: ['steady', 'throb', 'drained', 'lifted'] }
  }
};

// Shelf metadata endpoint
app.post('/shelf-meta', { schema: { body: ShelfMetaBody } }, async (req, reply) => {
  const b = req.body as any;
  const q = `
    INSERT INTO bridge.shelf_change 
      (actor, action, shelf, parent_shelf, size_before, size_after, threshold, coherence, receipt_hash, pulse)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id, ts;
  `;
  const vals = [
    b.actor, 
    b.action, 
    b.shelf, 
    b.parent_shelf ?? null,
    b.size_before ?? null,
    b.size_after ?? null, 
    b.threshold ?? null, 
    b.coherence ?? null, 
    b.receipt_hash,
    b.pulse ?? 'steady'
  ];
  const { rows } = await pool.query(q, vals);
  reply.code(201).send({ id: rows[0].id, ts: rows[0].ts });
});

// Pulse endpoint
app.post('/pulse', { schema: { body: PulseBody } }, async (req, reply) => {
  const b = req.body as any;
  const q = `
    INSERT INTO bridge.thread_continuity (actor, thread_tag, pulse)
    VALUES ($1,$2,$3) RETURNING id, ts;
  `;
  const { rows } = await pool.query(q, [b.actor, b.thread_tag, b.pulse]);
  reply.code(201).send({ id: rows[0].id, ts: rows[0].ts });
});

// Feed endpoint - get recent activity by actor
app.get('/feed', async (req, reply) => {
  const { actor, limit = 50 } = req.query as { actor?: string; limit?: number };
  
  let q = `
    SELECT id, ts, actor, action, shelf, parent_shelf, size_before, size_after, 
           threshold, coherence, receipt_hash, pulse
    FROM bridge.shelf_change
  `;
  
  const params: any[] = [];
  if (actor) {
    q += ' WHERE actor = $1';
    params.push(actor);
  }
  
  q += ' ORDER BY ts DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  
  const { rows } = await pool.query(q, params);
  reply.send(rows);
});

// Receipt lookup by hash
app.get('/receipt/:hash', async (req, reply) => {
  const { hash } = req.params as { hash: string };
  const q = `
    SELECT id, ts, actor, action, shelf, parent_shelf, size_before, size_after,
           threshold, coherence, receipt_hash, pulse
    FROM bridge.shelf_change
    WHERE receipt_hash = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(q, [hash]);
  
  if (rows.length === 0) {
    reply.code(404).send({ error: 'Receipt not found' });
  } else {
    reply.send(rows[0]);
  }
});

// Start server
const PORT = parseInt(process.env.PORT || '8091', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Bridge-Y server listening on ${address}`);
});
