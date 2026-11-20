import { permanentRedirect } from "next/navigation";

/** The Dutch name of /search: forwards with the query string (a route, so it may read the URL). */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  permanentRedirect(`/search${new URL(request.url).search}`);
}
