export const INTRO_VIDEO_SRC = "/video/introduccion.mp4";

/** Presentation video: no autoplay, fixed 16:9 frame so the layout never jumps. */
export function IntroVideo() {
  return (
    <section className="intro-video" aria-labelledby="intro-video-title">
      <div className="container">
        <h2 className="axis-buttons__title intro-video__title" id="intro-video-title">
          Misión y Visión Programa de Fisioterapia
        </h2>
        <div className="intro-video__frame">
          <video
            className="intro-video__player"
            controls
            playsInline
            preload="metadata"
            src={INTRO_VIDEO_SRC}
            aria-label="Video: Misión y Visión del Programa de Fisioterapia"
          >
            Tu navegador no puede reproducir este video.{" "}
            <a href={INTRO_VIDEO_SRC} download>
              Descargar el video
            </a>
            .
          </video>
        </div>
      </div>
    </section>
  );
}
