export type RexDesignDirectionId = "tactical" | "constellation" | "rpg";

export type RexDesignCriterion =
  | "Identité NeuroChess"
  | "Lisibilité"
  | "Premium"
  | "Originalité"
  | "Vibe RPG/progression"
  | "Sérieux échiquéen"
  | "Scalabilité UI"
  | "Animation utile"
  | "Potentiel Profil"
  | "Risque gadget";

export interface RexDesignScore {
  criterion: RexDesignCriterion;
  read: "fort" | "prometteur" | "a surveiller";
  note: string;
}

export interface RexDesignDirection {
  id: RexDesignDirectionId;
  navLabel: string;
  title: string;
  intent: string;
  vibe: string;
  tagline: string;
  strengths: string[];
  risks: string[];
  scores: RexDesignScore[];
}

export const REX_DESIGN_DIRECTION_IDS: RexDesignDirectionId[] = [
  "tactical",
  "constellation",
  "rpg",
];

export const rexDesignDirections: Record<RexDesignDirectionId, RexDesignDirection> = {
  tactical: {
    id: "tactical",
    navLabel: "Tactical Command",
    title: "Tactical Command Center",
    intent: "Précision froide pour transformer chaque partie en séquence de décisions utiles.",
    vibe: "Graphite, cyan froid, lignes fines, grille tactique, très peu de décoration.",
    tagline: "Cockpit d'analyse premium, sérieux, direct.",
    strengths: [
      "Lisibilité forte pour Review, Practice et décision critique.",
      "Risque faible de gadget visuel.",
      "Compatible avec une vérité moteur dure sans juger la personne.",
    ],
    risks: [
      "Peut sembler trop austère si le profil de progression reste faible.",
      "RPG/progression moins immédiat que les deux autres pistes.",
    ],
    scores: [
      { criterion: "Identité NeuroChess", read: "fort", note: "Très cohérent avec l'analyse des vraies parties." },
      { criterion: "Lisibilité", read: "fort", note: "Structure froide et lisible." },
      { criterion: "Premium", read: "fort", note: "Sobre, précise, peu décoratif." },
      { criterion: "Originalité", read: "prometteur", note: "Original si le langage décisionnel devient propriétaire." },
      { criterion: "Vibe RPG/progression", read: "a surveiller", note: "Moins émotionnel pour le grind long terme." },
      { criterion: "Sérieux échiquéen", read: "fort", note: "La direction la plus chess-first." },
      { criterion: "Scalabilité UI", read: "fort", note: "S'adapte bien aux surfaces productives." },
      { criterion: "Animation utile", read: "prometteur", note: "Scan et rail peuvent guider l'attention." },
      { criterion: "Potentiel Profil", read: "a surveiller", note: "Le profil devra gagner en chaleur." },
      { criterion: "Risque gadget", read: "fort", note: "Faible si les signaux restent rares." },
    ],
  },
  constellation: {
    id: "constellation",
    navLabel: "Constellation",
    title: "Progression Constellation",
    intent: "Faire du profil, du répertoire et des compétences un monde personnel à explorer.",
    vibe: "Cosmique sombre, violet, bleu, cyan, nœuds de progression, douceur premium.",
    tagline: "Identité longue durée, progression visible, envie de revenir.",
    strengths: [
      "Donne une vraie promesse au Profil.",
      "Très bon terrain pour répertoire, rangs, badges sobres et paliers.",
      "Peut rendre la progression quotidienne plus émotionnelle.",
    ],
    risks: [
      "Risque de devenir décoratif si les nœuds ne sont pas reliés à des actions.",
      "Demande une gouvernance stricte pour éviter la fausse science.",
    ],
    scores: [
      { criterion: "Identité NeuroChess", read: "prometteur", note: "Fort si relié aux vraies parties et au répertoire." },
      { criterion: "Lisibilité", read: "prometteur", note: "Doit limiter le nombre de nœuds." },
      { criterion: "Premium", read: "fort", note: "Bonne profondeur sans 3D." },
      { criterion: "Originalité", read: "fort", note: "Peut devenir une signature produit." },
      { criterion: "Vibe RPG/progression", read: "fort", note: "La direction la plus profil et long terme." },
      { criterion: "Sérieux échiquéen", read: "prometteur", note: "À garder ancré dans les ouvertures et décisions." },
      { criterion: "Scalabilité UI", read: "prometteur", note: "Bonne pour Profil, moins pour Review dense." },
      { criterion: "Animation utile", read: "prometteur", note: "Le mouvement montre la relation entre compétences." },
      { criterion: "Potentiel Profil", read: "fort", note: "La meilleure piste pour identité joueur." },
      { criterion: "Risque gadget", read: "a surveiller", note: "Élevé si les liens ne prouvent rien." },
    ],
  },
  rpg: {
    id: "rpg",
    navLabel: "Forge / Arena",
    title: "Forge / Arena RPG",
    intent: "Rendre l'entraînement désirant: grind utile, paliers de transfert, défi adulte.",
    vibe: "Graphite, amber contrôlé, coral pression, blasons sobres, énergie de jeu adulte.",
    tagline: "On transforme les erreurs en force, puis on vérifie en vraie partie.",
    strengths: [
      "Très bon pour motiver Practice, Forge, Arènes et objectifs.",
      "Rend l'XP utile et les rangs plus mémorables.",
      "Différencie fortement NeuroChess d'un simple analyseur.",
    ],
    risks: [
      "Peut basculer casino si les récompenses deviennent trop brillantes.",
      "Demande un langage visuel adulte, jamais cartoon.",
    ],
    scores: [
      { criterion: "Identité NeuroChess", read: "fort", note: "Clairement progression depuis les vraies parties." },
      { criterion: "Lisibilité", read: "prometteur", note: "Bonne si les modules restent peu nombreux." },
      { criterion: "Premium", read: "prometteur", note: "Fort potentiel avec graphite et accents contrôlés." },
      { criterion: "Originalité", read: "fort", note: "Plus distinctif que le dashboard classique." },
      { criterion: "Vibe RPG/progression", read: "fort", note: "La direction la plus grind." },
      { criterion: "Sérieux échiquéen", read: "a surveiller", note: "Doit rester ancré dans décisions, ouvertures, transfert." },
      { criterion: "Scalabilité UI", read: "prometteur", note: "Bonne pour Forge/Arène, à doser pour QG." },
      { criterion: "Animation utile", read: "prometteur", note: "Heat pulse et paliers peuvent être signifiants." },
      { criterion: "Potentiel Profil", read: "prometteur", note: "Bon via rang, arsenal, répertoire." },
      { criterion: "Risque gadget", read: "a surveiller", note: "Le risque principal de cette piste." },
    ],
  },
};
