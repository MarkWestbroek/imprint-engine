# Een Imprint-site op Fundament (Kubernetes)

Naast de VPS ([deploy-vps.md](deploy-vps.md)) kan een site op het
Fundament-cluster draaien (cg-test, `*.fundament.common-ground-lab.nl`).
De eerste is de inrichtings-UI op het Omnium-register
([design/omnium-inrichting.md](design/omnium-inrichting.md)), werktitel
`inrichting.fundament.common-ground-lab.nl`. De manifesten staan in
[`deploy/k8s/`](../deploy/k8s/) (kustomize, ingebouwd in `kubectl`).

> **Stand (5-11-2026):** de manifesten zijn klaar en met een server-side
> dry-run tegen het cluster gecontroleerd. Er draait nog niets: `sites/inrichting`
> bestaat nog niet (wacht op Marks akkoord), en de namespace, de database-rol
> en de hostnaam in het certificaat moeten door FUNDAMENT worden geregeld.

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
| `inrichting/` | namespace, hostnaam, images, `OMNIUM_REGISTER_URL` en `OMNIUM_URL` (binnen het cluster) |
| `inrichting/db/database.yaml` | de database `inrichting` in `pg-main` |

Geen geheimen in git. De Secret `imprint-env` maak je met de hand.

## Eerste keer

Stap 1–3 raken gedeelde objecten en gaan via FUNDAMENT.

1. **Namespace** `tnt-cg--inrichting`, op de manier waarop Fundament tenants
   aanmaakt.
2. **Database:**
   - de rol `inrichting` in `pg-main` (`spec.managed.roles`, `passwordSecret`
     `pg-inrichting`, type basic-auth, in `tnt-cg--db`);
   - daarna `kubectl apply -f deploy/k8s/inrichting/db/database.yaml`.
3. **Hostnaam** `inrichting.fundament.common-ground-lab.nl` in de `dnsNames` van
   Certificate `fundament` (`tnt-cg--test`). Zoals bij de andere hostnamen is
   er een acme-solver-route bij nodig.
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
   kubectl -n tnt-cg--inrichting create secret generic imprint-env \
     --from-literal=DATABASE_URL="postgres://inrichting:$PG_PW@pg-main-rw.tnt-cg--db.svc.cluster.local:5432/inrichting" \
     --from-literal=SESSION_SECRET="$(openssl rand -hex 32)" \
     --from-literal=OMNIUM_REGISTER_TOKEN="$OMT_TOKEN"
   ```

6. **Migreren**: `kubectl apply -k deploy/k8s/inrichting/tools`, dan
   `kubectl -n tnt-cg--inrichting logs job/imprint-migrate -f`.
7. **Site**: `kubectl apply -k deploy/k8s/inrichting`.
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
- **Backups:** de database zit in `pg-main`, dus valt onder de backups van
  FUNDAMENT. Ga na of die er zijn: de registerdatabase ging op 3-11 verloren.
  `npm run backup` werkt ook via een port-forward naar `pg-main-rw`.
