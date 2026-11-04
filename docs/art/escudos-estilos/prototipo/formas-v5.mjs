// v5: formato geral de cada clube segue a silhueta geral do escudo do clube que o inspirou.
// Fica separado de escudos-v4.mjs: aplicar com applyShapesV5(CLUB_CREST).
export const SHAPES_V5 = {
  flamingo: 'rounded',
  corinto: 'disc',
  palmeral: 'rounded',
  'sao-paulao': 'french',
  'atletico-minerio': 'disc',
  gremeos: 'oval',
  fluminario: 'french',
  botafogueira: 'rounded',
  vasconcelos: 'chamfer',
  santoes: 'disc',
  cruzador: 'disc',
  'inter-regional': 'rounded',
  tufao: 'rounded',
  baiao: 'rounded',
  coritibom: 'disc',
  vitorioso: 'french',
  bragantao: 'disc',
  miragol: 'chamfer',
  chapecao: 'french',
  remador: 'oval',
};
export function applyShapesV5(crest) {
  for (const [id, shape] of Object.entries(SHAPES_V5)) crest[id].shape = shape;
}
