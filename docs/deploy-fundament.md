# Een Imprint-site op Fundament (Kubernetes)

Naast de VPS ([deploy-vps.md](deploy-vps.md)) kan een site op het
Fundament-cluster draaien (cg-test, `*.fundament.common-ground-lab.nl`).
De eerste is de inrichtings-UI op het Omnium-register
([design/omnium-inrichting.md](design/omnium-inrichting.md)), werktitel
`inrichting.fundament.common-ground-lab.nl`. De manifesten staan in
[`deploy/k8s/`](../deploy/k8s/) (kustomize, ingebouwd in `kubectl`).

> **Stand (6-11-2026):** de site draait op
> https://inrichting.fundament.common-ground-lab.nl, met image
> `0.15.0-cf280c0` (registerschema v7, werkplaats Fase A, proefbewerken en opslaan in de Studio-branch). Migratie en beginteksten staan in de database. De pod leest
> het register met `omnium-lezer`. De backup neemt de database mee, en ook de
> bucket zodra FUNDAMENT `ensure-backup-secret.ps1` heeft gedraaid.

## Hoe het cluster het doet (gezien bij Omnium)

```mermaid
flowchart LR
    U["browser"] --> GW["Gateway web<br/>(tnt-cg--test, TLS fundament-tls)"]
    GW -- "HTTPRoute imprint" --> S["Deployment imprint<br/>(tnt-cg--inrichting)"]
    S --> PG[("pg-main (CloudNativePG)<br/>tnt-cg--db, database inrichting")]
    S --> B[("Ceph-bucket<br/>ObjectBucketClaim imprint")]
    S -- "intern" --> OA["omnium-api<br/>(tnt-cg--omnium)"]
    S -- "intern" --> OR["omnium-render-svc"]
```

