export const PLAYBOOK_GUIDES = [
  {
    "n": 1,
    "name": "The Doorbell",
    "credit": "after David Baker",
    "style": "Medium Swing · device: chromatic enclosures",
    "shape": "in &4 eighths · ⟳ upper–lower encloses target · ▼ 3rd of next chord on beat 1",
    "steps": [
      "Pick the target. A chord tone on the downbeat of the next chord. Thirds are the strongest doorbells.",
      "Pick the knock. Scale tone above plus chromatic below, below-above, or double chromatic from below.",
      "Count backwards. A 2-note knock starts on the and of 4. A 3-note knock starts on beat 4. The target owns beat 1."
    ],
    "notes": {
      "major": [
        "Chain the thirds: F into bar 1, B into bar 2, E into bar 3.",
        "G E F then C B♭ B then F D♯ E",
        "Each knock sits in the last two eighths of the previous bar."
      ],
      "minor": [
        "Targets: A♭ (♭5 of ii), B (3 of V), E♭ (♭3 of i).",
        "B♭ G A♭ then C B♭ B then F D E♭",
        "The ♭5 and ♭3 are the color of the minor key. Ring those bells hardest."
      ]
    },
    "cue": "Ring the bell on the 3rd.",
    "notation": {
      "major": "\"Dm7\"z4 GE \"G7\"F2 CB,=B2 z2 |\"Cmaj7\"FD E2 z4 |]",
      "minor": "\"Dm7b5\"z4 _B,G, \"G7alt\"_A,2 C_B,=B2 z2 |\"Cm6\"FD _E2 z4 |]"
    }
  },
  {
    "n": 2,
    "name": "The Escalator",
    "credit": "after Barry Harris",
    "style": "Medium Up Swing · device: bebop scales, added half step",
    "shape": "in 1 eighths, 8 per bar · ↓ descend the bebop scale · ▼ chord tones on 1, 2, 3, 4",
    "steps": [
      "Pick the scale with the extra step. The added chromatic makes 8 notes per bar so chord tones land on downbeats.",
      "Start on a chord tone, on a downbeat, going down. Descending is the default direction of the machine.",
      "Check the math. Root, ♭7, 5, 3 should fall on beats 1, 2, 3, 4. If they don't, add or remove one half step."
    ],
    "notes": {
      "major": [
        "Run G bebop dominant over the whole ii-V (Mixolydian plus natural 7):",
        "G F♯ F E D C B A | G",
        "Downbeats: G, F, D, B. Root, ♭7, 5, 3. Land on G or step B to C on the I."
      ],
      "minor": [
        "Same machine in the minor: C harmonic minor from G, with F♯ added:",
        "G F♯ F E♭ D C B A♭ | G",
        "Downbeats: G, F, D, B again. The A♭ at the end pulls straight into G on the i."
      ]
    },
    "cue": "Downbeats own the chord tones. The half step buys you time.",
    "notation": {
      "major": "\"Dm7\"\"G7\"GA^FE DCB,A, |\"Cmaj7\"G,8 |]",
      "minor": "\"Dm7b5\"\"G7alt\"G^FF_E DCB,_A, |\"Cm6\"G,8 |]"
    }
  },
  {
    "n": 3,
    "name": "The Quote",
    "credit": "after Charlie Parker",
    "style": "Bright Swing · device: stock bebop vocabulary",
    "shape": "in 1 eighths, 8 per bar · ↓ ↺ ↑ ↓ mixed contour · ▼ D steps up to 3rd of I",
    "steps": [
      "Pick one licensed sentence. A ii-V lick you have played a thousand times. One per key quality is enough tonight.",
      "Decide the entry beat. The same lick starting on 1 versus the and of 1 is two different lines.",
      "Plan the splice. Know the lick's last note and how it steps or encloses into the I chord. Never let a quote end in mid-air."
    ],
    "notes": {
      "major": [
        "One workhorse sentence, eight notes per bar:",
        "F E D C♯ D F A C | B A G F♯ G F E D | E",
        "Downbeats hit F, D, A on the ii and B, G, E on the V. The final D steps up to E."
      ],
      "minor": [
        "The minor sibling, same skeleton with the key's flats:",
        "F E♭ D C D F A♭ C | A♭ G F E♭ D C B D | E♭",
        "V-bar downbeats: A♭, F, D, B. That spells G7♭9 by itself. D resolves up to E♭."
      ]
    },
    "cue": "Sing the words in your head. The lick knows the way.",
    "notation": {
      "major": "\"Dm7\"FED^C DFAc |\"G7\"BAG^F GFED |\"Cmaj7\"E8 |]",
      "minor": "\"Dm7b5\"F_EDC DF_Ac |\"G7alt\"_AGF_E DCB,D |\"Cm6\"_E8 |]"
    }
  },
  {
    "n": 4,
    "name": "The Slingshot",
    "credit": "after Hal Galper",
    "style": "Medium Swing · device: forward motion, target-first hearing",
    "shape": "in on the & eighths · ↓ built backward from the landing · ▼ beat 1 of the next bar",
    "steps": [
      "Hear the destination first. Beat 1 of the next bar is the point of the phrase. Everything before it is pickup.",
      "Launch from an upbeat. Start on the and of 2 or the and of 4, never squarely on 1, so the line leans forward.",
      "Build backwards. Sing the landing note, then stack 2, then 4, then 8 pickup notes in front of it."
    ],
    "notes": {
      "major": [
        "Landing note: E, the 3rd of the I. Grow the pickup over G7:",
        "in &4 F D♯ E in &3 A G F D♯ E",
        "in 1 F E D C B A G D | E Downbeats F, D, B, G: the whole V chord falling into E."
      ],
      "minor": [
        "Landing note: E♭. Same growth over G7alt:",
        "in &4 F D E♭ in &3 A♭ G F D E♭",
        "in 1 A♭ G F E♭ D C B D | E♭ Downbeats A♭, F, D, B: G7♭9 spelled downhill."
      ]
    },
    "cue": "The line ends on 1. It doesn't start there.",
    "notation": {
      "major": "\"G7\"z6 F^D |\"Cmaj7\"E8 ||\n\"G7\"z4 AGFD |\"Cmaj7\"E8 ||\n\"G7\"FEDCB,A,G,D, |\"Cmaj7\"E,8 |]",
      "minor": "\"G7alt\"z6 FD |\"Cm6\"_E8 ||\n\"G7alt\"z4 _AGFD |\"Cm6\"_E8 ||\n\"G7alt\"_AGFE DCB,D, |\"Cm6\"_E,8 |]"
    }
  },
  {
    "n": 5,
    "name": "The Gallop",
    "credit": "after the Django school",
    "style": "Up Swing · device: rest-stroke triplet arpeggios",
    "shape": "in 1 triplets, one triad per beat · ↑ every triplet ascends · rest at the end · ▼ lands 3rd of i",
    "steps": [
      "One beat, one triad. Each triplet is a single triad or arpeggio fragment, nothing more.",
      "Map the picking. Rest stroke lands on every beat. Accents on the button first, erase them later.",
      "Chain by nearest inversion, then break the machine. The next triplet starts on the closest note of the next triad, no leaps between beats. End with a held note or a rest so the burst sounds like a phrase, not an exercise."
    ],
    "notes": {
      "major": [
        "Stack diatonic triads up the ii, then B°7 inversions carry the ♭9 over the V:",
        "D F A F A C A C E C E G",
        "B D F D F A♭ F A♭ B A♭ B D rest C",
        "Final D falls one step into C. Twelve notes of V tension, one-note release."
      ],
      "minor": [
        "Stack the half-diminished the same way, then the same B°7 engine:",
        "D F A♭ F A♭ C A♭ C E♭ C E♭ G",
        "B D F D F A♭ F A♭ B A♭ B D rest E♭",
        "Same right hand as the major. Only the ii bar and the landing change."
      ]
    },
    "cue": "One beat, one triad, rest stroke on the button.",
    "notation": {
      "major": "\"Dm7\"(3D,F,A, (3F,A,C (3A,CE (3CEG |\"G7\"(3B,DF (3DF_A (3F_AB (3_ABd |\"Cmaj7\"C8 |]",
      "minor": "\"Dm7b5\"(3D,F,_A, (3F,_A,C (3_A,C_E (3C_EG |\"G7alt\"(3B,DF (3DF_A (3F_AB (3_ABd |\"Cm6\"_E8 |]"
    }
  },
  {
    "n": 6,
    "name": "Two Coins",
    "credit": "after Gary Campbell",
    "style": "Medium Up Swing · device: triad pairs",
    "shape": "in 1 eighths, two triads per bar · ↑ ↑ both coins ascend · ▼ exit ½-step from home",
    "steps": [
      "Pick the pair. Two adjacent triads with no common tones that spell the sound of the chord.",
      "Pick the permutation. Up-up, up-down, or rotations (1-2-3, 2-3-1, 3-1-2). Decide once, don't improvise the pattern.",
      "Pick the exit coin. End on the pair note that sits a half step from your landing note on the next chord."
    ],
    "notes": {
      "major": [
        "ii bar: F + G triads (the dorian pair). F A C · G B D then rotate.",
        "V bar, altered color: D♭ + E♭ from A♭ melodic minor. D♭ F A♭ · E♭ G B♭ One coin alone works too: the D♭ triad by itself is the tritone sub.",
        "Exit: finish on F, fall a half step to E on Cmaj7."
      ],
      "minor": [
        "ii bar: B♭ + C from F melodic minor (locrian natural 2 sound). B♭ D F · C E G",
        "V bar: D♭ + E♭ again, same coins as the major's altered V.",
        "Exit: finish on A♭, fall a half step to G on Cm6."
      ]
    },
    "cue": "Flip the two coins, cash out a half step from home.",
    "notation": {
      "major": "\"Dm7\"(3F,A,C (3CA,F, (3G,B,D (3DB,G, |\"G7alt\"(3_DF_A (3_AF_D (3_EG_B (3_BG_E |\"Cmaj7\"E4 z4 |]",
      "minor": "\"Dm7b5\"(3_B,DF (3FD_B, (3CEG (3GEC |\"G7alt\"(3_DF_A (3_AF_D (3_EG_B (3_BG_E |\"Cm6\"G,4 z4 |]"
    }
  },
  {
    "n": 7,
    "name": "The Cell Chain",
    "credit": "after Jerry Bergonzi",
    "style": "Bright Swing · device: four-note cells",
    "shape": "in 1 eighths, two cells per bar · ↑ every cell rises · ▼ F falls to 3rd",
    "steps": [
      "Pick the cell. 1-2-3-5 is the mother cell. Run it off the root or off the 3rd of each chord.",
      "Pick the chain rule. Two cells per bar: root cell then 3rd cell, or transpose one cell chord to chord.",
      "Strong-beat check. The first note of every cell must be a chord tone on beat 1 or beat 3. Everything else is subordinate."
    ],
    "notes": {
      "major": [
        "Root cell plus 3rd cell on each chord:",
        "D E F A · F G A C | G A B D · B C D F | E",
        "Cells start on D, F, G, B: all chord tones, all strong beats. F falls to E."
      ],
      "minor": [
        "Same chain with the minor's flats folded in:",
        "D E♭ F A♭ · F G A♭ C | G A♭ B D · F A♭ B D | E♭",
        "The V bar's second cell is pure B°7. D steps up a half step into E♭."
      ]
    },
    "cue": "Four notes. The first one owns the beat.",
    "notation": {
      "major": "\"Dm7\"D,E,F,A, F,G,A,C |\"G7\"G,A,B,D B,CDF |\"Cmaj7\"E4 z4 |]",
      "minor": "\"Dm7b5\"D,_E,F,_A, F,G,_A,C |\"G7alt\"G,_A,B,D F,_A,B,D |\"Cm6\"_E4 z4 |]"
    }
  },
  {
    "n": 8,
    "name": "The Pivot",
    "credit": "after Randy Vincent",
    "style": "Medium Swing · device: pivot arpeggios",
    "shape": "in 1 eighths · ↑ up the 3rd's arpeggio · ↺ turn at the top · ↓ down a different road · ▼ lands 3rd",
    "steps": [
      "Pick the up vehicle. The arpeggio built off the 3rd: it gives you 3-5-7-9 for free.",
      "Pick the pivot note. The ceiling where the line turns around. Know it before you launch.",
      "Pick a different road down. Descend the scale or the next chord's arpeggio, never the same shape in reverse."
    ],
    "notes": {
      "major": [
        "ii: up Fmaj7, pivot at E, walk down the scale. V: up Bm7♭5, pivot at A, fall with the ♭9:",
        "F A C E D C B A | B D F A A♭ G F D | E"
      ],
      "minor": [
        "ii: up Fm7, pivot at E♭. V: up B°7, pivot at A♭, descend into the door of the i:",
        "F A♭ C E♭ D C B♭ A♭ | B D F A♭ G F E♭ D | E♭"
      ]
    },
    "cue": "Up the 3rd's arpeggio, turn at the top, come home a different road.",
    "notation": {
      "major": "\"Dm7\"F,A,CE DCB,A, |\"G7\"B,DFA _AGFD |\"Cmaj7\"E8 |]",
      "minor": "\"Dm7b5\"F,_A,C_E DC_B,_A, |\"G7alt\"B,DF_A GF_ED |\"Cm6\"_E8 |]"
    }
  },
  {
    "n": 9,
    "name": "One Ladder",
    "credit": "after Pat Martino",
    "style": "Medium Swing · device: scale choices, parent-scale thinking",
    "shape": "mental map no fixed rhythm · ↔ one parent scale until the V · V color is the pre-made decision · ▼ safe target (5th)",
    "steps": [
      "Collapse the changes. One parent scale covers the ii and the I. The V is the only real decision.",
      "Choose the V color before the tune starts. Mixolydian (inside), half-whole diminished (♭9 with 13), or altered via A♭ melodic minor. One choice per chorus.",
      "Mark the pivot notes. The one note that takes you into the color and the one that walks you out."
    ],
    "notes": {
      "major": [
        "Play C major (think D dorian) through the ii. On the V, slide the whole hand into A♭ melodic minor for altered; the shared B and F tritone is the hinge.",
        "Way in: F stays F. Way out: A♭ falls to G, or D♭ falls to C ."
      ],
      "minor": [
        "One scale, all three chords: C harmonic minor contains Dm7♭5, G7♭9, and Cm. No hand movement at all.",
        "Optional brightener: switch to C melodic minor on the i for the natural 6. Landing note: G , the 5th, always safe."
      ]
    },
    "cue": "One scale until the V. The V is a decision you already made.",
    "notation": {
      "major": "\"Dm7\"D,E,F,G, A,B,CD |\"G7alt\"_DCB,_A, G,F,_E,D, |\"Cmaj7\"C,8 |]",
      "minor": "\"Dm7b5\"D,_E,F,G, _A,=B,CD |\"G7alt\"DC=B,_A, G,F,_E,D, |\"Cm6\"G,8 |]"
    }
  },
  {
    "n": 10,
    "name": "The Stack",
    "credit": "after Bud Powell",
    "style": "Bright Swing · device: 3-to-9 arpeggios",
    "shape": "in 1 eighths, one arpeggio per bar · ↑ stacks rise · ½-step glue between stacks · ▼ 3rd",
    "steps": [
      "Start on the 3rd, never the root. Stack 3-5-7-9: instant color, no bass-player notes.",
      "Name the borrowed chord. 3-5-7-9 of any chord is a 7th chord you already own. Play that instead.",
      "Voice-lead the exits. The ♭7 of each chord falls a half or whole step to the next chord's 3rd. That's the glue between stacks."
    ],
    "notes": {
      "major": [
        "Borrowed chords: Dm7 becomes Fmaj7, G7 becomes Bm7♭5, Cmaj7 becomes Em7.",
        "F A C E | B D F A | E G B D",
        "Glue: C (♭7 of ii) falls to B, F (♭7 of V) falls to E."
      ],
      "minor": [
        "Borrowed chords: Dm7♭5 becomes Fm7, G7♭9 becomes B°7, Cm becomes E♭maj7.",
        "F A♭ C E♭ | B D F A♭ | E♭ G B♭ D",
        "Glue: C falls to B, F falls to E♭. If the i is CmMaj7, raise the stack's B♭ to B."
      ]
    },
    "cue": "Play the chord that lives on the 3rd.",
    "notation": {
      "major": "\"Dm7\"F,2A,2C2E2 |\"G7\"B,2D2F2A2 |\"Cmaj7\"E2G2B2d2 |]",
      "minor": "\"Dm7b5\"F,2_A,2C2_E2 |\"G7alt\"B,2D2F2_A2 |\"Cm6\"_E2G2_B2d2 |]"
    }
  },
  {
    "n": 11,
    "name": "The Bullseye",
    "credit": "after Mike Titlebaum",
    "style": "Medium Swing · device: single-target enclosure with guide-tone release",
    "shape": "in 1 eighths · ↑ ii arpeggio · ⟳ enclose target · ↓ release ♭7 into 3rd · ▼",
    "steps": [
      "Name one V-chord target. The 3rd, the root, or the 5th. Hear it before the pickup, not during.",
      "Surround it. Upper neighbor, lower chromatic, target. The enclosure makes the note unavoidable.",
      "Release the guide tone. After the hit, touch the V's ♭7 and let it fall into home. One enclosure, one release, done."
    ],
    "notes": {
      "major": [
        "Enclose B, the 3rd of G7, then F falls to E:",
        "F A C A | C B♭ B F | E",
        "Root variant: enclose G with A F♯ G then climb the stack B D F A from the landing."
      ],
      "minor": [
        "Enclose D, the 5th of G7, with E♭ above and C♯ below, then D rises a half step home:",
        "F A♭ C A♭ | B E♭ C♯ D | E♭",
        "Same dominant enclosure works in both modes. Only the destination changes, E to E♭."
      ]
    },
    "cue": "One target, surrounded, then let the ♭7 fall home.",
    "notation": {
      "major": "\"Dm7\"F,A,CA, \"G7\"C_B,=B,F |\"Cmaj7\"E4 z4 |]",
      "minor": "\"Dm7b5\"F,_A,C_A, \"G7alt\"=B,_E^CD |\"Cm6\"_E4 z4 |]"
    }
  },
  {
    "n": 12,
    "name": "The Ligon Step",
    "credit": "after Bert Ligon",
    "style": "Medium Swing · device: guide-tone outlines",
    "shape": "in 1 eighths · ↓ 3-2-1-♭7 outline chained across the bars · ▼ ♭7 falls ½-step to next 3rd",
    "steps": [
      "Start on the 3rd. The most defining note of the chord, on beat 1.",
      "Walk down to the ♭7. Scale steps: 3, 2, 1, ♭7. That is Outline No. 1, the skeleton of a thousand recorded lines.",
      "Half step into the next 3rd. The ♭7 sits a step from the next chord's 3rd. Repeat the outline there. Decorate later, skeleton first."
    ],
    "notes": {
      "major": [
        "The outline chained through both chords:",
        "F E D C | B A G F | E",
        "C falls to B, F falls to E. Two identical shapes, perfect voice leading, zero decisions mid-line."
      ],
      "minor": [
        "Same skeleton with the key's flats:",
        "F E♭ D C | B A♭ G F | E♭",
        "The E♭ over D and A♭ over G are the locrian and ♭9 colors arriving for free."
      ]
    },
    "cue": "Three, down to the seven, half step to the next three.",
    "notation": {
      "major": "\"Dm7\"FEDC \"G7\"B,A,G,F, |\"Cmaj7\"E,4 z4 |]",
      "minor": "\"Dm7b5\"F_EDC \"G7alt\"B,_A,G,F, |\"Cm6\"_E,4 z4 |]"
    }
  },
  {
    "n": 13,
    "name": "The Barry Ladder",
    "credit": "after Barry Harris",
    "style": "Medium Up Swing · device: movable half steps in the dominant descent",
    "shape": "in 1 eighths · ↑ climb · ↺ turn at the dominant · ↓ descend with movable ½-step spacers · ▼ spill into I",
    "steps": [
      "Pick the start note and beat. Any dominant chord tone on a downbeat can launch the descent, not just the root.",
      "Place the spacer for that start. Root-region starts take F♯ between root and ♭7. Other starts take the half step wherever it keeps chord tones on downbeats, E♭ between E and D or D♭ between D and C are the usual suspects.",
      "Cross the barline. Never stop at the V. The descent only means something once it spills inside the I."
    ],
    "notes": {
      "major": [
        "Climb to the dominant root, then descend with two movable spacers and land inside the I:",
        "D E F F♯ · G F E E♭ | D D♭ C B A G E C",
        "The half steps are functional spacers, not decoration. They keep the strong notes on strong beats."
      ],
      "minor": [
        "State the iiø arpeggio, compress the V into B°7 gravity, then approach the ♭3 from above:",
        "D F A♭ C · B A♭ G F | E E♭ G B C B A♭ G",
        "The E natural is a chromatic upper approach to E♭. The darkest half step in the book."
      ]
    },
    "cue": "Start anywhere on the chord. The spacer moves so the downbeats don't.",
    "notation": {
      "major": "\"Dm7\"DEF^F \"G7\"GFE_E D_DCB, A,G,E,C, |\"Cmaj7\"C,8 |]",
      "minor": "\"Dm7b5\"D,F,_A,C \"G7alt\"=B,_A,G,F, E_EGB c=B_AG |\"Cm6\"_E4 z4 |]"
    }
  },
  {
    "n": 14,
    "name": "The Arpeggio Relay",
    "credit": "after Bert Ligon",
    "style": "Medium Swing · device: nearest-motion arpeggio handoffs",
    "shape": "in 1 eighths · ↑ ↑ three arpeggios, nearest note at each baton pass · ▼ A or F falls a step home",
    "steps": [
      "Map the three structures. Root arpeggio on the ii, the rootless V (Bm7♭5 or B°7), an upper structure on the I.",
      "Find the handoffs. At each chord change, move to the nearest note of the next structure. No leaps at the baton pass.",
      "Resolve the top. Plan the final handoff before you start: A falls to G, or F falls to E."
    ],
    "notes": {
      "major": [
        "Dm7 hands to Bm7♭5 hands to Em7 over the tonic:",
        "D F A C | B D F A | G E C B A G E C",
        "C to B, A to G: every baton pass is a half or whole step. Harmonically specific, never a scale exercise."
      ],
      "minor": [
        "Dm7♭5 hands to B°7 hands to the tonic minor shape:",
        "D F A♭ C | B D F A♭ | G E♭ C B A♭ G E♭ C",
        "The B natural inside the tonic bar is the minor-major 7 color keeping the cadence sophisticated."
      ]
    },
    "cue": "Pass the baton to the nearest hand.",
    "notation": {
      "major": "\"Dm7\"D,F,A,C \"G7\"B,DFA \"Cmaj7\"GECB, A,G,E,C, |]",
      "minor": "\"Dm7b5\"D,F,_A,C \"G7alt\"B,DF_A \"Cm6\"G_ECB, _A,G,_E,C, |]"
    }
  },
  {
    "n": 15,
    "name": "The ♭9 Reset",
    "credit": "from the Line Games deck",
    "style": "Bright Swing · device: diminished arpeggio to the ♭9, resolved to the 5th",
    "shape": "in 1 eighths · ↑ ii arpeggio · ↑ diminished arp to ♭9 on top · ½-step down · ▼ 5th of home (G)",
    "steps": [
      "Spell the ii plainly. Root arpeggio, nothing fancy. It sets up the contrast.",
      "Run the dim arp from the V's 3rd. B D F A♭ is G7♭9 with no root. Climb it to the ♭9 on top.",
      "Resolve ♭9 to the 5th of home. A♭ falls a half step to G. Landing on the 5th, not the 3rd, is the cooler, more open arrival."
    ],
    "notes": {
      "major": [
        "D F A C | B D F A♭ | G",
        "Two plain arpeggios and one half step. The whole cadence in nine notes."
      ],
      "minor": [
        "D F A♭ C | B D F A♭ | G",
        "Identical engine, one note different in the ii. Learn it once, own it twice."
      ]
    },
    "cue": "Climb the diminished ladder, step off at the top.",
    "notation": {
      "major": "\"Dm7\"D,F,A,C |\"G7\"B,DF_A |\"Cmaj7\"G,4 z4 |]",
      "minor": "\"Dm7b5\"D,F,_A,C |\"G7alt\"B,DF_A |\"Cm6\"G,4 z4 |]"
    }
  },
  {
    "n": 16,
    "name": "The Chromatic Bridge",
    "credit": "after Charlie Christian",
    "style": "Up Swing · device: chromatic roads between structural posts",
    "shape": "in 1 eighths · ↑ ½-step spine between structural posts · ▼ unambiguous landing on chord tone, then stop",
    "steps": [
      "Set the posts. One structural note per chord: D on the ii, G on the V, C or E on the I. The posts are non-negotiable.",
      "Choose the bridge length. The full spine, every half step from post to post, or a short 5-note passing run dropped inside a scale descent.",
      "Prove the cadence. After the chromatic blur, land unambiguously and stop. The ear forgives density when the endpoints are clean."
    ],
    "notes": {
      "major": [
        "Full spine, D to home entirely by half step:",
        "D E♭ E F F♯ G A♭ A B♭ B | C E G",
        "Short bridge inside a G7 descent: B B♭ A A♭ G F D D♯ | E"
      ],
      "minor": [
        "Same spine, one more half step, minor destination:",
        "D E♭ E F F♯ G A♭ A B♭ B C | E♭ G F E♭ D",
        "On the way up it spells ♭9, ♯9, and every altered color without naming any of them."
      ]
    },
    "cue": "Clear posts, blurry road, clean arrival.",
    "notation": {
      "major": "\"Dm7\"D_EE=F^F \"G7\"G_AA=B_B=B |\"Cmaj7\"C4 EG |]",
      "minor": "\"Dm7b5\"D_EE=F^F \"G7alt\"G_AA=B_B=BC |\"Cm6\"_E4 GF_ED |]"
    }
  },
  {
    "n": 17,
    "name": "The Language Patch",
    "credit": "from the Line Games deck",
    "style": "Medium Swing · device: one fixed cell, patched entry and exit",
    "shape": "in 1 eighths · ↑ front patch · ↓ fixed dominant cell · ↓ back patch · ▼ D rises to landing",
    "steps": [
      "Fix the middle. One cell that spells the V: B D F A♭ carries the 3, 5, ♭7, and ♭9. It never changes.",
      "Patch the front. Enter from ii material that ends a half step above the cell. C to B works from both ii chords.",
      "Patch the back. Rewrite only the last note or two so the same cell resolves to E in major, E♭ in minor. Grammar, not memorization."
    ],
    "notes": {
      "major": [
        "F G A C | B D F A♭ G F E D | E",
        "Front patch F G A C, fixed cell B D F A♭, back patch G F E D falling home."
      ],
      "minor": [
        "F G A♭ C | B D F A♭ G F E D | E♭",
        "One note changes in the front, zero in the middle, and the same D now rises to E♭. The cell keeps its identity, the ending gives it citizenship."
      ]
    },
    "cue": "Reusable middle, context-sensitive front and back.",
    "notation": {
      "major": "\"Dm7\"F,G,A,C \"G7\"B,DF_A GFED |\"Cmaj7\"E8 |]",
      "minor": "\"Dm7b5\"F,G,_A,C \"G7alt\"B,DF_A GFED |\"Cm6\"_E8 |]"
    }
  },
  {
    "n": 18,
    "name": "The Nine Landing",
    "credit": "from the Line Games deck",
    "style": "Medium Swing · device: altered cell resolving to the 9",
    "shape": "in 1 eighths · ↑ ii arpeggio · ↑ 1-2-♭3-5 cell off the ♭9 · ▼ park on the 9 (D) and let it hang",
    "steps": [
      "Think A♭ melodic minor on the V. The altered pool. Every note in it is a legal tension over G7.",
      "Play the cell off the ♭9. A♭ B♭ B E♭, the 1-2-♭3-5 shape built on A♭.",
      "Land on the 9 and stop. E♭ falls a half step to D. Not the root, not the 3rd. A color-tone destination tells the band you meant it."
    ],
    "notes": {
      "major": [
        "F A C E | A♭ B♭ B E♭ | D",
        "D is the 9 of Cmaj7. Let it hang unresolved for a full beat before you move."
      ],
      "minor": [
        "D F A♭ C | A♭ B♭ B E♭ | D",
        "Same landing, darker room. The ♭13 falling to the 9 is the sound of the altered scale doing its one job."
      ]
    },
    "cue": "Aim past the obvious notes. Park on the 9.",
    "notation": {
      "major": "\"Dm7\"F,A,CE |\"G7alt\"_A_B=B_E |\"Cmaj7\"D4 z4 |]",
      "minor": "\"Dm7b5\"D,F,_A,C |\"G7alt\"_A_B=B_E |\"Cm6\"D4 z4 |]"
    }
  },
  {
    "n": 19,
    "name": "The Rule of Thirds",
    "credit": "after Vincent & Alexander",
    "style": "Medium Up Swing · device: one grip through three melodic minors",
    "shape": "in 1 eighths · ↑ one 4-note grip planed up a minor 3rd, then up a major 3rd · ▼ lands ♭3 by construction",
    "steps": [
      "One grip on the iiø. D E F A♭, out of F melodic minor. Lean on the E natural, the locrian ♮2 brightness.",
      "Slide it up a minor 3rd for the V. F G A♭ B now lives in A♭ melodic minor: instant altered, same fingers.",
      "Slide it up a major 3rd for the i. A B C E♭ is pure C melodic minor, and the grip's last note is your landing ♭3."
    ],
    "notes": {
      "major": [
        "Major keys only lend the V out. Same grip from A♭ over G7, then step up to home:",
        "F A C E | A♭ B♭ B D | E",
        "The full three-handle relay below is a minor-key luxury."
      ],
      "minor": [
        "One shape, planed twice, never a wrong note:",
        "D E F A♭ | F G A♭ B | A B C E♭",
        "F melodic minor, A♭ melodic minor, C melodic minor. Three environments, one grip, and the line ends on the ♭3 by construction."
      ]
    },
    "cue": "Same fingers, up a minor 3rd, up a major 3rd, home.",
    "notation": {
      "major": "\"Dm7\"F,A,CE |\"G7alt\"_A_B=BD |\"Cmaj7\"E4 z4 |]",
      "minor": "\"Dm7b5\"D,=E,F,_A, |\"G7alt\"F,G,_A,=B, |\"Cm6\"A,=B,C_E |]"
    }
  },
  {
    "n": 20,
    "name": "The Side-Slip",
    "credit": "from the Line Games deck",
    "style": "Bright Swing · device: half-step planing for outside color",
    "shape": "in 1 eighths · ↑ plain arpeggio · ↔ plane the same grip up ½-step · ↓ slide back home · ▼",
    "steps": [
      "State something plain on the ii. The root arpeggio is enough. Simplicity here is what makes the slip audible.",
      "Plane the identical grip up a half step on the V. Instant outside, zero calculation. The rhythm and contour stay exactly the same.",
      "Fall a half step back in. The top note sits one half step above home. Resolve it, then show a chord tone so the ear forgives everything."
    ],
    "notes": {
      "major": [
        "D F A C | E♭ G♭ B♭ D♭ | C E G",
        "The slipped bar happens to spell E♭m7, thick altered color over G7 without one theory thought."
      ],
      "minor": [
        "D F A♭ C | E♭ G♭ A D♭ | C E♭ G",
        "Same slip, then confirm the minor triad immediately. Outside is a place you visit, not a place you live."
      ]
    },
    "cue": "Copy, paste a half step up, slide back home.",
    "notation": {
      "major": "\"Dm7\"D,F,A,C |\"G7alt\"_E,_G,_B,_D |\"Cmaj7\"C,E,G,z |]",
      "minor": "\"Dm7b5\"D,F,_A,C |\"G7alt\"_E,_G,A,_D |\"Cm6\"C,_E,G,z |]"
    }
  },
  {
    "n": 21,
    "name": "The Anticipation",
    "credit": "after Hal Galper",
    "style": "Medium Up Swing · device: harmonic forward motion, arrive early",
    "shape": "in 1 eighths · V material invades on the &3 of the ii bar · ↓ altered tones straddle the barline · ▼ chord tone proves the V on beat 1",
    "steps": [
      "Pre-hear the next chord's material. While the ii is sounding, your ear is already on the V's altered tones.",
      "Start it early. On the and of 3 of the ii bar, begin playing tomorrow's chord today. Four notes of it.",
      "Land a chord tone exactly on beat 1. The barline confirms what your ear already announced. The Slingshot moves rhythm early; this moves the harmony itself."
    ],
    "notes": {
      "major": [
        "Altered material invades the ii bar, then B proves the V on its downbeat:",
        "F A C E ·V→· A♭ G♭ E♭ D♭ | B D F A♭ G F E D | E"
      ],
      "minor": [
        "Same invasion, darker rooms on both sides of the barline:",
        "F A♭ C E♭ ·V→· A♭ G♭ E♭ D♭ | B D F A♭ G F E D | E♭"
      ]
    },
    "cue": "Play tomorrow's chord today, prove it on the downbeat.",
    "notation": {
      "major": "\"Dm7\"F,A,CE _A_G_E_D |\"G7\"=BDF_A GFED |\"Cmaj7\"E8 |]",
      "minor": "\"Dm7b5\"F,_A,C_E _A_G_E_D |\"G7alt\"=BDF_A GFED |\"Cm6\"_E8 |]"
    }
  },
  {
    "n": 22,
    "name": "The Motif Squeeze",
    "credit": "after Wes Montgomery",
    "style": "Medium Swing · device: state, transform, answer",
    "shape": "in 1 eighths, 4-note motif · ↑ state · ↑ transform (same contour, altered notes) · ↓ answer · ▼",
    "steps": [
      "State a contour on the ii. Four notes, strong rhythm, memorable shape. 1-2-♭3-5 is a fine mother contour.",
      "Transform it on the V. Move the same contour so it names the dominant. Alter one or two notes for tension, keep the rhythm identical.",
      "Answer it on the I. Simpler, quieter, then air. The listener follows the shape, not the theory."
    ],
    "notes": {
      "major": [
        "D E F A | G A B♭ D | C D E G · E D C B",
        "The B♭ over G7 is the ♯9 doing the transforming. The answer is 1-2-3-5, the motif with its shoes off."
      ],
      "minor": [
        "D F A♭ F | G B♭ D♭ B♭ | C E♭ G E♭ · D C B C",
        "Same contour three times, and the closing B to C gives the tonic minor its leading-tone amen."
      ]
    },
    "cue": "Say it, sharpen it, answer it, breathe.",
    "notation": {
      "major": "\"Dm7\"DEFA |\"G7\"GA_BD |\"Cmaj7\"CDEG EDCB, |]",
      "minor": "\"Dm7b5\"DF_AF |\"G7alt\"G_B_d_B |\"Cm6\"C_EG_E DC=B,C |]"
    }
  },
  {
    "n": 23,
    "name": "The Victory Lap",
    "credit": "from the Line Games deck",
    "style": "Medium Swing · device: tonic-bar moves after the cadence",
    "shape": "on the I bar eighths · ↑ climb with G♯ spacer (maj) or ↕ line-cliché over ringing G (min) · ▼ park on a color tone",
    "steps": [
      "The cadence is over. This play is for the I bar itself: decorate home without leaving it.",
      "Major: bebop major ascent. Climb the arpeggio with G♯ as the spacer between 5 and 6, crest, fall to the 3rd. Minor: walk the top voice down C, B, B♭, A against a ringing G.",
      "Stop on a color tone. The 3rd in major, the 6th in minor. Let it hang; the silence after is part of the line."
    ],
    "notes": {
      "major": [
        "C E G G♯ A B G E",
        "The G♯ is a spacer, not a wrong note. It keeps the chord tones on the beats all the way up."
      ],
      "minor": [
        "The line cliché, each step pivoting off G: C G · B G · B♭ G · A Stopping on A is Cm6 talking.",
        "The Honeysuckle twist: interrupt the descent with a D minor triad and finalize on the ♭3. C B B♭ A · A F D | E♭"
      ]
    },
    "cue": "You already won. Take the lap, park on a color tone.",
    "notation": {
      "major": "\"Cmaj7\"CEG^G ABG E4 |]",
      "minor": "\"Cm6\"CG=BG _BG AG z4 |]"
    }
  },
  {
    "n": 24,
    "name": "The Half-Time Lens",
    "credit": "from the Line Games deck",
    "style": "Ballad or Burning · device: half-time perception, over-the-bar phrasing",
    "shape": "in 1 half-time feel · ↓ one long legato line over the barline · rest before landing · ▼ late arrival on beat 3",
    "steps": [
      "Hear the tempo at half speed. Fast eighths become relaxed sixteenths in your head. The panic leaves, the pocket stays.",
      "Play one long legato stream. No punctuation at the chord changes; the line breathes across the barline, triplets welcome.",
      "Land late on purpose. Beat 3 instead of beat 1. The space before the landing is part of the phrase, not a mistake."
    ],
    "notes": {
      "major": [
        "One unbroken stream, then a deliberate late arrival:",
        "F A C E D C B A | B D F A A♭ G F D | rest E on 3"
      ],
      "minor": [
        "Mixolydian ♭13 gives the V its dark legato color:",
        "F E♭ D C B A G F | E♭ D C B A G F D | rest E♭ on 3"
      ]
    },
    "cue": "Half speed in the head, long line in the hands, land late.",
    "notation": {
      "major": "\"Dm7\"F,A,CE DCB,A, |\"G7\"B,DFA _AGFD |\"Cmaj7\"z4 E4 |]",
      "minor": "\"Dm7b5\"F,_E,D,C, \"G7alt\"_E,D,C,=B,, A,,G,,F,,D,, |\"Cm6\"z4 _E,4 |]"
    }
  }
]

export function playbookGuide(number) {
  return PLAYBOOK_GUIDES.find((guide) => guide.n === number) || null
}

