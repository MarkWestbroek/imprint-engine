# Ontwerp — embedded editor-demo (W9)

Status: **denkstuk**, juli 2026. Nog niet gebouwd; backlog §5 (could). Vraag:
hoe laten we bezoekers de studio (de pagina-editor) proberen, embedded op een
publieke pagina, zonder account en zonder risico voor echte content?

## De opties

**A. Demo-modus op de productiesite.** Een demo-rol die alleen in drafts mag
werken. Riskant (één vergeten guard en een bezoeker schrijft echt) en de
serverside draft-store is procesgeheugen — duizend bezoekers = duizend
drafts in RAM van de prod-site. Afgevallen.

**B. Client-only demo.** De studio volledig in de browser met een nep-store.
Kan niet zonder grote verbouwing: de widget-viewers zijn async server
components; die draaien per definitie niet client-side. Afgevallen.

**C. Video/guided tour.** Geen echte demo. Hooguit als tussenstap.

**D. Een aparte demo-imprint.** ✅ Voorstel. Een tweede site in het monorepo
(`sites/demo`) met een eigen wegwerp-database, die elke nacht wordt
teruggezet op de seed. De échte studio, échte saves, nul risico — en het
bewijst meteen de kernbelofte van Imprint: *one engine, many imprints*. De
demo is gewoon imprint nummer twee.

## Hoe D eruitziet

1. **`sites/demo`** — kopie van de musicbrain-site met eigen huisstijl
   ("Imprint Demo"), eigen widget-catalogus mag (of dezelfde), eigen
   `DATABASE_URL` naar een aparte database/schema op dezelfde MariaDB.
2. **Auto-login**: route `/try` zet een sessie voor de vaste gebruiker
   `demo` (rol editor) en stuurt door naar de studio van één speelpagina.
   Geen wachtwoordscherm; de sessie is de bestaande HMAC-cookie met korte
   looptijd (bijv. 2u).
3. **Nachtelijke reset**: Plesk Scheduled Task —
   `npm run db:seed -- --site=demo` op een lege database (truncate + seed).
   Alles wat bezoekers bouwden is de volgende ochtend weg; dat ís de feature.
4. **Embed op musicbrain.nl**: een `demo`-pagina met een iframe naar
   `demo.<domein>/try` plus een regel uitleg ("speeltuin, wordt elke nacht
   geveegd"). De bestaande `embed`-widget kan dit al; hooguit een
   `allow-same-origin`-sandbox-attribuut toevoegen.
5. **Vangrails**: INGEST_TOKEN leeg (geen machine-writes), uploads uit of
   klein gemaximeerd, `robots: noindex`, rate-limit op de save-action.

## Waarom dit de goedkope route is

Er is geen demo-specifieke code in de engine nodig: multi-site is het
bestaansrecht van het monorepo, seed + scheduled task bestaan, auth bestaat.
Nieuwbouw beperkt zich tot de `/try`-route (S), een tweede site-map (M,
grotendeels kopiëren) en één cron-regel (S).

## Open vragen voor Mark

1. Subdomein: `demo.musicbrain.nl` of iets neutraals zodra de engine een
   eigen site krijgt (`try.imprint.…`)? (Plesk kan beide.)
2. Mag de demo de MusicBrain-content als speelmateriaal tonen, of liever
   neutrale voorbeeldcontent?
3. Wanneer: pas na W1/W4 (de must-haves) of eerder als verkoopverhaal?
