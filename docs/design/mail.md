# Ontwerp — mail vanaf de VPS

Status: **plan**, 19 september 2026. Backlog §6 ("Mail configureerbaar per
instantie"). Aanleiding: het contactformulier van volksgebouwzeist.nl verhuist
mee naar de VPS, en daar is geen lokale mailserver meer.

## Wat er verandert

Op Plesk stuurden de sites via `localhost:25` — de Postfix van de shared
hosting deed de rest. Op de VPS bestaat die niet. Elke site die mail verstuurt,
moet daar dus een **SMTP-relay** voor krijgen: een mailserver elders waarop we
inloggen en die het bericht aflevert.

## De keuze (19 september 2026)

**Nu: de bestaande mailserver van Quickhost** — host **`mail.<domein>`**,
poort **465 (SSL)**, met gebruikersnaam en wachtwoord van een mailbox op het
domein.

> **Uitgezocht op 21 september 2026** bij het live zetten van
> volksgebouwzeist.nl. Dit kostte een half uur, dus voor de volgende site:
> - **Poort 587 met STARTTLS werkt niet**: die geeft `454 4.7.0 Temporary
>   authentication failure: generic failure`, ongeacht gebruikersnaam of
>   mechanisme. **465 met SSL werkt wél**, met exact dezelfde inloggegevens.
>   (Zo staat het ook in de werkende PHP-site op video.msss.nl:
>   `D:\Git\Web\Hans`, `httpdocs/includes/config.php`.)
> - Gebruik **`mail.<domein>`** als host: dat is de enige naam met een geldig
>   certificaat (`smtp.<domein>` geeft een hostname-mismatch, en
>   `cordelia.exsilia.net` heeft `*.exsilia.net`). Dat maakt uit nu de
>   certificaatcontrole aanstaat.
> - Plesk's eigen "Mail Client Setup" noemt als uitgaande server het **kale
>   domein** (`volksgebouwzeist.nl`) met poort 465. Dat klopt zolang de site
>   daar staat, maar **na de verhuizing wijst dat A-record naar de VPS** — dan
>   praat je tegen Caddy in plaats van tegen de mailserver. Neem dus altijd
>   `mail.<domein>`. Poort 465 bevestigt Plesk wél (POP3 995, IMAP 993,
>   SMTP 465).
> - Dezelfde `454`-melding komt ook als de **mailbox nog niet bestaat**, dus
>   die twee zijn niet te onderscheiden. Controleer eerst of de mailbox er is:
>   een `RCPT TO` op poort 25 antwoordt `550 … User unknown` zolang hij
>   ontbreekt, en `250 Ok` zodra hij er is.

- De MX- en SPF-records van musicbrain.nl, volksgebouwzeist.nl en
  pi-utrecht.nl wijzen daar al heen (`include:_spf.exsilia.net`). Sturen we via
  die server, dan klopt SPF vanzelf en zet Quickhost de DKIM-handtekening.
- Geen account erbij, geen DNS-wijziging, geen opwarmen van een nieuw IP.
- Nadeel: het hangt aan de hosting waar we juist van weg bewegen. Zegt Quickhost
  op of valt het weg, dan is dit het enige dat meeverhuist.

**Later, als Imprint zelf mail gaat sturen: een transactionele dienst**
(Postmark, Brevo, Mailgun, Resend, SES). Dan gaat het om
wachtwoord-vergeten-mail, meldingen aan beheerders en mislukte ingests over
meerdere sites, en wil je aflevering kunnen zien, een bounce terugkrijgen en
niet afhankelijk zijn van één hostingpakket. Overstappen kost weinig: het is
aan beide kanten gewoon SMTP, dus alleen andere instellingen, plus per domein
een DKIM-record en een aanvulling op de SPF.

**Niet doen: zelf een mailserver op de VPS.** Poort 25 is vaak dicht, je hebt
een PTR-record nodig en een nieuw IP heeft geen reputatie. Veel werk om in de
spammap te eindigen.

## Regels die altijd gelden

1. **Afzender is het domein, niet de bezoeker.** Een contactformulier stuurt
   `From: noreply@<domein>` met `Reply-To: <het adres van de bezoeker>`.
   Sturen "namens" de bezoeker breekt SPF en DMARC.
2. **Geheimen in de omgeving**, per site, in de `.env` op de VPS —
   nooit in git, nooit als fallback in de code. Bij Volksgebouw staan nu een
   vaste ontvanger en `tls.rejectUnauthorized: false` in de code; die gaan eruit.
3. **Geen mail geconfigureerd = een nette melding**, geen stacktrace en geen
   stil weggegooid bericht. Zonder instellingen hoort het formulier te zeggen
   dat het niet verstuurd kan worden.
4. **Spambescherming hoort bij het formulier**, niet bij de mail: een honeypot
   en een snelheidsbegrenzing per IP. Dat ontbreekt nu.

## Wat dit voor Imprint betekent

Een `mail`-blok in `imprint.config.ts`, gelezen uit de omgeving, met één
`sendMail()` in de engine:

```ts
mail: {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.MAIL_FROM,        // "MusicBrain <noreply@musicbrain.nl>"
  replyTo: process.env.MAIL_REPLY_TO, // optioneel
}
```

Per imprint een eigen afzender en eigen mailbox, net zoals elke site zijn eigen
database en eigen assets heeft. Eerste gebruikers: wachtwoord-vergeten (§2 van
de backlog) en beheerdersmeldingen.

## Wat er nodig is om het aan te zetten (Volksgebouw)

1. Een mailbox bij Quickhost voor de afzender, bijvoorbeeld
   `noreply@volksgebouwzeist.nl`, of een bestaande die daarvoor gebruikt mag
   worden.
2. Die gegevens in de `.env` op de VPS:
   `SMTP_HOST=mail.volksgebouwzeist.nl`, `SMTP_PORT=465`, `SMTP_SECURE=true`,
   `SMTP_AUTH=true`, `SMTP_USER=noreply@volksgebouwzeist.nl`, `SMTP_PASS=…`,
   `SMTP_FROM=noreply@volksgebouwzeist.nl`, `CONTACT_TO=<ontvanger>`.
3. Controle: één testbericht via het formulier, en kijken of het in de inbox
   komt en niet in de spam.

**Stand: gedaan op 21 september 2026.** Het formulier van volksgebouwzeist.nl
verstuurt weer; het testbericht ging via `mail.volksgebouwzeist.nl:465` naar
Marks eigen adres. Het ontvangstadres is voorlopig dat van Mark; nog te
beslissen of er een eigen adres of mailbox voor het Volksgebouw komt.
