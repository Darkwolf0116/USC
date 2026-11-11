export const INTRO_VIDEO_SRC = "/video/introduccion.mp4";

/** Presentation video: no autoplay, fixed 16:9 frame so the layout never jumps. */
export function IntroVideo() {
  return (
    <section className="intro-video" aria-labelledby="intro-video-title">
      <div className="container">
        <h2 className="visually-hidden" id="intro-video-title">
          Video de presentación
        </h2>
        <div className="intro-video__frame">
          <video
            className="intro-video__player"
            controls
            playsInline
            preload="metadata"
            src={INTRO_VIDEO_SRC}
            aria-label="Video de presentación del Programa de Fisioterapia"
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
