## API Report File for "rhea-promise"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

/// <reference types="node" />

import { AmqpError } from 'rhea';
import { Connection as Connection_2 } from 'rhea';
import { ConnectionError } from 'rhea';
import { ConnectionEvents } from 'rhea';
import { ConnectionOptions as ConnectionOptions_2 } from 'tls';
import { ConnectionOptions as ConnectionOptionsBase } from 'rhea';
import { Container as Container_2 } from 'rhea';
import { ContainerOptions as ContainerOptionsBase } from 'rhea';
import { Delivery } from 'rhea';
import { DeliveryAnnotations } from 'rhea';
import { Dictionary } from 'rhea';
import { EndpointOptions } from 'rhea';
import { EventEmitter } from 'events';
import { Filter } from 'rhea';
import { filter } from 'rhea';
import { generate_uuid } from 'rhea';
import { link } from 'rhea';
import { LinkError } from 'rhea';
import { LinkOptions } from 'rhea';
import { ListenOptions } from 'net';
import { Message } from 'rhea';
import { message } from 'rhea';
import { MessageAnnotations } from 'rhea';
import { MessageHeader } from 'rhea';
import { MessageProperties } from 'rhea';
import { MessageUtil } from 'rhea';
import { PeerCertificate } from 'tls';
import { ProtocolError } from 'rhea';
import { Receiver as Receiver_2 } from 'rhea';
import { ReceiverEvents } from 'rhea';
import { ReceiverOptions as ReceiverOptions_2 } from 'rhea';
import { EventContext as RheaEventContext } from 'rhea';
import { Sasl } from 'rhea';
import { Sender as Sender_2 } from 'rhea';
import { SenderEvents } from 'rhea';
import { SenderOptions as SenderOptions_2 } from 'rhea';
import { Server } from 'net';
import { Server as Server_2 } from 'tls';
import { Session as Session_2 } from 'rhea';
import { SessionEvents } from 'rhea';
import { SimpleError } from 'rhea';
import { Socket } from 'net';
import { Source } from 'rhea';
import { string_to_uuid } from 'rhea';
import { TargetTerminusOptions } from 'rhea';
import { TerminusOptions } from 'rhea';
import { TlsOptions } from 'tls';
import { TlsServerConnectionOptions } from 'rhea/typings/connection';
import { Typed } from 'rhea';
import { TypeError as TypeError_2 } from 'rhea';
import { Types } from 'rhea';
import { types } from 'rhea';
import { uuid_to_string } from 'rhea';
import { WebSocketImpl } from 'rhea';
import { WebSocketInstance } from 'rhea';

export { AmqpError }

// @public
export enum AmqpResponseStatusCode {
    // (undocumented)
    Accepted = 202,
    // (undocumented)
    Ambiguous = 300,
    // (undocumented)
    BadGateway = 502,
    // (undocumented)
    BadRequest = 400,
    // (undocumented)
    Conflict = 409,
    // (undocumented)
    Continue = 100,
    // (undocumented)
    Created = 201,
    // (undocumented)
    ExpectationFailed = 417,
    // (undocumented)
    Forbidden = 403,
    // (undocumented)
    Found = 302,
    // (undocumented)
    GatewayTimeout = 504,
    // (undocumented)
    Gone = 410,
    // (undocumented)
    HttpVersionNotSupported = 505,
    // (undocumented)
    InternalServerError = 500,
    // (undocumented)
    LengthRequired = 411,
    // (undocumented)
    MethodNotAllowed = 405,
    // (undocumented)
    Moved = 301,
    // (undocumented)
    MovedPermanently = 301,
    // (undocumented)
    MultipleChoices = 300,
    // (undocumented)
    NoContent = 204,
    // (undocumented)
    NonAuthoritativeInformation = 203,
    // (undocumented)
    NotAcceptable = 406,
    // (undocumented)
    NotFound = 404,
    // (undocumented)
    NotImplemented = 501,
    // (undocumented)
    NotModified = 304,
    // (undocumented)
    OK = 200,
    // (undocumented)
    PartialContent = 206,
    // (undocumented)
    PaymentRequired = 402,
    // (undocumented)
    PreconditionFailed = 412,
    // (undocumented)
    ProxyAuthenticationRequired = 407,
    // (undocumented)
    Redirect = 302,
    // (undocumented)
    RedirectKeepVerb = 307,
    // (undocumented)
    RedirectMethod = 303,
    // (undocumented)
    RequestedRangeNotSatisfiable = 416,
    // (undocumented)
    RequestEntityTooLarge = 413,
    // (undocumented)
    RequestTimeout = 408,
    // (undocumented)
    RequestUriTooLong = 414,
    // (undocumented)
    ResetContent = 205,
    // (undocumented)
    SeeOther = 303,
    // (undocumented)
    ServiceUnavailable = 503,
    // (undocumented)
    SwitchingProtocols = 101,
    // (undocumented)
    TemporaryRedirect = 307,
    // (undocumented)
    Unauthorized = 401,
    // (undocumented)
    UnsupportedMediaType = 415,
    // (undocumented)
    Unused = 306,
    // (undocumented)
    UpgradeRequired = 426,
    // (undocumented)
    UseProxy = 305
}

