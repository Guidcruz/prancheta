import clubsData from '../../../app/src/data/clubs.serie-a.json';

export interface ShieldClub {
  id: string;
  shortName: string;
  color1: string;
  color2: string;
  abbreviation?: string;
}

/** Looks up fictional clubs by id (build time). Unknown ids are a programming error. */
export function clubsById(ids: string[]): ShieldClub[] {
  return ids.map((id) => {
    const c = clubsData.find((x) => x.id === id);
    if (!c) throw new Error(`Unknown club id: ${id}`);
    return {
      id: c.id,
      shortName: c.shortName,
      color1: c.colors[0] ?? '#777777',
      color2: c.colors[1] ?? '#777777',
      abbreviation: c.abbreviation,
    };
  });
}

/** Only the clubs cited as examples in docs/content/site (no full list yet). */
export const exampleClubIds = ['flamingo', 'corinto', 'palmeral', 'coritibom', 'botafogueira'];
