import { Note, Interval } from "@tonaljs/tonal"
import { buildChordSymbol } from "@/lib/music/tonal"

function chroma(note) {
  return Note.chroma(note)
}

function semitoneUp(note, semitones) {
  return Note.simplify(Note.transpose(note, Interval.fromSemitones(semitones)))
}

function intervalBetweenRoots(fromRoot, toRoot) {
  const a = chroma(fromRoot)
  const b = chroma(toRoot)

  if (a == null || b == null) return null

  return (b - a + 12) % 12
}

function isDominantQuality(quality) {
  return quality === "7" || quality === "7alt"
}

function isMinorQuality(quality) {
  return quality === "min7" || quality === "min6"
}

function isMajorQuality(quality) {
  return quality === "maj7" || quality === "maj6"
}

function isHalfDimQuality(quality) {
  return quality === "min7b5"
}

export function detectLocalFunction(bar, prevBar = null, nextBar = null) {
  const { root, quality } = bar

  if (isDominantQuality(quality)) {
    if (nextBar) {
      const motion = intervalBetweenRoots(root, nextBar.root)

      if (motion === 5 || motion === 11) {
        return "dominant"
      }

      if (motion === 1) {
        return "backdoor / side-slip"
      }
    }

    return "dominant color"
  }

  if (isMinorQuality(quality)) {
    if (nextBar && isDominantQuality(nextBar.quality)) {
      const motion = intervalBetweenRoots(root, nextBar.root)
      if (motion === 5) return "predominant"
    }

    return "minor color"
  }

  if (isHalfDimQuality(quality)) {
    return "predominant"
  }

  if (isMajorQuality(quality)) {
    if (prevBar && isDominantQuality(prevBar.quality)) {
      const motion = intervalBetweenRoots(prevBar.root, root)
      if (motion === 5 || motion === 11) return "tonic arrival"
    }

    return "tonic / major color"
  }

  return "color"
}

export function detectCadenceAt(bars, index) {
  const a = bars[index]
  const b = bars[index + 1]
  const c = bars[index + 2]

  if (!a || !b) return null

  const abMotion = intervalBetweenRoots(a.root, b.root)

  if (isDominantQuality(a.quality) && isMajorQuality(b.quality)) {
    if (abMotion === 5 || abMotion === 11) {
      return {
        type: "V–I",
        bars: [index, index + 1],
      }
    }
  }

  if (isDominantQuality(a.quality) && isMinorQuality(b.quality)) {
    if (abMotion === 5 || abMotion === 11) {
      return {
        type: "V–i",
        bars: [index, index + 1],
      }
    }
  }

  if (a && b && c) {
    const bcMotion = intervalBetweenRoots(b.root, c.root)

    if (isMinorQuality(a.quality) && isDominantQuality(b.quality) && isMajorQuality(c.quality)) {
      if (abMotion === 5 && (bcMotion === 5 || bcMotion === 11)) {
        return {
          type: "ii–V–I",
          bars: [index, index + 1, index + 2],
        }
      }
    }

    if (isHalfDimQuality(a.quality) && isDominantQuality(b.quality) && isMinorQuality(c.quality)) {
      if (abMotion === 5 && (bcMotion === 5 || bcMotion === 11)) {
        return {
          type: "iiø–V–i",
          bars: [index, index + 1, index + 2],
        }
      }
    }
  }

  if (isMinorQuality(a.quality) && isDominantQuality(b.quality)) {
    if (abMotion === 5) {
      return {
        type: "ii–V fragment",
        bars: [index, index + 1],
      }
    }
  }

  return null
}

export function analyzeProgressionContext(bars) {
  const cadences = []

  for (let i = 0; i < bars.length; i += 1) {
    const cadence = detectCadenceAt(bars, i)
    if (cadence) cadences.push(cadence)
  }

  return bars.map((bar, index) => {
    const prev = bars[index - 1] || null
    const next = bars[index + 1] || null

    const cadenceLabels = cadences
      .filter((c) => c.bars.includes(index))
      .map((c) => c.type)

    return {
      index,
      symbol: bar.symbol,
      root: bar.root,
      quality: bar.quality,
      functionLabel: detectLocalFunction(bar, prev, next),
      cadenceLabels,
      hasCadence: cadenceLabels.length > 0,
    }
  })
}

export function suggestContextualSubstitution(bars, index, mood = "inside") {
  const bar = bars[index]
  const next = bars[index + 1] || null
  const prev = bars[index - 1] || null

  if (!bar) return null

  if (isDominantQuality(bar.quality)) {
    const tritoneRoot = semitoneUp(bar.root, 6)
    const tritone = {
      root: tritoneRoot,
      quality: "7",
      symbol: buildChordSymbol(tritoneRoot, "7"),
      label: "Tritone sub",
      reason: "Keeps dominant pull while changing bass motion.",
    }

    if (next) {
      const motion = intervalBetweenRoots(bar.root, next.root)

      if ((motion === 5 || motion === 11) && mood === "inside") {
        return tritone
      }

      if (motion === 1) {
        return {
          root: bar.root,
          quality: "7alt",
          symbol: buildChordSymbol(bar.root, "7alt"),
          label: "Altered dominant",
          reason: "Tightens chromatic dominant tension into the next bar.",
        }
      }
    }

    return mood === "wild"
      ? {
          root: tritoneRoot,
          quality: "7alt",
          symbol: buildChordSymbol(tritoneRoot, "7alt"),
          label: "Altered tritone sub",
          reason: "Maximum dominant color while preserving function.",
        }
      : tritone
  }

  if (isMinorQuality(bar.quality) && next && isDominantQuality(next.quality)) {
    return {
      root: bar.root,
      quality: "min6",
      symbol: buildChordSymbol(bar.root, "min6"),
      label: "Minor 6 color",
      reason: "Keeps predominant function but adds more harmonic color.",
    }
  }

  if (isMajorQuality(bar.quality) && prev && isDominantQuality(prev.quality)) {
    return {
      root: bar.root,
      quality: "maj6",
      symbol: buildChordSymbol(bar.root, "maj6"),
      label: "Major 6 color",
      reason: "Softens the tonic arrival with classic post-cadence color.",
    }
  }

  return null
}