/**
 * Control-plane Hono app entry. Re-exports from src/control/app.ts so
 * Bun servers can import from `./server/app` as planned.
 */
export { app, websocket } from '../src/control/app'
export { app as default } from '../src/control/app'
