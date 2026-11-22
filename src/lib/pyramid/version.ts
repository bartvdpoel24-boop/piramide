/** Bij elke wijziging een nieuwe versie bovenaan zetten. Het hoogste nummer is de huidige versie. */

export type Release = {
  version: number;
  date: string;
  notes: string[];
};

export const RELEASES: Release[] = [
  {
    version: 33,
    date: "2026-11-22",
    notes: ["CVE in minimatch (typescript-eslint) is bijgewerkt."],
  },
  {
    version: 32,
    date: "2026-11-22",
    notes: ["Bekende CVE's in Better Auth, Zod en Seroval zijn bijgewerkt."],
  },
  {
    version: 31,
    date: "2026-11-21",
    notes: ["Onder het cirkeldiagram op Home staat een link naar de statistieken."],
  },
  {
    version: 30,
    date: "2026-11-21",
    notes: [
      "Een nieuwe uitslag vul je in door op je tegenstander en daarna op de winnaar te tikken.",
    ],
  },
  {
    version: 29,
    date: "2026-11-20",
    notes: [
      "Home toont het cirkeldiagram, de uitdagingen en de laatste uitslagen.",
      "De tabs staan onderaan het scherm.",
    ],
  },
  {
    version: 28,
    date: "2026-11-20",
    notes: [
      "Doe je mee met één piramide, dan opent die meteen. Het startscherm slaan we over.",
      "Tijden staat in het menu.",
    ],
  },
  {
    version: 27,
    date: "2026-11-20",
    notes: ["De app start weer. Het laadscherm blijft staan tot de pagina klaar is."],
  },
  {
    version: 27,
    date: "2026-11-20",
    notes: [
      "Het Android-icoon is de poolpiramide en de app heet Piramide.",
      "Het splash screen toont de laadvoortgang en de laatste wijziging, en blijft tot de app geladen is.",
    ],
  },
  {
    version: 26,
    date: "2026-11-12",
    notes: ["Uitslagen staan overal op datum en tijd, de nieuwste bovenaan."],
  },
  {
    version: 25,
    date: "2026-11-12",
    notes: [
      "Bij een uitslag kies je ook de tijd. Oude scores die op 12:00 stonden krijgen de tijd van het invoeren.",
      "Bart kan een uitslag verwijderen.",
    ],
  },
  {
    version: 24,
    date: "2026-11-12",
    notes: [
      "Op de piramide kun je sorteren op een Elo-lijst. De nummers volgen die ranglijst.",
      "Iedereen kan iedereen uitdagen. De piramide schuift alleen volgens de piramideregels. De Elo wijzigt altijd.",
    ],
  },
  {
    version: 23,
    date: "2026-11-12",
    notes: [
      "Uitslagen toont alles, nieuwst ingevoerd eerst.",
      "De beheerder en de aanmaker kunnen een score wijzigen.",
    ],
  },
  {
    version: 22,
    date: "2026-11-12",
    notes: ["Achter een score staat hoeveel Elo die partij opleverde of kostte."],
  },
  {
    version: 21,
    date: "2026-11-12",
    notes: [
      "Iedereen heeft een Elo-rating naast de piramideplek.",
      "Deelnemers kun je sorteren op piramide of op Elo.",
      "In Info staat hoe de Elo wordt berekend.",
    ],
  },
  {
    version: 20,
    date: "2026-11-04",
    notes: ["Bij een uitslag met meerdere deelnemers staan alleen actieve, aangemelde spelers."],
  },
  {
    version: 19,
    date: "2026-11-04",
    notes: ["Bij een uitslag kies je de datum van de wedstrijd."],
  },
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
