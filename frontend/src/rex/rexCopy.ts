import type { RexSurfaceCopy, RexSurfaceId } from "./rexTypes";

export const rexPrototypeLabel = "Prototype REX - donnees illustratives";

export const rexSurfaceCopies: Record<RexSurfaceId, RexSurfaceCopy> = {
  qg: {
    id: "qg",
    navLabel: "QG",
    testId: "rex-surface-qg",
    eyebrow: "Quartier general",
    question: "Que dois-je faire maintenant pour progresser ?",
    promise: "Une priorite claire, un effort utile, aucune statistique presentee comme reelle.",
    emptyTitle: "La mission du jour sera branchee plus tard.",
    emptyBody:
      "R1 prouve seulement la structure. Les cartes ci-dessous montrent le type d'aide attendu, sans calcul et sans appel backend.",
    ctaLabel: "Voir la mission du jour",
    metrics: [
      { label: "XP disponible", value: "Prototype", note: "Reserve a un futur calcul valide." },
      { label: "Priorite", value: "A choisir", note: "Doit venir des vraies parties." },
      { label: "Revision due", value: "Exemple", note: "Aucune echeance creee ici." },
    ],
    cards: [
      {
        title: "Mission du jour",
        body: "Un seul levier d'entrainement doit dominer l'ecran.",
        status: "Placeholder",
      },
      {
        title: "Decision a revoir",
        body: "Ce coup peut etre mauvais ; toi, tu es en apprentissage.",
        status: "Doctrine",
      },
      {
        title: "Prochain levier",
        body: "La prochaine version reliera ce bloc a une partie reelle.",
        status: "Non connecte",
      },
    ],
    forbidden: ["vraie XP calculee", "metrique backend", "3D lourde"],
  },
  parties: {
    id: "parties",
    navLabel: "Parties",
    testId: "rex-surface-parties",
    eyebrow: "Source room",
    question: "Que disent mes vraies parties ?",
    promise: "Importer, analyser, puis transformer les moments critiques en decisions rejouables.",
    emptyTitle: "Aucune partie n'est importee dans ce prototype.",
    emptyBody:
      "Le bouton reste un repere de navigation. Il ne lance pas d'analyse et ne cree aucune donnee.",
    ctaLabel: "Importer une partie",
    metrics: [
      { label: "Import PGN", value: "A venir", note: "Entree utilisateur future." },
      { label: "Moments critiques", value: "Prototype", note: "Pas de moteur appele." },
      { label: "Sortie d'ouverture", value: "Illustratif", note: "Pas de classification reelle." },
    ],
    cards: [
      {
        title: "Review",
        body: "Le systeme jugera les decisions de la partie, pas la personne.",
        status: "Future surface",
      },
      {
        title: "Causes victoire / defaite",
        body: "R1 reserve l'espace pour une lecture plus franche et plus utile.",
        status: "Prototype",
      },
      {
        title: "Sortie d'ouverture",
        body: "Le futur produit devra distinguer la ligne connue du plan compris.",
        status: "A valider",
      },
    ],
    forbidden: ["analyse declenchee", "nouvel appel backend", "liste morte"],
  },
  forge: {
    id: "forge",
    navLabel: "Forge",
    testId: "rex-surface-forge",
    eyebrow: "Entrainement actif",
    question: "Comment je transforme mes erreurs en force ?",
    promise: "Les erreurs de parties deviennent des drills, des revisions et des lignes a rejouer.",
    emptyTitle: "La Forge reelle n'est pas encore codee.",
    emptyBody:
      "Ces modules sont des emplacements de travail. Aucune maitrise ni revision n'est calculee.",
    ctaLabel: "Ouvrir la Forge",
    metrics: [
      { label: "Practice", value: "Placeholder", note: "Pas de session creee." },
      { label: "Ligne d'ouverture", value: "Exemple", note: "Pas de score reel." },
      { label: "Maitrise", value: "Prototype", note: "Formule future requise." },
    ],
    cards: [
      {
        title: "Practice",
        body: "Rejouer les decisions utiles, avec feedback clair sur le coup.",
        status: "Surface future",
      },
      {
        title: "Revisions",
        body: "Revoir au bon moment sans polluer le plan du jour dans R1.",
        status: "Non connecte",
      },
      {
        title: "Opening Forge",
        body: "Transformer une ligne connue en plan jouable apres la sortie du livre.",
        status: "R4",
      },
    ],
    forbidden: ["Opening Forge reel", "score de maitrise reel", "puzzle trainer generique"],
  },
  arene: {
    id: "arene",
    navLabel: "Arène",
    testId: "rex-surface-arene",
    eyebrow: "Transfert controle",
    question: "Est-ce que ce que j'ai appris passe en vraie partie ?",
    promise: "Le transfert sera affiche par paliers, jamais comme verite brute.",
    emptyTitle: "L'Arene n'a pas encore de donnees reelles.",
    emptyBody:
      "R1 pose la place du transfert, des cadences et des saisons opt-in sans classement force.",
    ctaLabel: "Voir les defis de transfert",
    metrics: [
      { label: "Transfert", value: "Par paliers", note: "Non confirme / fragile / en progression / confirme." },
      { label: "Cadence", value: "Prototype", note: "Blitz, rapide, classique plus tard." },
      { label: "Saison", value: "Opt-in", note: "Pas de competition imposee." },
    ],
    cards: [
      {
        title: "Defis de transfert",
        body: "Verifier si l'entrainement tient quand la partie compte.",
        status: "Concept",
      },
      {
        title: "Robustesse sous pression",
        body: "Mesurer la decision observable, pas l'identite du joueur.",
        status: "A definir",
      },
      {
        title: "Ligues opt-in",
        body: "Competition saine, choisie, sans tableau humiliant.",
        status: "Futur",
      },
    ],
    forbidden: ["transfert brut", "vrai classement", "leaderboard force"],
  },
  profil: {
    id: "profil",
    navLabel: "Profil",
    testId: "rex-surface-profil",
    eyebrow: "Identite de progression",
    question: "Qui suis-je comme joueur et comment je progresse ?",
    promise: "Un hub de progression lisible : rang, repertoire, habitudes et preuves d'effort.",
    emptyTitle: "Le profil REX reste illustratif.",
    emptyBody:
      "Aucune promesse de rating, aucune etiquette personnelle, aucun asset visuel externe. Le Visual Lab reste en quarantaine.",
    ctaLabel: "Voir mon profil REX",
    metrics: [
      { label: "Rang", value: "Placeholder", note: "Aucun calcul de ligue." },
      { label: "Repertoire", value: "Prototype", note: "Ouvertures a brancher plus tard." },
      { label: "Habitudes", value: "Exemples", note: "Toujours liees a des coups observables." },
    ],
    cards: [
      {
        title: "Repertoire",
        body: "Afficher ce que le joueur joue vraiment, avec seuil d'echantillon.",
        status: "R3",
      },
      {
        title: "Alerte d'habitude",
        body: "Montrer des exemples de coups repetes, sans etiquette personnelle.",
        status: "Shadow first",
      },
      {
        title: "Visual Lab",
        body: "Les objets visuels restent en quarantaine tant que leur role n'est pas prouve.",
        status: "Dev-only",
      },
    ],
    forbidden: ["promesse de rating", "claim science", "asset visuel externe reel"],
  },
};

export function getRexSurfaceCopy(id: RexSurfaceId): RexSurfaceCopy {
  return rexSurfaceCopies[id];
}
