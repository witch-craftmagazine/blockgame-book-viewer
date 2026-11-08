export interface MagazineIssueInfo {
  id: string;
  filename: string;
  title: string;
  aliases?: string[];
}

/**
 * Witch-Craft Magazine series authored in-game and exported via Stendhal.
 */
export const WITCHCRAFT_MAGAZINE_ISSUES: MagazineIssueInfo[] = [
  { id: 'intro', filename: 'intro.stendhal', title: 'What Is Witch-Craft?' },
  { id: 'issue1', filename: 'issue1.stendhal', title: 'Issue 1' },
  { id: 'issue2', filename: 'issue2.stendhal', title: 'Issue 2' },
  { id: 'issue3', filename: 'issue3.stendhal', title: 'Issue 3' },
  { id: 'issue4', filename: 'issue4.stendhal', title: 'Issue 4' },
  { id: 'issue5', filename: 'issue5.stendhal', title: 'Issue 5' },
  { id: 'issue6', filename: 'issue6.stendhal', title: 'Issue 6 Halloween Edition 2022' },
  { id: 'issue7', filename: 'issue7.stendhal', title: 'Issue 7 Christmas Edition 2022' },
  { id: 'issue8', filename: 'issue8.stendhal', title: 'Issue 8' },
  { id: 'issue9', filename: 'issue9.stendhal', title: 'Issue 9' },
  { id: 'issue10', filename: 'issue10.stendhal', title: 'Issue 10' },
  { id: 'issue11', filename: 'issue11.stendhal', title: 'Issue 11 Halloween Edition 2023' },
  { id: 'issue2023', filename: 'issue2023.stendhal', title: 'Issue X', aliases: ['issueX', 'issue-x', 'issue11.5', 'halloween-special-2023'] },
  { id: 'issue12', filename: 'issue12.stendhal', title: 'Issue 12 Christmas Edition 2023' },
  { id: 'issue13', filename: 'issue13.stendhal', title: 'Issue 13' },
  { id: 'issue14', filename: 'issue14.stendhal', title: 'Issue 14' },
  { id: 'issue15', filename: 'issue15.stendhal', title: 'Issue 15' },
  { id: 'issue16', filename: 'issue16.stendhal', title: 'Issue 16' },
  { id: 'issue17', filename: 'issue17.stendhal', title: 'Issue 17 Halloween Edition 2024' },
  { id: 'issue18', filename: 'issue18.stendhal', title: 'Issue 18' },
  { id: 'issue19', filename: 'issue19.stendhal', title: 'Issue 19 Christmas Edition 2024' },
  { id: 'issue20', filename: 'issue20.stendhal', title: 'Issue 20' },
];
