// store the actual name and aliases for generating the Aliases map
const nameMap: { actualName: string; aliases: string[] }[] = [
  {
    actualName: "Dr. Au Wing Chi Lisa",
    aliases: ["Dr. Lisa Au", "Dr. Au Wing Chi Liza", "Dr. Liza Au"],
  },
  {
    actualName: "Dr. Cheng Sze Wing Shirley",
    aliases: [
      "Dr. Cheng Sze Wing",
      "Dr Cheng Sze Wing",
      "Dr, Cheng Sze Wing",
      "Dr.Cheng Sze Wing",
    ],
  },
  {
    actualName: "Dr. Chan Yap Hang Will",
    aliases: ["Dr. Chan Yap Hang, Will", "Dr. Chan Yap Hang      Will"],
  },
  {
    actualName: "Dr. Chung Hon Yin Brian",
    aliases: ["Dr Brian Chung", "Dr. Brian Chung", "Brian Chung"],
  },
  {
    actualName: "Dr. Chong Shuk Ching Josephine",
    aliases: ["Dr. J Chong", "Dr J Chong", "Dr S C Chong", "Dr. S C Chong"],
  },
];

/**
 * Dynamically generated aliases map for referring clinicians
 */
const ALIASES = new Map<string, string>();

nameMap.forEach(({ actualName, aliases }) => {
  aliases.forEach((alias) => {
    ALIASES.set(alias.toLocaleLowerCase(), actualName);
  });
});

export default ALIASES;
