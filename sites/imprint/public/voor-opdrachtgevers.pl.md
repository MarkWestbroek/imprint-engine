# Strona internetowa zbudowana w Imprint

*Dla osób, które chcą zamówić stronę internetową opartą na Imprint, oraz dla
asystenta AI (Claude, ChatGPT, …), który im w tym pomaga. Aktualizacja:
8 listopada 2026.*

Ten dokument opisuje, co Imprint potrafi, a czego nie, i kończy się szablonem
wymagań. Wypełnij szablon razem ze swoim asystentem i wyślij go do swojej
osoby kontaktowej w Imprint. My budujemy stronę; potem treścią zarządzacie
sami.

---

## Dla asystenta: jak pomagać

Pomagasz komuś spisać wymagania dotyczące strony internetowej. My (twórcy
Imprint) zbudujemy ją później. Trzymaj się tych zasad:

1. **Dopytuj, aż szablon na końcu będzie kompletny.** Zadawaj kilka pytań
   naraz, nie dwadzieścia. Zacznij od celu i odwiedzających, dopiero potem
   strony i funkcje.
2. **Nie obiecuj niczego, czego nie ma w tym dokumencie.** Jeśli życzenie
   jest w części „Dostępne od razu”, podaj nazwę widżetu lub funkcji. Jeśli
   jest w części „Prace na zamówienie”, powiedz, że to możliwe, ale wymaga
   czasu. Jeśli nie ma go nigdzie, zapisz je jako **pytanie do twórców**. Nie
   wymyślaj funkcji.
3. **Myśl o stronach zbudowanych z bloków.** Strona w Imprint to stos
   wierszy; wiersz ma obok siebie komórki; w komórce są widżety. Opisz tak
   każdą stronę (zobacz przykład w szablonie).
4. **Oddziel treść od formy.** Teksty i zdjęcia klient po oddaniu strony
   zarządza sam. Zapytaj jednak, jakie treści już istnieją i kto je dostarczy.
5. **Numeruj wymagania** (W1, W2, … dla strony; S1, S2, … dla zarządzania i
   techniki), abyśmy mogli się do nich odwoływać w pytaniach i w kodzie.
6. **Oddaj wynik jako jeden blok markdown** według szablonu, gotowy do
   skopiowania.
7. **Rozmawiaj w języku użytkownika** i wypełnij szablon w tym języku. Nazwy
   widżetów (Hero, Cards, …) zostają po angielsku: tak nazywają się w
   studiu. Zawsze zapytaj, w jakim języku (lub językach) ma być strona i jaki
   język znają redaktorzy (zobacz „Język”).

---

## Czym jest Imprint

Imprint to silnik publikacyjny: jedna baza kodu, na której działa wiele
stron. Każda strona ma:

- **panel administracyjny** (`/admin`), do którego logują się redaktorzy;
- **wizualne studio**, w którym budujesz stronę w niej samej, z prawdziwym
  nagłówkiem i stopką: wiersze, komórki, widżety;
- **pełną historię**: każdy zapis to nowa wersja. Nic nigdy nie ginie; każdą
  wersję można przywrócić. Można obejrzeć całą stronę tak, jak wyglądała w
  wybranym dniu w przeszłości, albo jak będzie wyglądać w zaplanowanym dniu;
- **publikację w czasie**: „ważne od” i „ważne do” dla każdego elementu;
- **szybkie strony publiczne**: są generowane z wyprzedzeniem i odświeżane po
  każdej zmianie w panelu.

Działające przykłady: musicbrain.nl (strona produktu – instrumentu
muzycznego), imprint-engine.nl oraz wersja pokazowa ze społecznościami,
blogiem, kalendarzem wydarzeń i wiki.

---

## Dostępne od razu

### Widżety na stronach

Redaktor wybiera je w studiu. Dla każdej strony ustalamy, które są w
katalogu.

**Tekst i struktura**
- **Text**: sformatowany tekst (nagłówki, listy, linki, zdjęcia), z edytorem
  wizualnym i zakładką Markdown.
- **Hero**: duży nagłówek z tekstem, przyciskiem i ewentualnie zdjęciem w
  tle.
- **Callout / CTA**: kolorowy blok z przyciskiem.
- **Quote**: cytat ze źródłem.
- **Table**: tabela.
- **Accordion / FAQ**: rozwijane pytania.
- **Tabs**: treść w zakładkach.
- **Cards / features**: siatka kart z ikoną, nagłówkiem, tekstem i linkiem.
- **Buttons**: rząd przycisków.
- **Specs strip**: rząd kluczowych liczb.
- **Timeline**: oś czasu.
- **Divider**: linia oddzielająca lub odstęp.
- **Table of contents**: spis nagłówków na stronie.
- **Breadcrumb**: ścieżka nawigacyjna („okruszki”).
- **Code**: przykład kodu z kolorowaniem składni.
- **Mermaid diagram**: diagram z tekstu (schemat blokowy, wykres Gantta, …).

