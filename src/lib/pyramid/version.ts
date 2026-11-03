/** Bij elke wijziging een nieuwe versie bovenaan zetten. Het hoogste nummer is de huidige versie. */

export type Release = {
  version: number;
  date: string;
  notes: string[];
};

export const RELEASES: Release[] = [
  {
    version: 18,
    date: "2026-11-03",
    notes: [
      "Een verouderde pagina laadt zichzelf opnieuw, in plaats van een fout bij het openen van een piramide.",
    ],
  },
  {
    version: 17,
    date: "2026-11-03",
    notes: [
      "Instellingen klappen open per onderdeel.",
      "Backup maken en terugzetten.",
      "In de instellingen zie je of de gegevens op Neon staan, met host en database.",
    ],
  },
  {
    version: 16,
    date: "2026-11-03",
    notes: ["Poolregels in het menu: call-shot 8-ball, je noemt bal en pocket van tevoren."],
  },
  {
    version: 15,
    date: "2026-11-03",
    notes: [
      "Standaard zie je alleen aangemelde spelers.",
      "Onder de scores staat head to head tegen jezelf, met een cirkeldiagram.",
    ],
  },
  {
    version: 14,
    date: "2026-11-03",
    notes: [
      "Een briefje of deelnemer aanklikken maakt van de piramide een lijst, met de acties ernaast.",
      "Scores van die persoon staan op één regel, met een icoon voor winst en verlies.",
      "Onderaan die scores een cirkeldiagram met het percentage winst en verlies.",
      "Head to head in het menu: twee spelers, hun partijen en de scores opgeteld.",
      "Staat iemand te ver weg, dan nodig je uit om vrij te spelen. De piramide blijft staan.",
    ],
  },
  {
    version: 13,
    date: "2026-10-29",
    notes: [
      "Bij een uitdaging kies je een datum.",
      "Is die datum vijf dagen geleden en is er nog geen uitslag, dan vervalt de uitdaging.",
      "Nieuwe uitslagen van vandaag staan onder de knop Uitslagen.",
    ],
  },
  {
    version: 12,
    date: "2026-10-28",
    notes: [
      "Een nieuwe uitslag mag met meer dan twee spelers. Alleen hun plekken schuiven, briefjes ertussen blijven hangen.",
      "Een winstreeks staat op het briefje en valt terug naar nul bij verlies.",
      "De drie langste reeksen staan bij de statistieken.",
    ],
  },
  {
    version: 11,
    date: "2026-10-28",
    notes: [
      "Cirkeldiagram met de verdeling van de winsten, ook op het startscherm voor deze maand.",
      "Een score wijzigen kan door wie gespeeld heeft en door de beheerder.",
      "Een briefje weghalen vraagt bevestiging. Het account blijft, en het briefje kan terug.",
      "Feedback opent direct een GitHub-issue.",
    ],
  },
  {
    version: 10,
    date: "2026-10-23",
    notes: [
      "De app heet Piramide, met een piramide als icoon.",
      "In de instellingen kun je een e-mailadres invullen. Een uitdaging gaat dan ook per mail.",
    ],
  },
  {
    version: 9,
    date: "2026-10-23",
    notes: [
      "Menu met een nieuwe piramide, demo, uitloggen, instellingen en info.",
      "Tabbladen voor piramide, uitslagen, uitdagingen, tijden en deelnemers.",
      "Uitdagingen en recente uitslagen op het startscherm.",
      "Statistieken: partijen per maand, meeste winst, beste percentage en stippen.",
      "Op het briefje staan de datum en de uitslag van de laatste partij.",
    ],
  },
  {
    version: 8,
    date: "2026-10-22",
    notes: [
      "Alleen Bart van der Poel haalt iemand van de ladder.",
      "Iemand onder je nodig je uit. Uitdagen kan alleen naar boven, binnen het bereik.",
    ],
  },
  {
    version: 7,
    date: "2026-10-22",
    notes: ["Je kunt je eigen naam op het briefje wijzigen."],
  },
  {
    version: 6,
    date: "2026-10-22",
    notes: [
      "Je ziet wie zich met de code heeft aangemeld.",
      "De piramide is te filteren op alleen aangemelde spelers.",
    ],
  },
  {
    version: 5,
    date: "2026-10-22",
    notes: ["Alleen degene die uitgedaagd is, kan de uitdaging accepteren of afwijzen."],
  },
  {
    version: 4,
    date: "2026-10-22",
    notes: [
      "Feedback wordt een GitHub-issue.",
      "Meerdere tijden op dezelfde dag mogen.",
    ],
  },
  {
    version: 3,
    date: "2026-10-22",
    notes: ["Gelijkspel mag. De briefjes blijven dan hangen."],
  },
  {
    version: 2,
    date: "2026-10-22",
    notes: ["Geef feedback opent een melding op GitHub."],
  },
  {
    version: 1,
    date: "2026-10-22",
    notes: ["Eerste versie: de piramide, uitdagingen, uitslagen en een demo."],
  },
];

export const VERSION = RELEASES[0]?.version ?? 1;
