---- MODULE AsyncWrapper ----
EXTENDS Naturals

\* Model of the rhea-promise async wrapper pattern:
\* - operations add one-shot rhea listeners, a timeout, and optional abort listener;
\* - exactly one terminal event resolves or rejects the promise and removes all resources;
\* - AwaitableSender tracks deliveries in deliveryDispositionMap until a disposition,
\*   timeout, abort, sender_error, or session_error settles the send promise.

CONSTANTS OPS, DELIVERY_IDS

OpStates == {"idle", "pending", "resolved", "rejected"}
DeliveryStates == {"unsent", "pending", "resolved", "rejected"}
OpCauses == {"none", "success", "failure", "timeout", "abort"}
DeliveryCauses == {"none", "accepted", "rejected", "timeout", "abort", "senderOrSessionError"}

VARIABLES
  opState,
  opTerminalCause,
  listeners,
  timers,
  abortListeners,
  actionCount,
  deliveryState,
  deliveryTerminalCause,
  deliveryInMap,
  deliveryTimer,
  deliveryAbortListener

vars ==
  << opState,
     opTerminalCause,
     listeners,
     timers,
     abortListeners,
     actionCount,
     deliveryState,
     deliveryTerminalCause,
     deliveryInMap,
     deliveryTimer,
     deliveryAbortListener >>

Init ==
  /\ opState = [a \in OPS |-> "idle"]
  /\ opTerminalCause = [a \in OPS |-> "none"]
  /\ listeners = [a \in OPS |-> FALSE]
  /\ timers = [a \in OPS |-> FALSE]
  /\ abortListeners = [a \in OPS |-> FALSE]
  /\ actionCount = [a \in OPS |-> 0]
  /\ deliveryState = [d \in DELIVERY_IDS |-> "unsent"]
  /\ deliveryTerminalCause = [d \in DELIVERY_IDS |-> "none"]
  /\ deliveryInMap = [d \in DELIVERY_IDS |-> FALSE]
  /\ deliveryTimer = [d \in DELIVERY_IDS |-> FALSE]
  /\ deliveryAbortListener = [d \in DELIVERY_IDS |-> FALSE]

StartOperation(a) ==
  /\ opState[a] = "idle"
  /\ opState' = [opState EXCEPT ![a] = "pending"]
  /\ opTerminalCause' = [opTerminalCause EXCEPT ![a] = "none"]
  /\ listeners' = [listeners EXCEPT ![a] = TRUE]
  /\ timers' = [timers EXCEPT ![a] = TRUE]
  /\ abortListeners' = [abortListeners EXCEPT ![a] = TRUE]
  /\ actionCount' = [actionCount EXCEPT ![a] = 1]
  /\ UNCHANGED << deliveryState, deliveryTerminalCause, deliveryInMap, deliveryTimer, deliveryAbortListener >>

SettleOperation(a, outcome, cause) ==
  /\ opState[a] = "pending"
  /\ outcome \in {"resolved", "rejected"}
  /\ cause \in OpCauses \ {"none"}
  /\ cause = "success" => outcome = "resolved"
  /\ cause \in {"failure", "timeout", "abort"} => outcome = "rejected"
  /\ opState' = [opState EXCEPT ![a] = outcome]
  /\ opTerminalCause' = [opTerminalCause EXCEPT ![a] = cause]
  /\ listeners' = [listeners EXCEPT ![a] = FALSE]
  /\ timers' = [timers EXCEPT ![a] = FALSE]
  /\ abortListeners' = [abortListeners EXCEPT ![a] = FALSE]
  /\ actionCount' = [actionCount EXCEPT ![a] = 0]
  /\ UNCHANGED << deliveryState, deliveryTerminalCause, deliveryInMap, deliveryTimer, deliveryAbortListener >>

OperationSuccess(a) == SettleOperation(a, "resolved", "success")
OperationFailure(a) == SettleOperation(a, "rejected", "failure")
OperationTimeout(a) == SettleOperation(a, "rejected", "timeout")
OperationAbort(a) == SettleOperation(a, "rejected", "abort")

ResetOperation(a) ==
  /\ opState[a] \in {"resolved", "rejected"}
  /\ opState' = [opState EXCEPT ![a] = "idle"]
  /\ opTerminalCause' = [opTerminalCause EXCEPT ![a] = "none"]
  /\ listeners' = [listeners EXCEPT ![a] = FALSE]
  /\ timers' = [timers EXCEPT ![a] = FALSE]
  /\ abortListeners' = [abortListeners EXCEPT ![a] = FALSE]
  /\ actionCount' = [actionCount EXCEPT ![a] = 0]
  /\ UNCHANGED << deliveryState, deliveryTerminalCause, deliveryInMap, deliveryTimer, deliveryAbortListener >>