**Obrazy i media**
- **Image**: zdjęcie.
- **Photo gallery**: siatka zdjęć z powiększeniem.
- **Photo carousel**: pokaz slajdów.
- **External album**: zdjęcia z udostępnionego albumu (np. Lightroom).
- **Media & text**: zdjęcie obok tekstu.
- **Video**: YouTube, Vimeo lub własny plik.
- **Audio**: nagranie dźwiękowe.
- **PDF**: PDF na stronie.
- **File download**: przycisk pobierania.
- **Map**: interaktywna mapa ze znacznikami.
- **Logo cloud**: rząd logotypów.

**Ludzie i sprzedaż**
- **People / team**: osoby ze zdjęciem i funkcją.
- **Testimonials**: opinie klientów.
- **Pricing**: bloki cenowe (tylko prezentacja, bez płatności; zobacz Prace
  na zamówienie).

**Treść, która wypełnia się sama**
- **Posts / news feed**: najnowsze wpisy.
- **List (links)**: lista zgodna ze strukturą strony.
- **Template**: tekst z polami uzupełnianymi z elementu treści.
- **Treeview**: widok drzewa.
- **Kanban board**: karty w kolumnach.
- **Embed (iframe)**: osadzenie innej strony lub usługi.
- **API content**: dane z zewnętrznego źródła.
- **V3 model diagram**: model danych jako diagram (dla tych, którzy tego
  potrzebują).

### Moduły (włączane dla danej strony)

- **Blog i aktualności**: wpisy z autorem, datą, tagami i zdjęciem; przegląd
  pod `/blog` i `/news`, osobna strona dla każdego wpisu.
- **Wydarzenia**: wydarzenia z początkiem, końcem, miejscem i linkiem online;
  przegląd według miesięcy; zapisy („będę / może / nie będę”, z limitem
  miejsc) dla zalogowanych członków.
- **Wiki**: dokumentacja w folderach i stronach, z drzewem nawigacji;
  publiczna lub tylko dla członków.
- **Słownik**: pojęcia z własną stroną i przeszukiwalnym przeglądem.
- **Społeczności / grupy**: grupy z własną stroną, członkami (otwarte lub na
  prośbę), linkami z zaproszeniem, wpisami i wydarzeniami grupy.
- **Komentarze**: komentarze pod wpisami i stronami, także do fragmentu
  tekstu (notatka na marginesie), z moderacją.
- **Prezentacje**: slajdy na stronie, z trybem pełnoekranowym.
- **Tablice planowania**: tablice kanban z historią.

### Zarządzanie i technika

- **Użytkownicy i role**: administrator, redaktor, czytelnik. Z modułem
  społeczności odwiedzający mogą sami założyć konto (z potwierdzeniem e-mail
  i funkcją „nie pamiętam hasła”).
- **Publiczne lub zastrzeżone** dla każdej strony, wiki lub grupy: dla
  wszystkich, tylko dla zalogowanych członków albo tylko dla członków jednej
  grupy.
- **Biblioteka mediów**: przesyłanie metodą przeciągnij i upuść, foldery i
  tagi, tekst alternatywny, automatycznie tworzone mniejsze wersje dla
  szybkiego ładowania, punkt ostrości przy kadrowaniu, prywatność EXIF
  (usunięta lokalizacja) oraz ustawienie, do jakiego rozmiaru zdjęcie jest
  publiczne.
- **Menu**, **motywy** (kolory, z próbnikiem kolorów i podglądem na żywo;
  można mieć kilka motywów do przełączania) i **ustawienia strony** (nazwa,
  hasło przewodnie, linki).
- **Wyszukiwanie** we wszystkich treściach, które wolno ci zobaczyć.
- **Statystyki bez ciasteczek**: odwiedziny, strony, źródła wejść i
  wyszukiwania (także to, czego *nie* znaleziono). Baner o ciasteczkach nie
  jest potrzebny.
- **E-maile** wysyłane przez stronę: potwierdzenia, reset hasła, codzienne
  podsumowanie powiadomień.
- **Hosting po naszej stronie**: własna domena z HTTPS, baza danych z
  codzienną kopią zapasową (serwery w UE).
- **Własne typy treści** są możliwe (np. „Produkty”, „Projekty”, „Przepisy”),
  z formularzem tworzonym automatycznie z pól. To jednak praca programistyczna
  (zobacz Prace na zamówienie).

---

## Język

- **Strona w jednym języku, dowolnym (także po polsku), jest możliwa.**
  Redaktorzy sami wpisują całą treść: strony, menu, wpisy, nazwę strony.
- **Stałe teksty w kodzie** (przyciski typu „poprzedni/następny”, daty,
  strony logowania i wyszukiwania) są obecnie po angielsku lub niderlandzku.
  Dla innego języka tłumaczymy je; to niewielka praca na zamówienie.