// @public
export interface AwaitableSender {
    // (undocumented)
    on(event: SenderEvents, listener: OnAmqpEvent): this;
}

// Warning: (ae-forgotten-export) The symbol "BaseSender" needs to be exported by the entry point index.d.ts
//
// @public
export class AwaitableSender extends BaseSender {
    constructor(session: Session, sender: Sender_2, options?: AwaitableSenderOptions);
    deliveryDispositionMap: Map<number, PromiseLike_2>;
    send(msg: Message | Buffer, options?: AwaitableSendOptions): Promise<Delivery>;
}

// Warning: (ae-forgotten-export) The symbol "BaseSenderOptions" needs to be exported by the entry point index.d.ts
//
// @public (undocumented)
export type AwaitableSenderOptions = BaseSenderOptions;

// @public (undocumented)
export interface AwaitableSendOptions {
    // Warning: (ae-forgotten-export) The symbol "AbortSignalLike" needs to be exported by the entry point index.d.ts
    abortSignal?: AbortSignalLike;
    format?: number;
    tag?: Buffer | string;
    timeoutInSeconds?: number;
}

// @public
export interface Connection {
    // (undocumented)
    on(event: ConnectionEvents, listener: OnAmqpEvent): this;
}

// Warning: (ae-forgotten-export) The symbol "Entity" needs to be exported by the entry point index.d.ts
//
// @public
export class Connection extends Entity {
    // Warning: (ae-forgotten-export) The symbol "CreatedRheaConnectionOptions" needs to be exported by the entry point index.d.ts
    constructor(options?: ConnectionOptions | CreatedRheaConnectionOptions);
    get channelMax(): number | undefined;
    // Warning: (ae-forgotten-export) The symbol "ConnectionCloseOptions" needs to be exported by the entry point index.d.ts
    close(options?: ConnectionCloseOptions): Promise<void>;
    readonly container: Container;
    createAwaitableSender(options?: CreateAwaitableSenderOptions): Promise<AwaitableSender>;
    createReceiver(options?: CreateReceiverOptions): Promise<Receiver>;
    createRequestResponseLink(senderOptions: SenderOptions, receiverOptions: ReceiverOptions, options?: CreateRequestResponseLinkOptions): Promise<ReqResLink>;
    createSender(options?: CreateSenderOptions): Promise<Sender>;
    // Warning: (ae-forgotten-export) The symbol "SessionCreateOptions" needs to be exported by the entry point index.d.ts
    createSession(options?: SessionCreateOptions): Promise<Session>;
    get error(): AmqpError | Error | undefined;
    getError(): ConnectionError | undefined;
    getPeerCertificate(): PeerCertificate | undefined;
    getTlsSocket(): Socket | undefined;
    get id(): string;
    get idleTimeout(): number | undefined;
    isOpen(): boolean;
    isRemoteOpen(): boolean;
    get maxFrameSize(): number | undefined;
    // Warning: (ae-forgotten-export) The symbol "ConnectionOpenOptions" needs to be exported by the entry point index.d.ts
    open(options?: ConnectionOpenOptions): Promise<Connection>;
    options: ConnectionOptions;
    get properties(): Dictionary<any> | undefined;
    removeAllSessions(): void;
    removeSession(session: Session): void;
    wasCloseInitiated(): boolean;
}

