// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import {
  Container as RheaContainer, ContainerOptions as ContainerOptionsBase, create_container,
  Filter, Types, MessageUtil, Sasl
} from "rhea";
import { EventEmitter } from "events";
import { ConnectionOptions, Connection } from './connection';
import { TlsOptions, Server as TlsServer, ConnectionOptions as TlsConnectionOptions } from "tls";
import { ListenOptions, Server, Socket } from "net";
import { TlsServerConnectionOptions } from "rhea/typings/connection";

/**
 * Descibes the options that can be provided while creating the Container.
 * @interface ContainerOptions
 */
export interface ContainerOptions extends ContainerOptionsBase {
  createdInstance?: RheaContainer;
}

/**
 * An AMQP container from which outgoing connections can be made and/or
 * to which incoming connections can be accepted.
 * @class Container
 */
export class Container extends EventEmitter {
  /**
   * @property {options} ContainerOptions Container options.
   */
  options: ContainerOptions;
  /**
   * @property {RheaContainer} _container The underlying container object from rhea.
   * @private
   */
  private _container: RheaContainer;

  constructor(options?: ContainerOptions) {
    if (!options) options = {};
    super();
    if (options.createdInstance) {
      this._container = options.createdInstance;
      delete options.createdInstance;
    } else {
      this._container = create_container(options);
    }

    this.options = this._container.options;
  }

  get id(): string {
    return this._container.id;
  }

  get filter(): Filter {
    return this._container.filter;
  }

  get types(): Types {
    return this._container.types;
  }

  get message(): MessageUtil {
    return this._container.message;
  }

  get sasl(): Sasl {
    return this._container.sasl;
  }

  get saslServerMechanisms(): any {
    return this._container.sasl_server_mechanisms;
  }

  createConnection(options?: ConnectionOptions): Connection {
    const rheaConnection = this._container.create_connection(options);
    return new Connection({ rheaConnection: rheaConnection, container: this });
  }

  async connect(options?: ConnectionOptions): Promise<Connection> {
    return this.createConnection(options).open();
  }

  listen(options: ListenOptions | TlsOptions & TlsServerConnectionOptions): Server | TlsServer {
    return this._container.listen(options);
  }

  generateUUid(): string {
    return this._container.generate_uuid();
  }

  stringToUuid(uuidString: string): Buffer {
    return this._container.string_to_uuid(uuidString);
  }

  uuidToString(buffer: Buffer): string {
    return this._container.uuid_to_string(buffer);
  }

  websocketAccept(socket: Socket, options: TlsConnectionOptions): void {
    return this._container.websocket_accept(socket, options);
  }

  websocketConnect(impl: any): any {
    return this._container.websocket_connect(impl);
  }

  static create(options?: ContainerOptionsBase): Container {
    return new Container(options);
  }

  static copyFromContainerInstance(instance: RheaContainer): Container {
    return new Container({ createdInstance: instance });
  }
}
