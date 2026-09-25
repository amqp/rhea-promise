---- MODULE AsyncWrapper ----
EXTENDS Naturals

\* Model of the rhea-promise async wrapper pattern:
\* - operations add one-shot rhea listeners, a timeout, and optional abort listener;
\* - exactly one terminal event resolves or rejects the promise and removes all resources;
\* - AwaitableSender tracks deliveries in deliveryDispositionMap until a disposition,
\*   timeout, abort, sender_error, or session_error settles the send promise.

CONSTANTS ACTIONS, DELIVERIES

OpStates == {"idle", "pending", "resolved", "rejected"}
DeliveryStates == {"unsent", "pending", "resolved", "rejected"}

VARIABLES
  opState,
  listeners,
  timers,
  abortListeners,
  actionCount,
  deliveryState,
  deliveryInMap,
  deliveryTimer,
  deliveryAbortListener

vars ==
  << opState,
     listeners,
     timers,
     abortListeners,
     actionCount,
     deliveryState,
     deliveryInMap,
     deliveryTimer,
     deliveryAbortListener >>

Init ==
  /\ opState = [a \in ACTIONS |-> "idle"]
  /\ listeners = [a \in ACTIONS |-> FALSE]
  /\ timers = [a \in ACTIONS |-> FALSE]
  /\ abortListeners = [a \in ACTIONS |-> FALSE]
  /\ actionCount = [a \in ACTIONS |-> 0]
  /\ deliveryState = [d \in DELIVERIES |-> "unsent"]
  /\ deliveryInMap = [d \in DELIVERIES |-> FALSE]
  /\ deliveryTimer = [d \in DELIVERIES |-> FALSE]
  /\ deliveryAbortListener = [d \in DELIVERIES |-> FALSE]

StartOperation(a) ==
  /\ opState[a] # "pending"
  /\ opState' = [opState EXCEPT ![a] = "pending"]
  /\ listeners' = [listeners EXCEPT ![a] = TRUE]
  /\ timers' = [timers EXCEPT ![a] = TRUE]
  /\ abortListeners' = [abortListeners EXCEPT ![a] = TRUE]
  /\ actionCount' = [actionCount EXCEPT ![a] = 1]
  /\ UNCHANGED << deliveryState, deliveryInMap, deliveryTimer, deliveryAbortListener >>

SettleOperation(a, outcome) ==
  /\ opState[a] = "pending"
  /\ outcome \in {"resolved", "rejected"}
  /\ opState' = [opState EXCEPT ![a] = outcome]
  /\ listeners' = [listeners EXCEPT ![a] = FALSE]
  /\ timers' = [timers EXCEPT ![a] = FALSE]
  /\ abortListeners' = [abortListeners EXCEPT ![a] = FALSE]
  /\ actionCount' = [actionCount EXCEPT ![a] = 0]
  /\ UNCHANGED << deliveryState, deliveryInMap, deliveryTimer, deliveryAbortListener >>

OperationSuccess(a) == SettleOperation(a, "resolved")
OperationFailure(a) == SettleOperation(a, "rejected")
OperationTimeout(a) == SettleOperation(a, "rejected")
OperationAbort(a) == SettleOperation(a, "rejected")

Send(d) ==
  /\ deliveryState[d] # "pending"
  /\ deliveryState' = [deliveryState EXCEPT ![d] = "pending"]
  /\ deliveryInMap' = [deliveryInMap EXCEPT ![d] = TRUE]
  /\ deliveryTimer' = [deliveryTimer EXCEPT ![d] = TRUE]
  /\ deliveryAbortListener' = [deliveryAbortListener EXCEPT ![d] = TRUE]
  /\ UNCHANGED << opState, listeners, timers, abortListeners, actionCount >>

SettleDelivery(d, outcome) ==
  /\ deliveryState[d] = "pending"
  /\ outcome \in {"resolved", "rejected"}
  /\ deliveryState' = [deliveryState EXCEPT ![d] = outcome]
  /\ deliveryInMap' = [deliveryInMap EXCEPT ![d] = FALSE]
  /\ deliveryTimer' = [deliveryTimer EXCEPT ![d] = FALSE]
  /\ deliveryAbortListener' = [deliveryAbortListener EXCEPT ![d] = FALSE]
  /\ UNCHANGED << opState, listeners, timers, abortListeners, actionCount >>

