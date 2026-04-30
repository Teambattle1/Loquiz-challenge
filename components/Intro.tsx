import { useEffect, useRef, useState } from "react";
import "./intro.css";

const FIREFLIES = [
  { left: "10%", top: "80%", delay: "0s,.2s", dur: "9s,2.4s" },
  { left: "18%", top: "65%", delay: "1.1s,.7s", dur: "11s,1.8s" },
  { left: "25%", top: "45%", delay: ".4s,1.3s", dur: "10s,2.9s" },
  { left: "32%", top: "72%", delay: "2s,.5s", dur: "12s,2.2s" },
  { left: "40%", top: "30%", delay: ".9s,1.8s", dur: "9.5s,2.6s" },
  { left: "48%", top: "85%", delay: "1.6s,.3s", dur: "10.5s,1.9s" },
  { left: "55%", top: "55%", delay: ".2s,2.1s", dur: "11.5s,2.7s" },
  { left: "62%", top: "22%", delay: "2.4s,1s", dur: "9.8s,2.3s" },
  { left: "70%", top: "78%", delay: ".6s,.4s", dur: "10.8s,2.1s" },
  { left: "78%", top: "40%", delay: "1.3s,1.6s", dur: "11.2s,2.8s" },
  { left: "85%", top: "68%", delay: ".1s,.9s", dur: "9.3s,2s" },
  { left: "90%", top: "25%", delay: "1.9s,1.4s", dur: "10.2s,2.5s" },
  { left: "5%", top: "35%", delay: "1.5s,.6s", dur: "11.8s,2.3s" },
  { left: "50%", top: "15%", delay: ".7s,1.1s", dur: "9.6s,2.7s" },
  { left: "75%", top: "90%", delay: "2.2s,1.9s", dur: "10.6s,2s" },
];

const INTRO_TOTAL_MS = 5200;
const SESSION_KEY = "loquiz_intro_seen";

export default function Intro() {
  const [removed, setRemoved] = useState(
    () => typeof window === "undefined" || sessionStorage.getItem(SESSION_KEY) === "1",
  );
  const completedRef = useRef(removed);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
    setRemoved(true);
  };

  useEffect(() => {
    if (removed) return;
    const t = window.setTimeout(finish, INTRO_TOTAL_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (removed) return null;

  return (
    <div
      className="intro-overlay"
      role="button"
      tabIndex={0}
      aria-label="Skip intro animation"
      onClick={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          finish();
        }
      }}
    >
      <div className="fireflies">
        {FIREFLIES.map((f, i) => (
          <span
            key={i}
            className="firefly"
            style={{
              left: f.left,
              top: f.top,
              animationDelay: f.delay,
              animationDuration: f.dur,
            }}
          />
        ))}
      </div>
      <div className="intro-logo">
        <span className="w">LOQUI</span>
        <span className="o">Z</span>
      </div>
      <div className="intro-sub">
        <span className="by">by </span>
        <span className="w">TEAM</span>
        <span className="o">BATTLE</span>
      </div>
      <div className="intro-line" />
    </div>
  );
}