export { ConnectionError }

export { ConnectionEvents }

// @public
export type ConnectionOptions = ConnectionOptionsBase & {
    operationTimeoutInSeconds?: number;
    webSocketOptions?: {
        webSocket: any;
        url: string;
        protocol: string[];
        options?: any;
    };
};

export { ConnectionOptionsBase }

// @public
export interface ConnectionStringParseOptions {
    entitySeperator?: string;
    keyValueSeparator?: string;
}

// @public
export class Container extends EventEmitter {
    constructor(options?: ContainerOptions);
    // (undocumented)
    connect(options?: ConnectionOptions): Promise<Connection>;
    // (undocumented)
    static copyFromContainerInstance(instance: Container_2): Container;
    // (undocumented)
    static create(options?: ContainerOptionsBase): Container;
    // (undocumented)
    createConnection(options?: ConnectionOptions): Connection;
    // (undocumented)
    get filter(): Filter;
    // (undocumented)
    generateUUid(): string;
    // (undocumented)
    get id(): string;
    // (undocumented)
    listen(options: ListenOptions | TlsOptions & TlsServerConnectionOptions): Server | Server_2;
    // (undocumented)
    get message(): MessageUtil;
    options: ContainerOptions;
    // (undocumented)
    get sasl(): Sasl;
    // (undocumented)
    get saslServerMechanisms(): any;
    // (undocumented)
    stringToUuid(uuidString: string): Buffer;
    // (undocumented)
    get types(): Types;
    // (undocumented)
    uuidToString(buffer: Buffer): string;
    // (undocumented)
    websocketAccept(socket: Socket, options: ConnectionOptions_2): void;
    // (undocumented)
    websocketConnect(impl: any): any;
}

// @public
export interface ContainerOptions extends ContainerOptionsBase {
    // (undocumented)
    createdInstance?: Container_2;
}

export { ContainerOptionsBase }

// @public
export interface CreateAwaitableSenderOptions extends AwaitableSenderOptions {
    abortSignal?: AbortSignalLike;
    // (undocumented)
    session?: Session;
}

// @public
export interface CreateReceiverOptions extends ReceiverOptions {
    abortSignal?: AbortSignalLike;
    // (undocumented)
    session?: Session;
}

// @public
export interface CreateRequestResponseLinkOptions {
    abortSignal?: AbortSignalLike;
    // (undocumented)
    session?: Session;
}

// @public
export interface CreateSenderOptions extends SenderOptions {
    abortSignal?: AbortSignalLike;
    // (undocumented)
    session?: Session;
}

// @public
export function delay<T>(t: number, value?: T): Promise<T | void>;

export { Delivery }

export { DeliveryAnnotations }

export { Dictionary }

export { EndpointOptions }

// @public
export interface EventContext {
    connection: Connection;
    container: Container;
    _context: RheaEventContext;
    delivery?: Delivery;
    error?: Error | ConnectionError;
    message?: Message;
    receiver?: Receiver;
    reconnecting?: boolean;
    sender?: Sender;
    session?: Session;
}

// @public (undocumented)
export namespace EventContext {
    // Warning: (ae-forgotten-export) The symbol "Link" needs to be exported by the entry point index.d.ts
    export function translate(rheaContext: RheaEventContext, emitter: Link | Session | Connection, eventName: string): EventContext;
}

export { Filter }

export { filter }

// @public
export type Func<T, V> = (a: T) => V;

export { generate_uuid }

// @public
export class InsufficientCreditError extends Error {
    constructor(message: string);
    readonly name: string;
}

// @public
export function isAmqpError(err: any): boolean;

// @public
export interface LinkCloseOptions {
    closeSession?: boolean;
}

export { LinkError }

export { LinkOptions }

export { Message }

export { message }

export { MessageAnnotations }

export { MessageHeader }

// @public
export const messageHeader: string[];

export { MessageProperties }

// @public
export const messageProperties: string[];

export { MessageUtil }

// @public
export type OnAmqpEvent = (context: EventContext) => void;

// @public
export class OperationTimeoutError extends Error {
    constructor(message: string);
    readonly name: string;
}

// @public
export function parseConnectionString<T>(connectionString: string, options?: ConnectionStringParseOptions): ParsedOutput<T>;

