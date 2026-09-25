# TLA+ model for async wrapper behavior

`AsyncWrapper.tla` is an executable TLA+ model of the async wrapper pattern used by rhea-promise around rhea events.

The model focuses on the safety and liveness properties shared by:

- `Connection.open()` / `Connection.close()` in `lib/connection.ts`
- `Session.close()`, `Session.createReceiver()`, `Session.createSender()`, and `Session.createAwaitableSender()` in `lib/session.ts`
- `Link.close()` in `lib/link.ts`
- `AwaitableSender.send()` in `lib/awaitableSender.ts`

It checks that each pending operation or send has matching promise-completion resources:

- one action in progress,
- rhea listeners,
- timeout,
- abort listener when modeled,
- and, for sends, one `deliveryDispositionMap` entry.

Terminal outcomes model and track distinct causes for success, AMQP error events, timeout, abort, and the default `sender_error` / `session_error` behavior that rejects all pending awaitable sends.

## Running TLC

Install or download `tla2tools.jar`, then run:

```bash
java -cp /path/to/tla2tools.jar tlc2.TLC tla/AsyncWrapper.tla -config tla/AsyncWrapper.cfg
```

The bundled configuration uses three representative async wrapper operation symbols (`ConnOpen`, `SessClose`, and `LinkClose`) and two in-flight deliveries so TLC completes quickly. The operation symbols are interchangeable representatives of the shared wrapper lifecycle; replace or extend `OPS` with names such as `CreateSender`, `CreateReceiver`, or `CreateAwaitableSender` to label a larger model. Increase `DELIVERY_IDS` to explore more concurrent sends.

## Verified properties

The TLC configuration checks:

- `TypeOK`: all variables remain in their expected finite domains.
- `ActionCounterMatchesPending`: `actionInitiated` is `1` exactly while an operation is pending and `0` after cleanup.
- `OperationResourcesMatchPending`: operation listeners, timers, and abort listeners exist exactly while the wrapper operation is pending.
- `DeliveryMapMatchesPending`: delivery map entries, timers, and abort listeners exist exactly while an awaitable send is pending.
- `NoSettledDeliveryInMap`: settled deliveries are removed from the modeled `deliveryDispositionMap`.
- `OperationCauseMatchesState`, `DeliveryCauseMatchesState`, and `DeliveryCauseOutcomeConsistency`: terminal causes match lifecycle states and outcomes.
- `OperationEventuallySettles`: every pending wrapper operation eventually leaves `pending`.
- `DeliveryEventuallySettles`: every pending awaitable send eventually leaves `pending`.

This model is intentionally small and abstracts away AMQP frame details. It verifies the repository's event-to-promise lifecycle invariants rather than proving byte-for-byte equivalence with rhea internals.
