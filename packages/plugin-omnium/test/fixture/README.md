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

**Gecontroleerd tegen het echte register** (5-11, met het leestoken via een
tijdelijke pod in `tnt-cg--inrichting`):

- De vorm klopt: de lijst onder het meervoud, de doelkolom van een relatie op
  de hub (`edienst_id`, `artefact_id`), en `soort` als getal.
- Alle 40 records hebben een sleutel, alle adressen zijn uniek, en elk adres
  leidt terug naar zijn record:
  - 7 componenten;
  - 2 e-diensten en 2 versies;
  - 17 artefacten;
  - 12 uitrollen.

De echte antwoorden staan niet in git, want er zitten payloads in.