Send(d) ==
  /\ deliveryState[d] = "unsent"
  /\ deliveryState' = [deliveryState EXCEPT ![d] = "pending"]
  /\ deliveryTerminalCause' = [deliveryTerminalCause EXCEPT ![d] = "none"]
  /\ deliveryInMap' = [deliveryInMap EXCEPT ![d] = TRUE]
  /\ deliveryTimer' = [deliveryTimer EXCEPT ![d] = TRUE]
  /\ deliveryAbortListener' = [deliveryAbortListener EXCEPT ![d] = TRUE]
  /\ UNCHANGED << opState, opTerminalCause, listeners, timers, abortListeners, actionCount >>

SettleDelivery(d, outcome, cause) ==
  /\ deliveryState[d] = "pending"
  /\ outcome \in {"resolved", "rejected"}
  \* senderOrSessionError is reserved for the bulk default error handler below,
  \* which rejects every pending awaitable send in deliveryDispositionMap.
  /\ cause \in DeliveryCauses \ {"none", "senderOrSessionError"}
  /\ cause = "accepted" => outcome = "resolved"
  /\ cause \in {"rejected", "timeout", "abort"} => outcome = "rejected"
  /\ deliveryState' = [deliveryState EXCEPT ![d] = outcome]
  /\ deliveryTerminalCause' = [deliveryTerminalCause EXCEPT ![d] = cause]
  /\ deliveryInMap' = [deliveryInMap EXCEPT ![d] = FALSE]
  /\ deliveryTimer' = [deliveryTimer EXCEPT ![d] = FALSE]
  /\ deliveryAbortListener' = [deliveryAbortListener EXCEPT ![d] = FALSE]
  /\ UNCHANGED << opState, opTerminalCause, listeners, timers, abortListeners, actionCount >>

DeliveryAccepted(d) == SettleDelivery(d, "resolved", "accepted")
DeliveryRejected(d) == SettleDelivery(d, "rejected", "rejected")
DeliveryTimeout(d) == SettleDelivery(d, "rejected", "timeout")
DeliveryAbort(d) == SettleDelivery(d, "rejected", "abort")

ResetDelivery(d) ==
  /\ deliveryState[d] \in {"resolved", "rejected"}
  /\ deliveryState' = [deliveryState EXCEPT ![d] = "unsent"]
  /\ deliveryTerminalCause' = [deliveryTerminalCause EXCEPT ![d] = "none"]
  /\ deliveryInMap' = [deliveryInMap EXCEPT ![d] = FALSE]
  /\ deliveryTimer' = [deliveryTimer EXCEPT ![d] = FALSE]
  /\ deliveryAbortListener' = [deliveryAbortListener EXCEPT ![d] = FALSE]
  /\ UNCHANGED << opState, opTerminalCause, listeners, timers, abortListeners, actionCount >>

DefaultSenderOrSessionError ==
  /\ \E d \in DELIVERY_IDS : deliveryState[d] = "pending"
  /\ deliveryState' =
       [d \in DELIVERY_IDS |->
          IF deliveryState[d] = "pending" THEN "rejected" ELSE deliveryState[d]]
  /\ deliveryTerminalCause' =
       [d \in DELIVERY_IDS |->
          IF deliveryState[d] = "pending" THEN "senderOrSessionError" ELSE deliveryTerminalCause[d]]
  /\ deliveryInMap' =
       [d \in DELIVERY_IDS |->
          IF deliveryState[d] = "pending" THEN FALSE ELSE deliveryInMap[d]]
  /\ deliveryTimer' =
       [d \in DELIVERY_IDS |->
          IF deliveryState[d] = "pending" THEN FALSE ELSE deliveryTimer[d]]
  /\ deliveryAbortListener' =
       [d \in DELIVERY_IDS |->
          IF deliveryState[d] = "pending" THEN FALSE ELSE deliveryAbortListener[d]]
  /\ UNCHANGED << opState, opTerminalCause, listeners, timers, abortListeners, actionCount >>

