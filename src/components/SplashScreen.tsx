import "./SplashScreen.css";

interface SplashScreenProps {
  onStart: () => void;
}

// Bright, toddler-friendly palette cycled across the title letters.
const LETTER_COLORS = [
  "#ff5a5f",
  "#ff9f43",
  "#ffd93d",
  "#4cd964",
  "#00c2c7",
  "#4aa3ff",
  "#a66bff",
  "#ff7fbf",
];

const TITLE = "Toddler Creative Canvas";

export function SplashScreen({ onStart }: SplashScreenProps) {
  // Color every visible letter independently; keep spaces as word breaks.
  let colorIdx = 0;
  const words = TITLE.split(" ");

  return (
    <div className="splash">
      <div className="splashInner">
        <h1 className="splashTitle" aria-label={TITLE}>
          {words.map((word, wi) => (
            <span className="splashWord" key={wi}>
              {word.split("").map((ch, ci) => {
                const color = LETTER_COLORS[colorIdx % LETTER_COLORS.length];
                colorIdx++;
                return (
                  <span
                    className="splashLetter"
                    key={ci}
                    style={{ color, animationDelay: `${colorIdx * 60}ms` }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          ))}
        </h1>

        <p className="splashSubtitle">
          Where tiny hands paint big imaginations. Crafted for little artists aged 2–4 — bold
          colors, playful sounds, zero clutter. Just tap, draw, and giggle.
        </p>

        <button className="splashStart" type="button" onClick={onStart}>
          Let’s Create! ✨
        </button>
      </div>
    </div>
  );
}
