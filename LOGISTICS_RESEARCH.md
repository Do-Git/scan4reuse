# Delivery requirements for clients and logistics partners

The logistics flow has two sides: a client specifies the delivery for a particular good, and a logistics partner accepts the request for review, quotes it or proposes changes. The client reviews the scope and price before accepting. The deployed static preview demonstrates both roles in one browser session.

The website serves the whole of Switzerland. Its planner starts with the user's own item and route. An optional, labelled example applies these requirements to a fragile reclaimed window collected from a Basel materials depot and placed in a Zürich office. The client specifies loading access, a two-person handling request, packaging, a freight lift, an arrival window and building protection. The partner confirms feasibility and enters or adjusts the price. Example dimensions, weight and item value are illustrative; the site makes no route-distance, transit-time or quoted-fare claim.

The business model has two separate fees, as directed by the user: 8% deducted from the sold item transaction value, and 8% deducted from the logistics partner's final agreed delivery price after any accepted adjustments. Each fee uses its own transaction amount.

## Sources and implications

| Source | Practical needs | Implemented in the request |
| --- | --- | --- |
| [TfL / CLOCS Construction Logistics Planning guidance](https://content.tfl.gov.uk/clp-guidance-clocs.pdf) | Coordinate vehicle movements, delivery slots, loading space and site access. | Fixed or flexible scheduling, pickup and delivery windows, access instructions and equipment requirements. |
| [UCL vehicle access requirements](https://www.ucl.ac.uk/staff/task/book-vehicle-access) | Coordinate delivery date, vehicle information, arrival gate, unloading arrangements and site contact. | Site access notes, booking reference, site contact and unloading equipment. |
| [Planzer Homeservice](https://www.planzer.ch/en/transport-en/homeservice/) | Distinguish kerbside transport from placement at the final location; request unpacking, assembly and packaging removal. | Service level, placement, handling crew, assembly and packaging-removal requests. |
| [SMARTdesks delivery questionnaire](https://smartdesks.com/customer-service) | Quote using floor, room, doorway and lift measurements, loading-dock conditions and available moving equipment. | Floors and lifts, door/lift clearances, final room, site-access details and equipment. |
| [RCS commercial furniture, fixtures and equipment logistics](https://www.rcsmoving.com/post/last-mile-delivery) | Plan staging, phased releases, inside placement, protection, installation and documented handover. | Temporary storage/phased delivery, floor/wall protection, assembly and condition-photo/signed-handover options. |

These references inform the product requirements. Requested services are subject to the partner's quote and the client's approval.

## Partner proposal

- Accept the request for review before quoting.
- Keep the client's original requirements visible and unchanged.
- Quote as requested, or clearly propose a different pickup date, delivery date/window, service or approach.
- Break down transport, handling and additional services; show the total, VAT basis, expiry, crew/equipment, inclusions and conditions.
- Return the proposal to the client for acceptance or a revision request.
- Invalidate old proposals when requirements change or a revision is requested; prevent acceptance of expired or superseded quotes.

Client delivery requests are validated by the Node application and retain the same optional details in the static preview. Partner proposals and example agreements are held in memory; live partner accounts, shared request distribution and real bookings are separate integrations.
