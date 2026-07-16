// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

/**
 * Browser-safe, self-contained type definitions that mirror the subset of the
 * Node.js types which appear in rhea-promise's public API surface.
 *
 * These local declarations are referenced instead of the ambient Node.js types
 * (from `@types/node`) so that consumers can type-check rhea-promise in
 * non-Node environments (browser, React Native, Cloudflare Workers, ...) that
 * polyfill these APIs at runtime and intentionally do not include
 * `@types/node`. Referencing the ambient Node types directly would otherwise
 * require every consumer to pull the entire `@types/node` global namespace into
 * their type context.
 */

/**
 * Browser-safe subset of Node's `EventEmitter` interface.
 * @interface EventEmitterLike
 */
export interface EventEmitterLike {
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string | symbol): this;
  setMaxListeners(n: number): this;
  getMaxListeners(): number;
  listeners(event: string | symbol): Array<(...args: any[]) => void>;
  rawListeners(event: string | symbol): Array<(...args: any[]) => void>;
  emit(event: string | symbol, ...args: any[]): boolean;
  listenerCount(
    event: string | symbol,
    listener?: (...args: any[]) => void,
  ): number;
  prependListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this;
  prependOnceListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this;
  eventNames(): Array<string | symbol>;
}

/**
 * Runtime-erased constructor type used to extend a value (such as Node's
 * `EventEmitter`) while only exposing the browser-safe {@link EventEmitterLike}
 * shape in the generated typings.
 */
export type EventEmitterLikeConstructor = new () => EventEmitterLike;

/**
 * Browser-safe subset of Node's `net.Socket`.
 * @interface Socket
 */
export interface Socket {
  readonly remoteAddress?: string;
  readonly remotePort?: number;
  readonly localAddress?: string;
  readonly localPort?: number;
  write(data: Uint8Array | string): boolean;
  end(): void;
  destroy(error?: Error): void;
}

/**
 * Browser-safe subset of Node's `net.Server`.
 * @interface Server
 */
export interface Server {
  listening: boolean;
  address(): string | { port: number; family: string; address: string } | null;
  close(callback?: (err?: Error) => void): void;
}

/**
 * Browser-safe subset of Node's `tls.Server`.
 * @interface TlsServer
 */
export interface TlsServer extends Server {
  addContext(hostname: string, credentials: unknown): void;
}

/**
 * Browser-safe subset of Node's `net.ListenOptions`.
 * @interface ListenOptions
 */
export interface ListenOptions {
  port?: number;
  host?: string;
  path?: string;
  backlog?: number;
  exclusive?: boolean;
  [key: string]: unknown;
}

/**
 * Browser-safe subset of the options accepted when creating a TLS server.
 * @interface TlsServerOptions
 */
export interface TlsServerOptions extends ListenOptions {
  key?: unknown;
  cert?: unknown;
  ca?: unknown;
  [key: string]: unknown;
}

/**
 * Browser-safe subset of Node's `tls.ConnectionOptions`.
 * @interface TlsConnectionOptions
 */
export interface TlsConnectionOptions {
  host?: string;
  port?: number;
  servername?: string;
  [key: string]: unknown;
}

/**
 * Browser-safe subset of Node's `tls.PeerCertificate`.
 * @interface PeerCertificate
 */
export interface PeerCertificate {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  subjectaltname?: string;
  valid_from: string;
  valid_to: string;
  fingerprint: string;
  serialNumber: string;
  raw: Uint8Array;
  [key: string]: unknown;
}
