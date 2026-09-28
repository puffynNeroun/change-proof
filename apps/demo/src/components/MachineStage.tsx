import { useEffect, useRef, useState } from 'react';
import { chapterAt, chapters, FILM_DURATION } from '../data/watchTimeline';
import type { Mode } from '../proof/controller';
import type { Stage } from '../proof/proofStages';

const media = `${import.meta.env.BASE_URL}media/`;
const clock = (seconds: number) => `0:${Math.floor(seconds).toString().padStart(2, '0')}`;

export function MachineStage({ mode, stage, activeChapter, onChapter, onRun, reducedMotion }: {
  mode: Mode; stage: Stage; activeChapter: number; onChapter: (chapter: number) => void; onRun: () => void; reducedMotion: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const progress = useRef<HTMLInputElement>(null);
  const timeLabel = useRef<HTMLOutputElement>(null);
  const chapter = useRef(-1);
  const watchTime = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [playError, setPlayError] = useState(false);
  const [ready, setReady] = useState(false);
  const watching = mode === 'watch';

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.pause();
    const seek = () => { element.currentTime = watching ? watchTime.current : stage.anchor; };
    if (element.readyState >= 1) seek();
    else element.addEventListener('loadedmetadata', seek, { once: true });
    return () => element.removeEventListener('loadedmetadata', seek);
  }, [watching, stage.anchor]);

  function updateTime() {
    const element = video.current;
    if (!element || !watching) return;
    const current = element.currentTime;
    watchTime.current = current;
    if (progress.current) progress.current.value = String(current);
    if (timeLabel.current) timeLabel.current.value = `${clock(current)} / 0:39`;
    const next = chapterAt(current);
    if (chapter.current !== next) { chapter.current = next; onChapter(next); }
  }

  async function togglePlayback() {
    const element = video.current;
    if (!element) return;
    if (!element.paused) { element.pause(); return; }
    if (element.ended) element.currentTime = 0;
    try { await element.play(); setPlayError(false); } catch { setPlayError(true); }
  }

  function seekTo(time: number) {
    const element = video.current;
    if (!element) return;
    element.currentTime = time;
    updateTime();
  }

  return <figure className="machine-stage">
    <div className="aperture">
      <video ref={video} muted playsInline preload="metadata" poster={`${media}idle.jpg`}
        aria-label="Accepted Change Proof film: shipping boundary experiment" aria-describedby="machine-caption"
        onTimeUpdate={updateTime} onSeeked={updateTime} onLoadedMetadata={() => setReady(true)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onError={() => setError(true)} style={{ visibility: error || (!watching && reducedMotion) ? 'hidden' : undefined }}>
        <source src={`${media}change-proof-v2.mp4`} type="video/mp4" onError={() => setError(true)} />
      </video>
      {(error || (!watching && reducedMotion)) && <img className="machine-still" src={`${media}${stage.id}.jpg`} alt="Accepted Proof Machine at the current proof stage" />}
      <span className="aperture-corner top" aria-hidden="true" /><span className="aperture-corner bottom" aria-hidden="true" />
    </div>
    <figcaption id="machine-caption"><span>{watching ? 'Cinematic record / V2' : stage.id === 'state-a' ? 'Recorded control / neutral machine view' : 'Proof Machine / accepted cinematic still'}</span><span>{watching ? '39 SEC · SILENT' : 'RUN 002'}</span></figcaption>
    {watching && <div className="watch-transport">
      <div className="transport-main"><button className="play-button" onClick={togglePlayback} disabled={!ready || error} aria-label={playing ? 'Pause film' : 'Play film'}><span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>{playing ? 'Pause' : 'Play'}</button><label className="sr-only" htmlFor="film-progress">Film progress in seconds</label><input ref={progress} id="film-progress" type="range" min="0" max={FILM_DURATION} step="0.1" defaultValue="0" disabled={!ready || error} onChange={event => seekTo(Number(event.target.value))} /><output ref={timeLabel}>0:00 / 0:39</output></div>
      <div className="transport-secondary"><label htmlFor="film-chapter">Chapter</label><select id="film-chapter" value={activeChapter} onChange={event => seekTo(chapters[Number(event.target.value)].start)} disabled={!ready || error}>{chapters.map((item, index) => <option key={item.start} value={index}>{item.view.label}</option>)}</select><button className="text-button" onClick={onRun}>Run it yourself <span aria-hidden="true">↗</span></button></div>
      {reducedMotion && <p className="footnote">Motion is optional. Scrub or choose a chapter to inspect still frames.</p>}
      {playError && <p role="status" className="small">Playback could not start. Try Play again, or <a href={`${media}change-proof-v2.mp4`}>open the film</a>.</p>}
    </div>}
    {error && <p role="status" className="small">The film could not load. The accepted stills and complete manual proof remain available.</p>}
  </figure>;
}
