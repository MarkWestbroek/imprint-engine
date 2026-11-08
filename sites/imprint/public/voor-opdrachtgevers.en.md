# Having a website built with Imprint

*For anyone who wants a website built on Imprint, and for the AI assistant
(Claude, ChatGPT, …) helping them. Updated: 8 November 2026.*

This document explains what Imprint can and cannot do, and ends with a
template for your requirements. Fill in the template together with your
assistant and send it to your contact at Imprint. We build the site; you
manage the content yourselves afterwards.

---

## For the assistant: how to help

You are helping someone write down the requirements for a website. We (the
makers of Imprint) build the site afterwards. Follow these rules:

1. **Keep asking until the template at the end is complete.** Ask a few
   questions at a time, not twenty. Start with the goal and the visitors, only
   then pages and features.
2. **Promise nothing that is not in this document.** If a wish is under
   "Available now", name the widget or feature. If it is under "Custom work",
   say it is possible but takes time. If it is nowhere, write it down as a
   **question for the builders**. Do not invent features.
3. **Think in pages built from blocks.** An Imprint page is a stack of rows; a
   row has cells side by side; a cell holds widgets. Describe every page that
   way (see the example in the template).
4. **Separate content from form.** The client manages texts and images after
   delivery. Do ask which content already exists and who will supply it.
5. **Number the requirements** (W1, W2, … for the website; S1, S2, … for
   management and technology), so we can refer to them in questions and in
   the code.
6. **Deliver the result as a single markdown block** following the template,
   ready to copy.
7. **Speak your user's language** and write the template in that language.
   Widget names (Hero, Cards, …) stay in English: that is what they are
   called in the studio. Always ask which language(s) the site should be in,
   and which language the editors read (see "Language").

---

## What Imprint is

Imprint is a publishing engine: one code base that runs several websites.
Every site has:

- **an admin area** (`/admin`) where editors log in;
- **a visual studio** where you build a page inside the page itself, with the
  site's real header and footer around it: rows, cells, widgets;
- **complete history**: every save is a new version. Nothing is ever lost;
  every version can be restored. You can view the whole site as it was on an
  earlier date, or as it will look on a scheduled date;
- **scheduled publishing**: "valid from" and "valid until" per item;
- **fast public pages**: they are built in advance and refreshed after every
  change in the admin.

Live examples: musicbrain.nl (a product site for a musical instrument),
imprint-engine.nl, and a showcase with communities, blog, events and wiki.

---

## Available now

### Widgets for pages

An editor picks them in the studio. Per site we decide which ones are in the
catalogue.

**Text and structure**
- **Text**: formatted text (headings, lists, links, images), with a visual
  editor and a Markdown tab.
- **Hero**: large heading with text, a button and optionally a background
  image.
- **Callout / CTA**: coloured block with a button.
- **Quote**: quotation with source.
- **Table**: table.
- **Accordion / FAQ**: questions that fold open.
- **Tabs**: content in tabs.
- **Cards / features**: grid of cards with icon, heading, text and link.
- **Buttons**: a row of buttons.
- **Specs strip**: a row of key figures.
- **Timeline**: timeline.
- **Divider**: dividing line or white space.
- **Table of contents**: contents list of the headings on the page.
- **Breadcrumb**: breadcrumb trail.
- **Code**: code sample with syntax colours.
- **Mermaid diagram**: diagram from text (flowchart, gantt, …).

**Images and media**
- **Image**: image.
- **Photo gallery**: photo grid with enlargement.
- **Photo carousel**: slideshow.
- **External album**: photos from a shared album (for example Lightroom).
- **Media & text**: image beside text.
- **Video**: YouTube, Vimeo or your own file.
- **Audio**: sound clip.
- **PDF**: PDF inside the page.
- **File download**: download button.
- **Map**: interactive map with markers.
- **Logo cloud**: row of logos.

**People and sales-like**
- **People / team**: people with photo and role.
- **Testimonials**: customer experiences.
- **Pricing**: price blocks (display only, no checkout; see Custom work).

**Content that fills itself**
- **Posts / news feed**: the latest posts.
- **List (links)**: a list that follows the structure of the site.
- **Template**: text with placeholders filled from a content item.
- **Treeview**: tree view.
- **Kanban board**: cards in columns.
- **Embed (iframe)**: embed another web page or service.
- **API content**: show data from an external source.
- **V3 model diagram**: a data model as a diagram (for those who need it).

### Modules (switched on per site)

- **Blog and news**: posts with author, date, tags and image; overviews at
  `/blog` and `/news`, a page per post.
- **Events**: events with start, end, place and online link; overview per
  month; sign-up ("going / maybe / not going", with a maximum) for logged-in
  members.
- **Wiki**: documentation in folders and pages, with a navigation tree;
  public or members only.
- **Glossary**: terms with their own page and a searchable overview.
- **Communities / groups**: groups with their own page, members (open or on
  request), invitation links, posts and events per group.
