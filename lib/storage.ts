import type { Board, SavedPalette } from "./types";
export interface ResearchStorage {
  loadBoards(): Board[];
  saveBoards(boards: Board[]): void;
  loadPalettes(): SavedPalette[];
  savePalettes(palettes: SavedPalette[]): void;
}
function load<T>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
export const localResearchStorage: ResearchStorage = {
  loadBoards: () => load<Board>("archive-scout:boards:v1"),
  saveBoards: (boards) =>
    localStorage.setItem("archive-scout:boards:v1", JSON.stringify(boards)),
  loadPalettes: () => load<SavedPalette>("archive-scout:palettes:v1"),
  savePalettes: (palettes) =>
    localStorage.setItem("archive-scout:palettes:v1", JSON.stringify(palettes)),
};
