import clubsData from '../../../app/src/data/clubs.serie-a.json';
import type { ShieldClub } from '../../../app/src/lib/generators/shield';

/** What the site needs of a fictitious club (build time only). */
export interface SiteClub extends ShieldClub {
  shortName: string;
  city: string;
  state: string;
  abbreviation?: string;
}

/** A club colour must exist in the data; there is no literal fallback colour on the site. */
function requireColor(color: string | undefined, id: string): string {
  if (!color) throw new Error(`Club ${id} is missing a colour`);
  return color;
}

/** Looks up fictional clubs by id (build time). Unknown ids are a programming error. */
export function clubsById(ids: string[]): SiteClub[] {
  return ids.map((id) => {
    const c = clubsData.find((x) => x.id === id);
    if (!c) throw new Error(`Unknown club id: ${id}`);
    return {
      id: c.id,
      shortName: c.shortName,
      city: c.city,
      state: c.state,
      colors: [requireColor(c.colors[0], id), requireColor(c.colors[1], id)],
      abbreviation: c.abbreviation,
      size: c.size as ShieldClub['size'],
      titles: { league: c.titles.league },
      crestShape: c.crestShape as ShieldClub['crestShape'],
      crestPattern: c.crestPattern as ShieldClub['crestPattern'],
      crestBase: c.crestBase as ShieldClub['crestBase'],
      crestSymbol: c.crestSymbol as ShieldClub['crestSymbol'],
    };
  });
}

/** Only the clubs cited as examples in docs/content/site (no full list yet). */
export const exampleClubIds = ['flamingo', 'corinto', 'palmeral', 'coritibom', 'botafogueira'];
