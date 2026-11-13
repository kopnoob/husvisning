// Alle minispillene. sted = [X, Y, gulv-Z] i Blender-mål: der spillet står i huset. fil lastes først når spillet åpnes.
export const MINISPILL = [
  { id: 'titt', navn: 'Kikk-titt i plenen', ikon: '🐰', rom: 'Hagen', sted: [8.0, -2.5, -0.55] },
  { id: 'frukt', navn: 'Fruktbollen', ikon: '🍓', rom: 'Kjøkkenet', sted: [14.1, 7.3, -0.385] },
  { id: 'syltetoy', navn: 'Tre på rad', ikon: '🍯', rom: 'Matboden', sted: [11.7, 8.5, -0.385] },
  { id: 'bobler', navn: 'Boblebadet', ikon: '🫧', rom: 'Badet', sted: [11.0, 9.8, 2.776] },
  { id: 'lop', navn: 'Nøtteløpet', ikon: '🐿️', rom: 'TV-stua', sted: [3.8, 5.6, 0] },
  { id: 'taarn', navn: 'Klossetårnet', ikon: '🧱', rom: 'Barnerommet', sted: [7.4, 5.0, 2.776] },
  { id: 'hopp', navn: 'Opp i eika', ikon: '🌳', rom: 'Terrassen', sted: [13.0, 1.6, -0.425] },
  { id: 'sokker', navn: 'Sokkevasken', ikon: '🧦', rom: 'Vaskerommet', sted: [11.0, 6.0, 2.776] },
  { id: 'blokker', navn: 'Blokkbrettet', ikon: '🟦', rom: 'Loftet', sted: [13.2, 7.0, 5.42] },
  { id: 'kort', navn: 'Vendekort', ikon: '🃏', rom: 'Stua', sted: [8.6, 6.0, 0] },
  { id: 'bil', navn: 'Bilturen', ikon: '🚗', rom: 'Garasjen', sted: [-4.4, 9.4, -0.516] },
  { id: 'minigolf', navn: 'Minigolf', ikon: '⛳', rom: 'Annekset', sted: [-6.8, -0.6, -0.435] },
  { id: 'slange', navn: 'Larven', ikon: '🐛', rom: 'Barnerommet', sted: [3.5, 5.6, 2.776] },
  { id: 'grav', navn: 'Gullgraving', ikon: '💰', rom: 'Hagen', sted: [5.0, -4.0, -0.55], krever: 'spade' },
  { id: 'dart', navn: 'Pilkast', ikon: '🎯', rom: 'Tenåringsrommet', sted: [3.6, 9.0, 2.776] },
];