Next ==
  \/ \E a \in OPS :
       \/ StartOperation(a)
       \/ OperationSuccess(a)
       \/ OperationFailure(a)
       \/ OperationTimeout(a)
       \/ OperationAbort(a)
       \/ ResetOperation(a)
  \/ \E d \in DELIVERY_IDS :
       \/ Send(d)
       \/ DeliveryAccepted(d)
       \/ DeliveryRejected(d)
       \/ DeliveryTimeout(d)
       \/ DeliveryAbort(d)
       \/ ResetDelivery(d)
  \/ DefaultSenderOrSessionError

Spec ==
  /\ Init
  /\ [][Next]_vars
  \* Timeout actions model the operationTimeoutInSeconds / send timeout fallback.
  \* Under weak fairness, they guarantee pending promises eventually settle even
  \* when no success, AMQP error, or abort event arrives from the environment.
  /\ \A a \in OPS : WF_vars(OperationTimeout(a))
  /\ \A d \in DELIVERY_IDS : WF_vars(DeliveryTimeout(d))

TypeOK ==
  /\ opState \in [OPS -> OpStates]
  /\ opTerminalCause \in [OPS -> OpCauses]
  /\ listeners \in [OPS -> BOOLEAN]
  /\ timers \in [OPS -> BOOLEAN]
  /\ abortListeners \in [OPS -> BOOLEAN]
  /\ actionCount \in [OPS -> 0..1]
  /\ deliveryState \in [DELIVERY_IDS -> DeliveryStates]
  /\ deliveryTerminalCause \in [DELIVERY_IDS -> DeliveryCauses]
  /\ deliveryInMap \in [DELIVERY_IDS -> BOOLEAN]
  /\ deliveryTimer \in [DELIVERY_IDS -> BOOLEAN]
  /\ deliveryAbortListener \in [DELIVERY_IDS -> BOOLEAN]

ActionCounterMatchesPending ==
  \A a \in OPS :
    actionCount[a] = IF opState[a] = "pending" THEN 1 ELSE 0

OperationResourcesMatchPending ==
  \A a \in OPS :
    /\ listeners[a] = (opState[a] = "pending")
    /\ timers[a] = (opState[a] = "pending")
    /\ abortListeners[a] = (opState[a] = "pending")

DeliveryMapMatchesPending ==
  \A d \in DELIVERY_IDS :
    /\ deliveryInMap[d] = (deliveryState[d] = "pending")
    /\ deliveryTimer[d] = (deliveryState[d] = "pending")
    /\ deliveryAbortListener[d] = (deliveryState[d] = "pending")

NoSettledDeliveryInMap ==
  \A d \in DELIVERY_IDS :
    deliveryState[d] \in {"resolved", "rejected"} => ~deliveryInMap[d]

OperationCauseMatchesState ==
  \A a \in OPS :
    /\ opState[a] \in {"idle", "pending"} => opTerminalCause[a] = "none"
    /\ opState[a] \in {"resolved", "rejected"} => opTerminalCause[a] # "none"

DeliveryCauseMatchesState ==
  \A d \in DELIVERY_IDS :
    /\ deliveryState[d] \in {"unsent", "pending"} => deliveryTerminalCause[d] = "none"
    /\ deliveryState[d] \in {"resolved", "rejected"} => deliveryTerminalCause[d] # "none"

DeliveryCauseOutcomeConsistency ==
  \A d \in DELIVERY_IDS :
    /\ deliveryTerminalCause[d] = "accepted" => deliveryState[d] = "resolved"
    /\ deliveryTerminalCause[d] \in {"rejected", "timeout", "abort", "senderOrSessionError"} =>
         deliveryState[d] = "rejected"
    /\ deliveryTerminalCause[d] = "senderOrSessionError" =>
         /\ deliveryState[d] = "rejected"
         /\ ~deliveryInMap[d]
         /\ ~deliveryTimer[d]
         /\ ~deliveryAbortListener[d]

ResourceCleanup ==
  /\ OperationResourcesMatchPending
  /\ DeliveryMapMatchesPending
  /\ NoSettledDeliveryInMap
  /\ OperationCauseMatchesState
  /\ DeliveryCauseMatchesState
  /\ DeliveryCauseOutcomeConsistency

OperationEventuallySettles ==
  \A a \in OPS :
    [](opState[a] = "pending" => <>(opState[a] # "pending"))

DeliveryEventuallySettles ==
  \A d \in DELIVERY_IDS :
    [](deliveryState[d] = "pending" => <>(deliveryState[d] # "pending"))

====