// @public
export type ParsedOutput<T> = {
    [P in keyof T]: T[P];
};

// @public
interface PromiseLike_2 {
    // (undocumented)
    reject: (reason?: any) => void;
    // (undocumented)
    resolve: (value?: any) => void;
    // (undocumented)
    timer: NodeJS.Timer;
}
export { PromiseLike_2 as PromiseLike }

export { ProtocolError }

// @public
export interface Receiver {
    // (undocumented)
    on(event: ReceiverEvents, listener: OnAmqpEvent): this;
}

// @public
export class Receiver extends Link {
    constructor(session: Session, receiver: Receiver_2, options?: ReceiverOptions);
    // (undocumented)
    addCredit(credit: number): void;
    // (undocumented)
    get drain(): boolean;
    set drain(value: boolean);
    // (undocumented)
    drainCredit(): void;
    // (undocumented)
    setCreditWindow(creditWindow: number): void;
}

export { ReceiverEvents }

// @public
export interface ReceiverOptions extends ReceiverOptions_2 {
    onClose?: OnAmqpEvent;
    onError?: OnAmqpEvent;
    onMessage?: OnAmqpEvent;
    onSessionClose?: OnAmqpEvent;
    onSessionError?: OnAmqpEvent;
    onSettled?: OnAmqpEvent;
}

// @public
export interface ReqResLink {
    receiver: Receiver;
    sender: Sender;
    session: Session;
}

export { RheaEventContext }

export { Sasl }

// @public
export interface Sender {
    // (undocumented)
    on(event: SenderEvents, listener: OnAmqpEvent): this;
}

// @public
export class Sender extends BaseSender {
    constructor(session: Session, sender: Sender_2, options?: SenderOptions);
    send(msg: Message | Buffer, options?: SenderSendOptions): Delivery;
}

export { SenderEvents }

// @public
export interface SenderOptions extends BaseSenderOptions {
    onAccepted?: OnAmqpEvent;
    onModified?: OnAmqpEvent;
    onRejected?: OnAmqpEvent;
    onReleased?: OnAmqpEvent;
}

// @public (undocumented)
export class SenderSendOptions {
    format?: number;
    tag?: Buffer | string;
}

// @public
export class SendOperationFailedError extends Error {
    constructor(
    message: string,
    code: "rejected" | "released" | "modified" | "sender_error" | "session_error",
    innerError?: Error | undefined);
    readonly code: "rejected" | "released" | "modified" | "sender_error" | "session_error";
    readonly innerError?: Error | undefined;
    readonly message: string;
    readonly name: string;
}

// @public
export interface Session {
    // (undocumented)
    on(event: SessionEvents, listener: OnAmqpEvent): this;
}

// @public
export class Session extends Entity {
    constructor(connection: Connection, session: Session_2);
    // (undocumented)
    begin(): void;
    // Warning: (ae-forgotten-export) The symbol "SessionCloseOptions" needs to be exported by the entry point index.d.ts
    close(options?: SessionCloseOptions): Promise<void>;
    get connection(): Connection;
    createAwaitableSender(options?: AwaitableSenderOptions & {
        abortSignal?: AbortSignalLike;
    }): Promise<AwaitableSender>;
    createReceiver(options?: ReceiverOptions & {
        abortSignal?: AbortSignalLike;
    }): Promise<Receiver>;
    createSender(options?: SenderOptions & {
        abortSignal?: AbortSignalLike;
    }): Promise<Sender>;
    // (undocumented)
    get error(): AmqpError | Error | undefined;
    get id(): string;
    // (undocumented)
    get incoming(): {
        deliveries: {
            size: number;
            capacity: number;
        };
    };
    isClosed(): boolean;
    isItselfClosed(): boolean;
    isOpen(): boolean;
    // (undocumented)
    get outgoing(): any;
    remove(): void;
}

export { SessionEvents }

export { SimpleError }

export { Source }

export { string_to_uuid }

export { TargetTerminusOptions }

export { TerminusOptions }

export { Typed }

export { TypeError_2 as TypeError }

export { Types }

export { types }

export { uuid_to_string }

export { WebSocketImpl }

export { WebSocketInstance }

// (No @packageDocumentation comment for this package)

```
