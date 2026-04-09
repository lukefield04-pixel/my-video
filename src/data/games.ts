export interface GameData {
  rank: number;
  title: string;
  copies: number; // millions
  year: number;
  color: string;
  coverFile: string; // filename inside public/covers/
}

export const GAMES: GameData[] = [
  { rank: 1,  title: "Minecraft",                  copies: 238,   year: 2011, color: "#9C6B2E", coverFile: "1.jpg"  },
  { rank: 2,  title: "Grand Theft Auto V",          copies: 195,   year: 2013, color: "#E85D04", coverFile: "2.jpg"  },
  { rank: 3,  title: "Tetris",                      copies: 100,   year: 2006, color: "#0096C7", coverFile: "3.jpg"  },
  { rank: 4,  title: "Wii Sports",                  copies: 82.9,  year: 2006, color: "#52B788", coverFile: "4.jpg"  },
  { rank: 5,  title: "PUBG: Battlegrounds",         copies: 75,    year: 2017, color: "#F4A261", coverFile: "5.jpg"  },
  { rank: 6,  title: "Mario Kart 8 Deluxe",         copies: 67.53, year: 2017, color: "#C1121F", coverFile: "6.jpg"  },
  { rank: 7,  title: "Super Mario Bros.",            copies: 58,    year: 1985, color: "#E63946", coverFile: "7.jpg"  },
  { rank: 8,  title: "Red Dead Redemption 2",        copies: 57,    year: 2018, color: "#7B3F2E", coverFile: "8.jpg"  },
  { rank: 9,  title: "Skyrim",                      copies: 55,    year: 2011, color: "#7B8B9A", coverFile: "9.jpg"  },
  { rank: 10, title: "Terraria",                    copies: 44.5,  year: 2011, color: "#40916C", coverFile: "10.jpg" },
  { rank: 11, title: "Pac-Man",                     copies: 43,    year: 1980, color: "#F4D03F", coverFile: "11.jpg" },
  { rank: 12, title: "Wii Fit Plus",                copies: 42,    year: 2009, color: "#2196F3", coverFile: "12.jpg" },
  { rank: 13, title: "Mario Kart Wii",              copies: 37.38, year: 2008, color: "#D84315", coverFile: "13.jpg" },
  { rank: 14, title: "Pokémon Red/Blue",            copies: 31.38, year: 1996, color: "#B71C1C", coverFile: "14.jpg" },
  { rank: 15, title: "Zelda: Breath of Wild",       copies: 31.15, year: 2017, color: "#1B6E20", coverFile: "15.jpg" },
  { rank: 16, title: "CoD: Black Ops",              copies: 31,    year: 2010, color: "#455A64", coverFile: "16.jpg" },
  { rank: 17, title: "New Super Mario Bros Wii",    copies: 30.8,  year: 2009, color: "#AD1457", coverFile: "17.jpg" },
  { rank: 18, title: "Diablo III",                  copies: 30,    year: 2012, color: "#6A1B9A", coverFile: "18.jpg" },
  { rank: 19, title: "Duck Hunt",                   copies: 28.31, year: 1984, color: "#558B2F", coverFile: "19.jpg" },
  { rank: 20, title: "FIFA 18",                     copies: 24,    year: 2017, color: "#0D47A1", coverFile: "20.jpg" },
];

// rank 20 → rank 1 (camera travels from last to first)
export const ORDERED_GAMES = [...GAMES].sort((a, b) => b.rank - a.rank);

export const MAX_COPIES = 238;
export const MAX_HEIGHT = 32;
export const TOWER_SPACING = 8;
export const TOWER_WIDTH = 4.0;
export const TOWER_DEPTH = 3.5;

export function getTowerHeight(copies: number): number {
  return Math.max(0.5, (copies / MAX_COPIES) * MAX_HEIGHT);
}
