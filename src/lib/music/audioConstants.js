// Audio constants that don't depend on Tone.js — safe to import anywhere
// (Importing audio.js directly triggers Tone.js at module-eval time, creating
//  an AudioContext before a user gesture and causing browser warnings.)

export const DRUM_STYLES = [
  {
    name:  "Jazz Ride",
    // Classic bebop: ride on 1 &1 2 3 &3 4, kick on 1, hi-hat foot on 2 & 4
    ride:  [0.55, 0.30, 0.55, 0,    0.55, 0.30, 0.55, 0   ],
    kick:  [0.75, 0,    0,    0,    0,    0,    0,    0   ],
    hihat: [0,    0,    0.60, 0,    0,    0,    0.60, 0   ],
  },
  {
    name:  "Four on Floor",
    // Driving straight-8s: kick on every beat, ride on all 8ths, no hat
    ride:  [0.60, 0.30, 0.60, 0.30, 0.60, 0.30, 0.60, 0.30],
    kick:  [0.80, 0,    0.72, 0,    0.72, 0,    0.72, 0   ],
    hihat: [0,    0,    0,    0,    0,    0,    0,    0   ],
  },
  {
    name:  "Brushes",
    // Intimate brush sweep: same ride shape but quieter, soft kick, light hat
    ride:  [0.30, 0.16, 0.30, 0,    0.30, 0.16, 0.30, 0   ],
    kick:  [0.38, 0,    0,    0,    0,    0,    0,    0   ],
    hihat: [0,    0,    0.32, 0,    0,    0,    0.32, 0   ],
  },
  {
    name:  "Bossa Nova",
    // Cross-stick Latin feel: syncopated ride, kick on 1 & &2, hat on the &s
    ride:  [0.55, 0,    0.45, 0.55, 0,    0.55, 0.45, 0   ],
    kick:  [0.65, 0,    0,    0.58, 0,    0.52, 0,    0   ],
    hihat: [0,    0.38, 0,    0,    0.38, 0,    0,    0.38],
  },
  {
    name:  "Ballad",
    // Sparse, spacious: beats 1 & 3 on ride, very light kick, hat on 2 & 4
    ride:  [0.48, 0,    0.34, 0,    0.48, 0,    0.34, 0   ],
    kick:  [0.50, 0,    0,    0,    0,    0,    0,    0   ],
    hihat: [0,    0,    0.44, 0,    0,    0,    0.44, 0   ],
  },
]
