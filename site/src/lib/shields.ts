import clubsData from '../../../app/src/data/clubs.serie-a.json';

/** What the site needs of a fictitious club (build time only). */
export interface SiteClub {
  id: string;
  shortName: string;
  city: string;
  state: string;
  colors: [string, string];
  abbreviation?: string;
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
      colors: [c.colors[0] ?? '#777777', c.colors[1] ?? '#777777'],
      abbreviation: c.abbreviation,
    };
  });
}

/** Only the clubs cited as examples in docs/content/site (no full list yet). */
export const exampleClubIds = ['flamingo', 'corinto', 'palmeral', 'coritibom', 'botafogueira'];
