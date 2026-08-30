# Middlebox scenarios

`layer-b-spec.md` §15 calls load-balancer/proxy/inspection-tool compatibility
*"the single most differentiated item on this whole list, since middlebox
breakage is exactly the kind of thing that shows up in a failed migration
rather than a benchmark chart."*

## What is tested here, and what is not

**Tested:** TCP **passthrough**. Does a proxy that is not even attempting to
inspect the handshake nonetheless damage it? That is the case most likely to
bite a real migration silently, because nobody expects a passthrough proxy to
care what is inside the stream — and larger PQC ClientHellos are exactly what
trips fixed buffer assumptions written when a ClientHello was small.

**Not tested yet:** TLS **termination**. That is a different question — whether
the proxy's own TLS stack supports the group — and folding it into the same
scenario would produce a result nobody could interpret. It needs its own
scenario and its own oqs-enabled proxy build.

**Not tested yet:** DPI / inspection appliances (Suricata and similar). Same
reasoning: a distinct question about a distinct product category.

## A note on reading a pass

A passthrough proxy reporting `negotiated` means *this* proxy, at *this*
version, with *this* config, did not break *this* handshake. It is not a
statement about proxies in general, and the result file records the product and
version so the claim stays that narrow.
