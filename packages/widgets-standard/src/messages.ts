import type { Catalog } from "@imprint/content-core";

/**
 * The fixed texts of the standard widgets, per language (design/meertaligheid.md
 * layer 2). What a visitor reads; the hints for the editor (a widget that
 * still needs a model or a URL) stay with the admin's language. A new
 * language is one more entry here. The Polish texts are a first translation,
 * to be read by a Polish speaker.
 */
export type WidgetMessages = {
  nothingYet: string;
  noPhotos: string;
  noPosts: string;
  noHeadings: string;
  couldNotLoad: (host: string, error: string) => string;
  noPhotosOn: (host: string) => string;
  openAlbumOn: (host: string) => string;
  video: string;
  embeddedContent: string;
  downloadAudio: string;
  pdfNotShown: string;
  downloadIt: string;
  downloadPdf: string;
  breadcrumb: string;
  previous: string;
  next: string;
  /** The word before a photo's number: "Photo 3". */
  photo: string;
};

export const messages = {
  en: {
    nothingYet: "Nothing here yet.",
    noPhotos: "No photos yet.",
    noPosts: "No posts yet.",
    noHeadings: "No headings on this page yet.",
    couldNotLoad: (host, error) => `Could not load ${host}: ${error}`,
    noPhotosOn: (host) => `No previewable photos on ${host}.`,
    openAlbumOn: (host) => `Open album on ${host}`,
    video: "Video",
    embeddedContent: "Embedded content",
    downloadAudio: "Download audio",
    pdfNotShown: "Your browser cannot show the PDF here.",
    downloadIt: "Download it",
    downloadPdf: "Download PDF",
    breadcrumb: "Breadcrumb",
    previous: "Previous",
    next: "Next",
    photo: "Photo",
  },
  nl: {
    nothingYet: "Hier staat nog niets.",
    noPhotos: "Nog geen foto's.",
    noPosts: "Nog geen berichten.",
    noHeadings: "Deze pagina heeft nog geen koppen.",
    couldNotLoad: (host, error) => `${host} laden lukt niet: ${error}`,
    noPhotosOn: (host) => `Geen foto's om te tonen op ${host}.`,
    openAlbumOn: (host) => `Album openen op ${host}`,
    video: "Video",
    embeddedContent: "Ingesloten inhoud",
    downloadAudio: "Audio downloaden",
    pdfNotShown: "Je browser kan de pdf hier niet tonen.",
    downloadIt: "Download de pdf",
    downloadPdf: "Pdf downloaden",
    breadcrumb: "Kruimelpad",
    previous: "Vorige",
    next: "Volgende",
    photo: "Foto",
  },
  pl: {
    nothingYet: "Tu jeszcze nic nie ma.",
    noPhotos: "Nie ma jeszcze zdjęć.",
    noPosts: "Nie ma jeszcze wpisów.",
    noHeadings: "Ta strona nie ma jeszcze nagłówków.",
    couldNotLoad: (host, error) => `Nie udało się wczytać ${host}: ${error}`,
    noPhotosOn: (host) => `Brak zdjęć do wyświetlenia na ${host}.`,
    openAlbumOn: (host) => `Otwórz album na ${host}`,
    video: "Wideo",
    embeddedContent: "Osadzona treść",
    downloadAudio: "Pobierz nagranie",
    pdfNotShown: "Twoja przeglądarka nie może tu wyświetlić pliku PDF.",
    downloadIt: "Pobierz plik PDF",
    downloadPdf: "Pobierz PDF",
    breadcrumb: "Ścieżka nawigacji",
    previous: "Poprzednie",
    next: "Następne",
    photo: "Zdjęcie",
  },
} satisfies Catalog<WidgetMessages>;