DeliveryAccepted(d) == SettleDelivery(d, "resolved")
DeliveryRejected(d) == SettleDelivery(d, "rejected")
DeliveryTimeout(d) == SettleDelivery(d, "rejected")
DeliveryAbort(d) == SettleDelivery(d, "rejected")

DefaultSenderOrSessionError ==
  /\ \E d \in DELIVERIES : deliveryState[d] = "pending"
  /\ deliveryState' =
       [d \in DELIVERIES |->
          IF deliveryState[d] = "pending" THEN "rejected" ELSE deliveryState[d]]
  /\ deliveryInMap' =
       [d \in DELIVERIES |->
          IF deliveryState[d] = "pending" THEN FALSE ELSE deliveryInMap[d]]
  /\ deliveryTimer' =
       [d \in DELIVERIES |->
          IF deliveryState[d] = "pending" THEN FALSE ELSE deliveryTimer[d]]
  /\ deliveryAbortListener' =
       [d \in DELIVERIES |->
          IF deliveryState[d] = "pending" THEN FALSE ELSE deliveryAbortListener[d]]
  /\ UNCHANGED << opState, listeners, timers, abortListeners, actionCount >>

Next ==
  \/ \E a \in ACTIONS :
       \/ StartOperation(a)
       \/ OperationSuccess(a)
       \/ OperationFailure(a)
       \/ OperationTimeout(a)
       \/ OperationAbort(a)
  \/ \E d \in DELIVERIES :
       \/ Send(d)
       \/ DeliveryAccepted(d)
       \/ DeliveryRejected(d)
       \/ DeliveryTimeout(d)
       \/ DeliveryAbort(d)
  \/ DefaultSenderOrSessionError

Spec ==
  /\ Init
  /\ [][Next]_vars
  /\ \A a \in ACTIONS : WF_vars(OperationTimeout(a))
  /\ \A d \in DELIVERIES : WF_vars(DeliveryTimeout(d))

TypeOK ==
  /\ opState \in [ACTIONS -> OpStates]
  /\ listeners \in [ACTIONS -> BOOLEAN]
  /\ timers \in [ACTIONS -> BOOLEAN]
  /\ abortListeners \in [ACTIONS -> BOOLEAN]
  /\ actionCount \in [ACTIONS -> 0..1]
  /\ deliveryState \in [DELIVERIES -> DeliveryStates]
  /\ deliveryInMap \in [DELIVERIES -> BOOLEAN]
  /\ deliveryTimer \in [DELIVERIES -> BOOLEAN]
  /\ deliveryAbortListener \in [DELIVERIES -> BOOLEAN]

ActionCounterMatchesPending ==
  \A a \in ACTIONS :
    actionCount[a] = IF opState[a] = "pending" THEN 1 ELSE 0

OperationResourcesMatchPending ==
  \A a \in ACTIONS :
    /\ listeners[a] = (opState[a] = "pending")
    /\ timers[a] = (opState[a] = "pending")
    /\ abortListeners[a] = (opState[a] = "pending")

DeliveryMapMatchesPending ==
  \A d \in DELIVERIES :
    /\ deliveryInMap[d] = (deliveryState[d] = "pending")
    /\ deliveryTimer[d] = (deliveryState[d] = "pending")
    /\ deliveryAbortListener[d] = (deliveryState[d] = "pending")

NoSettledDeliveryInMap ==
  \A d \in DELIVERIES :
    deliveryState[d] \in {"resolved", "rejected"} => ~deliveryInMap[d]

ResourceCleanup ==
  /\ OperationResourcesMatchPending
  /\ DeliveryMapMatchesPending
  /\ NoSettledDeliveryInMap

OperationEventuallySettles ==
  \A a \in ACTIONS :
    [](opState[a] = "pending" => <>(opState[a] # "pending"))

DeliveryEventuallySettles ==
  \A d \in DELIVERIES :
    [](deliveryState[d] = "pending" => <>(deliveryState[d] # "pending"))

====
