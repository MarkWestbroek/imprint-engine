# Fixture: het inrichtingsregister

`full/<pad>.json` bevat de records zoals `GET /full/<pad>` ze teruggeeft. Elk
gegevenselement en elke relatie is een array van hubs, met de versies onder
`data`. Een `afvoer` betekent ingetrokken.

**Synthetisch** (5-11-2026). De namen komen uit het inrichtingsmodel
(`omnium-model-cg-test-v3.json` in de Omnium-repo), de vorm uit de
register-code (`full_handlers.go`). Er staan bewust een paar lastige gevallen
in:

- een ingetrokken versienummer;
- hetzelfde versienummer bij twee e-diensten;
- de identifier `aanvraag` bij twee artefacten;
- een ingetrokken traceregel;
- een zelfrelatie (`doel_artefact_id`).

Vervang dit door een vastgelegd antwoord van het register zodra het
leesaccount er is. Haal er daarbij inhoud uit die niet openbaar mag.