- **Panel administracyjny jest po angielsku** (miejscami po niderlandzku).
  Redaktorom, którzy nie czytają po angielsku, będzie trudno. Przetłumaczony
  panel to większa praca na zamówienie; zapytaj, jeśli jest potrzebny.
- **Kilka języków obok siebie** (przełącznik języka, adresy dla każdego
  języka) to praca na zamówienie.

---

## Prace na zamówienie (możliwe, wymagają czasu)

| Życzenie | Czego wymaga | Wielkość |
|---|---|---|
| Własna identyfikacja wizualna (czcionki, kolory, logo, nagłówek i stopka) | przeniesienie projektu na stronę | mała do średniej |
| Własny typ treści (np. „Projekty” z własnymi polami i przeglądem) | schemat + widok + strona przeglądu | średnia |
| Nowy widżet, którego jeszcze nie ma | schemat + widok | mała do średniej |
| Stała strona o szczególnej budowie (np. konfigurator) | kod w stronie | średnia do dużej |
| **Sklep internetowy z płatnościami** (BLIK, Przelewy24, karty przez Mollie) | produkty, koszyk, płatność Mollie, zamówienia, e-maile | duża; budowaliśmy to już z Mollie |
| Płatny dostęp do treści (np. zakup filmów lub zdjęć) | to samo, plus dostęp dla każdego klienta | duża |
| Formularz kontaktowy lub zapisów | formularz + e-mail lub zapis | mała |
| Połączenie z innym systemem (kalendarz, CRM, newsletter) | integracja API | zależnie od przypadku |
| Stałe teksty strony w innym języku (np. po polsku) | tłumaczenie przycisków, dat, stron logowania i wyszukiwania | mała |
| Panel administracyjny w innym języku niż angielski | tłumaczenie całego panelu | duża |
| Strona w pełni wielojęzyczna (przełącznik języka, adresy dla każdego języka) | baza zna języki, strona nie ma jeszcze przełącznika | średnia |
| Przeniesienie treści ze starej strony | skrypt dla każdego źródła | zależnie od przypadku |

## Niemożliwe lub odradzane

- **Wklejanie surowego HTML lub skryptów na strony.** Wszystko przechodzi
  przez widżety, żeby było bezpiecznie i spójnie. Osadzenie czegoś jest
  możliwe widżetem Embed.
- **Samodzielne instalowanie wtyczek** jak w WordPressie. Nowe funkcje
  budujemy my.
- **Strona bez człowieka, który nią zarządza**: zawsze jest co najmniej jeden
  administrator.
- **Całkowite wymazanie treści**: usunąć można, ale historia ją zachowuje
  (celowo). Jeśli coś musi zniknąć z powodów prawnych, porozmawiaj z nami.

---

## Szablon wymagań

Wypełnij go i wyślij do swojej osoby kontaktowej w Imprint.

```markdown
# Strona: <nazwa>

## 1. Cel i odwiedzający
- Co strona ma osiągnąć?
- Kim są odwiedzający i po co przychodzą? (3 najważniejsze zadania)
- Przykładowe strony, które ci się podobają, i dlaczego:

## 2. Domena i harmonogram
- Nazwa domeny (już posiadana?):
- Pożądany termin oddania i dlaczego ten termin:
- Istniejąca strona, którą zastępujemy (adres):
- Język (lub języki) strony:
- Jaki język znają redaktorzy (dla panelu administracyjnego)?

## 3. Strony
Dla każdej strony: adres, cel i budowa w wierszach → komórkach → widżetach.

### Przykład: Strona główna (`/`)
- Wiersz 1: Hero (nagłówek, krótki tekst, przycisk „Zobacz nasze prace”)
- Wiersz 2: trzy komórki obok siebie, w każdej karta Cards
- Wiersz 3: Posts (3 najnowsze wpisy)
- Wiersz 4: Callout z przyciskiem kontaktu

### <strona>
- ...

## 4. Typy treści i moduły
- Moduły (blog, wydarzenia, wiki, słownik, społeczności, komentarze, …):
- Własne rodzaje treści z własnymi polami (np. Projekty: tytuł, klient, rok,
  zdjęcia):

## 5. Kto co robi
- Kto zarządza stroną (role: administrator, redaktor)?
- Czy odwiedzający mają się logować lub zakładać konto? Po co?
- Co jest publiczne, a co tylko dla członków?

## 6. Wygląd
- Logo, kolory, czcionki (pliki lub księga znaku):
- Jasny, ciemny czy oba?

## 7. Treść
- Jakie teksty i zdjęcia już istnieją i kto je dostarczy?
- Czy przenosimy treść ze starej strony?

## 8. Prace na zamówienie
- Życzenia z części „Prace na zamówienie” (sklep, formularz, integracja, …),
  jak najbardziej szczegółowo:

## 9. Ponumerowane wymagania
- W1: ...
- W2: ...
- S1: ...

## 10. Pytania do twórców
- ...
```
