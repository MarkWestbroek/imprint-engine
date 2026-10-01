---
slug: about
lang: en
title: About MusicBrain
description: What MusicBrain is, and why it is open source.
publishedAt: "2026-07-01"
---

MusicBrain is an open platform for playable instruments, recallable patches
and musical control. It started as a way to give analog rigs memory; it now
also includes digital synthesizers, samplers and effects that you can play in
your browser or on a Teensy.

## Three directions

- **Cortex** — for modular synths: the browser editor and simulator, shared
  DSP on a Teensy, and a modular hardware system that is in development.
  Most of the work happens here today.
- **Reflex** — for pedalboards: a MIDI/footswitch controller and relay loop
  boards, with an offline chain editor. In development.
- **Relay** — for studios: amp and cab switching. Architecture and safety
  requirements; not yet a verified design.

External audio paths can stay analog; internal DSP and USB audio are
digital. What can be recalled depends on what your hardware can control.

## Open source, on purpose

MusicBrain's own firmware, editor and simulator code is MIT-licensed.
Third-party libraries and assets keep their own licenses and notices — see
the [source on GitHub](https://github.com/MarkWestbroek/MusicBrain). You can see how it works, fix what bugs you,
and keep using it.

## Not MusicBrainz

We get it a lot: [MusicBrainz](https://musicbrainz.org) is the excellent open
music encyclopedia. We are MusicBrain — open instruments and control for your
music gear. Fans of their work, no relation.