- Per toepassing een namespace `tnt-cg--<naam>`.
- Images van Docker Hub (`markwestbroek/…`).
- Verkeer via een HTTPRoute op de gedeelde Gateway `web` in `tnt-cg--test`.
  TLS komt uit één certificaat (`fundament`, Let's Encrypt) met alle hostnamen.
- Eén Postgres-cluster `pg-main` met per toepassing een `Database`-object en
  een rol in `spec.managed.roles`.
- Bestanden in Ceph-objectopslag (`cephobj-cg`), niet op een lokaal volume. De
  standaard-storageclass `csi-lvm` is node-lokaal: bij het vervangen van de
  nodes op 3-11 ging zo de registerdatabase verloren.

## Wat de manifesten doen

| Bestand | Wat |
|---|---|
| `base/deployment.yaml` | de standalone Next-server (poort 3000), niet als root, uploads naar de bucket |
| `base/service.yaml`, `base/httproute.yaml` | service en route op de gateway |
| `base/bucket.yaml` | ObjectBucketClaim; Rook maakt een ConfigMap en Secret `imprint` met host en sleutels |
| `tools/migrate-job.yaml` | `npm run db:migrate:pg` met het tools-image |
| `inrichting/` | namespace, hostnaam, images, `OMNIUM_REGISTER_URL` en `OMNIUM_URL` (binnen het cluster), het token uit Secret `omnium-lezer` |

Geen geheimen in git. De Secret `imprint-env` maak je met de hand.

## Eerste keer

Stap 1–3 raken gedeelde objecten en staan in de **Fundament-repo** (commit
f41e8e7); FUNDAMENT voert ze uit. Bij een herstel of reset van het cluster
komen ze ook daar vandaan, dus niet dubbel bijhouden in deze repo.

1. **Namespace**: `functl namespace create --project=<cg> inrichting` →
   `tnt-cg--inrichting`.
2. **Database**: rol `inrichting` in `pg-main` (`spec.managed.roles`,
   `passwordSecret` `pg-inrichting`, met een willekeurig wachtwoord van
   `ensure-db-secrets.ps1`); de `Database` `inrichting` in
   `k8s/30-postgres/databases.yaml`. Daarna haalt `apply-db-grants.ps1`
   CONNECT voor PUBLIC weg, zodat de rol alleen bij zijn eigen database kan
   (dat script draait Mark).
3. **Hostnaam**: `inrichting.fundament.common-ground-lab.nl` in Certificate
   `fundament`, met een acme-solver-route en de redirect naar https. DNS hoeft
   niet: `*.fundament` wijst al naar de gateway.
4. **Images bouwen en pushen** vanuit de root van de repo. De site rendert per
   verzoek, dus de build heeft geen database nodig:

   ```sh
   docker build --build-arg SITE=inrichting -t markwestbroek/imprint-inrichting:<versie> .
   docker build --target tools -t markwestbroek/imprint-tools:<versie> .
   docker push markwestbroek/imprint-inrichting:<versie>
   docker push markwestbroek/imprint-tools:<versie>
   ```

   Zet `<versie>` daarna in `deploy/k8s/inrichting/kustomization.yaml` en in
   `inrichting/tools/kustomization.yaml`.
5. **Secret**. Lees de waarden in variabelen in, zodat ze niet in de
   shellhistorie of in git komen:

   ```sh
   PG_PW=$(kubectl -n tnt-cg--db get secret pg-inrichting -o jsonpath='{.data.password}' | base64 -d)
   kubectl -n tnt-cg--inrichting create secret generic imprint-env \
     --from-literal=DATABASE_URL="postgres://inrichting:$PG_PW@pg-main-rw.tnt-cg--db.svc.cluster.local:5432/inrichting?sslmode=require&uselibpqcompat=true" \
     --from-literal=SESSION_SECRET="$(openssl rand -hex 32)"
   ```

   `pg-main` wil TLS. In `pg` 8 betekent een kale `sslmode=require` hetzelfde als
   *verify-full*, en dat faalt op het eigen CA-certificaat van CloudNativePG.
   `uselibpqcompat=true` geeft de betekenis van libpq: versleuteld, zonder
   controle van het certificaat. De andere componenten werken ook zo.

   Het leestoken van het register staat in een eigen Secret `omnium-lezer`
   (sleutel `OMNIUM_REGISTER_TOKEN`). Dat wordt aangemaakt bij het uitrollen:
   - een gebruiker met de rol *lezer*, via een uitnodiging die iemand één keer
     accepteert;
   - een token via `POST /api/auth/tokens`, met de login van die gebruiker.

   Het token is **maximaal 365 dagen** geldig: zet de vervaldatum in de agenda
   en vervang alleen dit Secret, met daarna `kubectl rollout restart`. Het
   register gaat intern via `http://omnium-api.tnt-cg--omnium.svc.cluster.local:8080`
   (`/full/…` direct onder de root; `/api/…` alleen voor auth, render en
   volgorde). `tnt-cg--omnium` heeft geen NetworkPolicy (5-11), dus verkeer uit
   een andere namespace komt erdoor.

6. **Migreren**: `kubectl apply -k deploy/k8s/inrichting/tools`, dan
   `kubectl -n tnt-cg--inrichting logs job/imprint-migrate -f`. Alleen bij een
   lege database daarna de beginteksten (site, pagina `home`, menu):

   ```sh
   kubectl -n tnt-cg--inrichting run imprint-seed --rm -i --restart=Never \
     --image=markwestbroek/imprint-tools:<versie> \
     --overrides='{"spec":{"containers":[{"name":"imprint-seed","image":"markwestbroek/imprint-tools:<versie>","command":["npm","run","db:seed","--","--site=inrichting","--only=site,page,menu"],"env":[{"name":"HOME","value":"/tmp"}],"envFrom":[{"secretRef":{"name":"imprint-env"}}]}]}}'
   ```

7. **Site**: `kubectl apply -k deploy/k8s/inrichting`. Meld FUNDAMENT zodra de
   ObjectBucketClaim `imprint` *Bound* is
   (`kubectl -n tnt-cg--inrichting get obc imprint`): pas dan kan de backup de
   bucket meenemen (`ensure-backup-secret.ps1 -AlleenBronnen`). Ook na een reset:
   de bucket krijgt dan een nieuwe naam. Sinds 5-11 gaan database en bucket
   (map `s3-imprint`) elke nacht mee; de eerste handmatige run is geslaagd.
8. **Eerste admin**, met het tools-image:

   ```sh
   kubectl -n tnt-cg--inrichting run imprint-user --rm -it --restart=Never \
     --image=markwestbroek/imprint-tools:<versie> \
     --overrides='{"spec":{"containers":[{"name":"imprint-user","image":"markwestbroek/imprint-tools:<versie>","stdin":true,"tty":true,"command":["npm","run","user","--","add","mark","admin"],"envFrom":[{"secretRef":{"name":"imprint-env"}}]}]}}'
   ```

## Daarna

- **Nieuwe versie:** image bouwen en pushen, de tag in de kustomization
  ophogen, eerst de migratie-Job (delete + apply), dan `kubectl apply -k`.
- **Controleren voordat je toepast:** `kubectl diff -k deploy/k8s/inrichting`.
- **Backups** (FUNDAMENT): elke nacht om 02:00 UTC een `pg_dump` van
  `inrichting` en een spiegel van de bucket (map `s3-imprint`) naar MinIO op de
  VPS, buiten het cluster (`s3.common-ground-lab.nl`, bucket `cg-backup`).
  Dumps blijven 30 dagen bewaard. Herstel tot op de minuut is er niet: bij een
  nodevervanging ben je hooguit een dag kwijt.
  - Die backupbucket heeft een **harde grens van 3 GiB**, voor alle
    toepassingen samen. Houd uploads klein, en meld het bij FUNDAMENT als je
    meer verwacht.
  - `npm run backup` werkt ook via een port-forward naar `pg-main-rw`.
- **Reset van het cluster**: Fundament reset de clusters nog voor het fieldlab.
  Daarna moet alles opnieuw: eerst stap 1–3 (FUNDAMENT, volgens hun RUNBOOK),
  dan stap 5–8 hier. De inhoud van de site komt dan uit de backup.