- **Comments**: comments under posts and pages, also on a passage of text
  (a note in the margin), with moderation.
- **Presentations**: slides inside the site, with full screen.
- **Planning boards**: kanban boards with history.

### Management and technology

- **Users and roles**: admin, editor, reader. With the communities module
  visitors can create their own account (with e-mail confirmation and
  "forgot password").
- **Public or restricted** per page, wiki or group: for everyone, only for
  logged-in members, or only for the members of one group.
- **Media library**: drag-and-drop upload, folders and tags, alt text,
  smaller versions made automatically for fast loading, a focus point for
  cropping, EXIF privacy (location removed), and per image up to which size
  it is public.
- **Menus**, **themes** (colours, with colour picker and live preview;
  several themes to switch between is possible) and **site settings** (name,
  tagline, links).
- **Search** across all content you are allowed to see.
- **Statistics without cookies**: visits, pages, referrers and searches
  (including what was *not* found). No cookie banner needed.
- **E-mail** from the site: confirmations, password reset, a daily summary of
  notifications.
- **Hosting by us**: your own domain name with HTTPS, a database with daily
  backups (servers in the EU).
- **Custom content types** are possible (for example "Products", "Projects",
  "Recipes") with a form that follows from the fields automatically. That is
  building work, though (see Custom work).

---

## Language

- **A site in a single language, any language (Polish too), is possible.**
  The editors type all content themselves: pages, menus, posts, the name of
  the site.
- **Fixed texts in the code** (buttons like "previous/next", dates, login and
  search pages) are currently in English or Dutch. For another language we
  translate them; that is small custom work.
- **The admin area is in English** (with some Dutch here and there). Editors
  who do not read English will find it hard. A translated admin is larger
  custom work; ask for it if you need it.
- **Several languages side by side** (language switch, addresses per
  language) is custom work.

---

## Custom work (possible, takes building time)

| Wish | What it takes | Size |
|---|---|---|
| Your own visual identity (fonts, colours, logo, header and footer) | translating a design to the site | small to medium |
| A custom content type (e.g. "Projects" with its own fields and overview) | schema + view + overview page | medium |
| A new widget that does not exist yet | schema + view | small to medium |
| A fixed page with a special structure (e.g. a configurator) | code in the site | medium to large |
| **Web shop with payments** (cards, iDEAL, BLIK, Przelewy24 via Mollie) | products, cart, Mollie checkout, orders, e-mails | large; we have built this before with Mollie |
| Paid access to content (e.g. buying videos or photos) | the same, plus access per customer | large |
| Contact form or sign-up form | form + e-mail or storage | small |
| Connection to another system (calendar, CRM, newsletter) | API integration | case by case |
| Fixed texts of the site in another language (e.g. Polish) | translating buttons, dates, login and search pages | small |
| Admin area in a language other than English | translating the whole admin | large |
| Fully multilingual site (language switch, addresses per language) | storage knows languages, the site has no language switch yet | medium |
| Moving content over from an old site | a script per source | case by case |

## Not possible, or not recommended

- **Pasting raw HTML or scripts into pages.** Everything goes through widgets,
  so it stays safe and consistent. Embedding something is possible with the
  Embed widget.
- **Installing plugins yourself** as in WordPress. We build new features.
- **A site without a human managing it**: there is always at least one admin.
- **Truly erasing content**: deleting is possible, but history keeps it (on
  purpose). If something legally has to be gone, talk to us.

---

## Requirements template

Fill this in and send it to your contact at Imprint.

```markdown
# Website: <name>

## 1. Goal and visitors
- What should the site achieve?
- Who are the visitors, and what do they come to do? (top 3 tasks)
- Example sites you like, and why:

## 2. Domain and planning
- Domain name (already owned?):
- Desired delivery date, and why that date:
- Existing site being replaced (address):
- Language(s) of the site:
- Which language do the editors read (for the admin area)?

## 3. Pages
Per page: address, purpose, and the structure in rows → cells → widgets.

### Example: Home (`/`)
- Row 1: Hero (heading, short text, button "See our work")
- Row 2: three cells side by side, each a Cards card
- Row 3: Posts (latest 3 posts)
- Row 4: Callout with contact button

### <page>
- ...

## 4. Content types and modules
- Modules (blog, events, wiki, glossary, communities, comments, …):
- Own kinds of content with their own fields (e.g. Projects: title, client,
  year, photos):

## 5. Who does what
- Who manages the site (roles: admin, editor)?
- Should visitors be able to log in or create an account? What for?
- What is public, what is for members only?

## 6. Design
- Logo, colours, fonts (files or a style guide):
- Light, dark, or both?

## 7. Content
- Which texts and images already exist, and who supplies them?
- Should content be moved over from an old site?

## 8. Custom work
- Wishes that fall under "Custom work" (web shop, form, integration, …),
  in as much detail as possible:

## 9. Numbered requirements
- W1: ...
- W2: ...
- S1: ...

## 10. Questions for the builders
- ...
```
