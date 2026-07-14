# Releasen van de Imprint-engine

Versies volgen semver. Pre-1.0: **minor** (`0.8.0`) per nieuwe capability,
**patch** (`0.7.2`) per fix. Eén git-tag = één release; de drie
`package.json`-versies (root + `content-core` + `musicbrain`) lopen gelijk met
de tag.

## Tijdens het werk

Zet bij elke noemenswaardige wijziging een regel onder **`## [Unreleased]`** in
[CHANGELOG.md](../CHANGELOG.md). Zo staat de release-notitie er al als je gaat
taggen.

## Een release maken

```bash
npm run release -- 0.8.0
```

Dat script:

1. bumpt de drie `package.json`-versies naar `0.8.0`;
2. schuift de `[Unreleased]`-notities onder een nieuwe kop `## [0.8.0] - <datum>`;
3. werkt de lockfile bij;
4. commit (`Release v0.8.0`) en zet een geannoteerde tag `v0.8.0`.

Het pusht **niet**. Controleer de changelog-notitie en push dan:

```bash
git push origin main --follow-tags
```

Voorwaarden: schone werkboom, en de tag mag nog niet bestaan (het script
weigert anders).

## Handmatig (als je liever geen script gebruikt)

Bump de drie versies, verplaats de changelog-notities, dan:

```bash
git commit -am "Release v0.8.0"
git tag -a v0.8.0 -m "v0.8.0"
git push origin main --follow-tags
```
